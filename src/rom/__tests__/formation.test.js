import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  decodeFormation,
  encodeFormation,
  getFormationName,
  getPositionLabel,
  getPresetSlots,
  withRole,
  validateFormation,
  getFormationAddress,
} from '../formation';
import { FORMATION_PRESETS, FORMATION_ROLES, TEAMS } from '../constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);

describe('formation encoding', () => {
  it('round-trips every preset', () => {
    for (const preset of FORMATION_PRESETS) {
      const slots = getPresetSlots(preset.id);
      expect(slots).toHaveLength(11);
      const hex = Array.from(encodeFormation(slots))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      expect(hex).toBe(preset.hex);
    }
  });

  it('names presets from line counts', () => {
    const names = Object.fromEntries(
      FORMATION_PRESETS.map((p) => [p.id, getFormationName(getPresetSlots(p.id))]),
    );
    expect(names['442-flat']).toBe('4-4-2');
    expect(names['442-diamond']).toBe('4-4-2');
    expect(names['433']).toBe('4-3-3');
    expect(names['451']).toBe('4-5-1');
    expect(names['343']).toBe('3-4-3');
    expect(names['352']).toBe('3-5-2');
    expect(names['532']).toBe('5-3-2');
    expect(names['424']).toBe('4-2-4');
  });

  it('presets are internally consistent (role ↔ line, GK in slot 1)', () => {
    for (const preset of FORMATION_PRESETS) {
      expect(validateFormation(getPresetSlots(preset.id))).toEqual([]);
    }
  });

  it('derives readable position labels', () => {
    const labels = getPresetSlots('442-flat').map(getPositionLabel);
    expect(labels).toEqual(['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST']);
    const diamond = getPresetSlots('442-diamond').map(getPositionLabel);
    expect(diamond.slice(5, 9)).toEqual(['DM', 'LM', 'RM', 'AM']);
    expect(getPresetSlots('532').map(getPositionLabel)[3]).toBe('SW');
    expect(getPresetSlots('433').map(getPositionLabel).slice(8)).toEqual(['LW', 'RW', 'ST']);
  });

  it('withRole keeps line and behaviour coherent', () => {
    const slot = getPresetSlots('442-flat')[9]; // forward
    const asMid = withRole(slot, 4);
    expect(asMid.role).toBe(4);
    expect(asMid.line).toBe(2);
    expect(asMid.behavior).toBe(0x54);
    expect(asMid.depth).toBe(slot.depth);
    for (const role of FORMATION_ROLES) {
      expect(withRole(slot, role.id).line).toBe(role.line);
    }
  });

  it('clamps out-of-range values when encoding', () => {
    const slots = getPresetSlots('442-flat');
    slots[1] = { ...slots[1], lateral: 99, depth: -5 };
    const decoded = decodeFormation(encodeFormation(slots));
    expect(decoded[1].lateral).toBe(15);
    expect(decoded[1].depth).toBe(0);
  });

  it('flags structural problems', () => {
    const slots = getPresetSlots('442-flat');
    slots[5] = { ...slots[5], role: 6 }; // forward role on midfield line
    expect(validateFormation(slots)).toContain('formationRoleLineMismatch');
    slots[0] = { ...slots[0], role: 2, line: 1 };
    expect(validateFormation(slots)).toContain('formationGkSlot');
  });
});

describe.skipIf(!hasRealRom)('formation on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('resolves 27 distinct records through the pointer table', () => {
    const rom = load();
    const addrs = TEAMS.map((_, i) => getFormationAddress(rom, i));
    expect(new Set(addrs).size).toBe(27);
    expect(addrs[0]).toBe(0x3831c); // Germany
    expect(addrs[24]).toBe(0x3831c + 24 * 44); // Scotland (ordinal 5 in the pointer table)
  });

  it('matches the formations seen in-game', () => {
    const rom = load();
    const expected = {
      GERMANY: '5-3-2',
      ITALY: '4-4-2',
      HOLLAND: '3-4-3',
      ENGLAND: '4-3-3',
      SWEDEN: '4-5-1',
      NIGERIA: '3-5-2',
      BRAZIL: '4-4-2',
      SUPERSTAR: '4-2-4',
    };
    TEAMS.forEach((team, i) => {
      if (expected[team.id]) expect(rom.readFormation(i).name).toBe(expected[team.id]);
    });
  });

  it('every original record passes validation', () => {
    const rom = load();
    TEAMS.forEach((_, i) => expect(validateFormation(rom.readFormation(i).slots)).toEqual([]));
  });

  it('writes only the 44 bytes of the target team', () => {
    const rom = load();
    const before = new Uint8Array(rom.getRomData());
    rom.writeFormation(3, getPresetSlots('532'));
    expect(rom.readFormation(3).name).toBe('5-3-2');

    const after = rom.getRomData();
    const start = getFormationAddress(rom, 3);
    for (let i = 0; i < after.length; i++) {
      if (i >= start && i < start + 44) continue;
      if (after[i] !== before[i]) throw new Error(`Unexpected change at 0x${i.toString(16)}`);
    }
  });

  it('swapPlayers exchanges name and data and is reversible', () => {
    const rom = load();
    const names = rom.readPlayerNames(18);
    const data = rom.readPlayerData(18);
    rom.swapPlayers(18, 9, 12);
    expect(rom.readPlayerNames(18)[9]).toBe(names[12]);
    expect(rom.readPlayerNames(18)[12]).toBe(names[9]);
    expect(rom.readPlayerData(18)[9].rawBytes).toEqual(data[12].rawBytes);
    rom.swapPlayers(18, 9, 12);
    expect(rom.readPlayerNames(18)).toEqual(names);
  });

  it('readTeam exposes the formation and reloadTeams restores it (undo)', () => {
    const rom = load();
    const snapshot = rom.readAllTeams();
    rom.writeFormation(1, getPresetSlots('424'));
    expect(rom.readTeam(1).formation.name).toBe('4-2-4');
    rom.reloadTeams(snapshot);
    expect(rom.readTeam(1).formation.name).toBe('4-4-2');
  });

  it('undo with diffing restores the ROM byte-for-byte (no collateral rewrites)', () => {
    const rom = load();
    const original = new Uint8Array(rom.getRomData());
    const before = rom.readAllTeams();

    // Edit: formation + lineup swap on Italy
    rom.writeFormation(1, getPresetSlots('424'));
    rom.swapPlayers(1, 9, 12);
    const after = rom.readAllTeams();

    // Undo: restore "before" diffing against current state
    rom.reloadTeams(before, after);
    const data = rom.getRomData();
    const diffs = [];
    for (let i = 0; i < data.length; i++) if (data[i] !== original[i]) diffs.push(i);
    expect(diffs).toEqual([]);
  });
});
