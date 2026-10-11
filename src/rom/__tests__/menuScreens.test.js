import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  readMenuScreens,
  writeMenuScreen,
  readMenuScreenBytes,
  restoreMenuScreenBytes,
  menuTextLength,
  readScreenWords,
  writeMenuScreens,
} from '../menuScreens';
import { konamiCompress, konamiDecompress } from '../KonamiCodec';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

describe('konamiCompress on tilemaps', () => {
  it('packs period-2 runs (blank tilemap words) with overlapping LZ', () => {
    const data = new Uint8Array(2048);
    for (let i = 0; i < 2048; i += 2) data[i + 1] = 0x20;
    const packed = konamiCompress(data);
    expect(packed.length).toBeLessThan(150);
    expect(Array.from(konamiDecompress(packed, 0).slice(0, 2048))).toEqual(Array.from(data));
  });
});

describe.skipIf(!existsSync(REAL_ROM))('menu screens (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const screen = (rom, id) => rom.readMenuScreens().find((s) => s.id === id);

  it('finds the texts of the pre-match menu', () => {
    const s = screen(load(), 'prematch');
    expect(s.runs.map((r) => r.text)).toEqual([
      'Game Start',
      'Substituting',
      'Tactics',
      'Stadium',
      'Rules',
      'Team Colours',
      'Sound',
    ]);
  });

  it('decodes the texts of every screen', () => {
    const all = readMenuScreens(load());
    const texts = all.flatMap((s) => s.runs.map((r) => r.text));
    for (const t of [
      'ENTER PASSWORD',
      'Yellow Card',
      'Counter Attack',
      'CROWD NOISE',
      'INPUT',
      'Corner Kick',
    ])
      expect(texts.some((x) => x.includes(t))).toBe(true);
    // the original screens re-pack into their own slot
    const rom = load();
    for (const s of all) {
      const res = writeMenuScreen(rom, s.offset, {});
      expect(res.ok, s.id).toBe(true);
    }
  });

  it('rewrites a text and reads it back; refuses texts longer than the free space', () => {
    const rom = load();
    const s = screen(rom, 'prematch');
    const res = writeMenuScreen(rom, s.offset, { 0: 'Iniciar', 1: 'Substituicoes' });
    expect(res.ok).toBe(true);
    const back = screen(rom, 'prematch').runs.map((r) => r.text);
    expect(back[0]).toBe('Iniciar');
    expect(back[1]).toBe('Substituicoes');
    expect(back[2]).toBe('Tactics');
    const tooLong = 'x'.repeat(s.runs[4].maxLength + 1);
    expect(writeMenuScreen(rom, s.offset, { 4: tooLong }).ok).toBe(false);
    expect(menuTextLength('{1S}{T} x')).toBe(4);
  });

  it('never copies the flip bits of the "T" variant into new characters', () => {
    const rom = load();
    const s = screen(rom, 'prematch');
    const run = s.runs[2]; // "Tactics" starts with the flipped T tile
    expect(writeMenuScreen(rom, s.offset, { 2: 'Tatica' }).ok).toBe(true);
    const words = readScreenWords(rom, s.offset);
    for (let i = 2; i < 6; i++) {
      expect(words[run.row * 32 + run.col + i] & 0xc000).toBe(0);
      expect(words[(run.row + 1) * 32 + run.col + i] & 0xc000).toBe(0);
    }
  });

  it('moves a screen to free space when it no longer fits, and back home when it does', () => {
    const rom = load();
    const s = screen(rom, 'rules');
    const texts = { 0: 'Faltas', 3: 'Cartao Amarelo', 6: 'Impedimento' };
    const res = writeMenuScreen(rom, s.offset, texts);
    expect(res.ok).toBe(true);
    expect(res.moved).toBe(true);
    const after = screen(rom, 'rules');
    expect(after.moved).toBe(true);
    expect(after.location).not.toBe(s.offset);
    // the load descriptor points to the new place (FastROM bank byte kept)
    const p = 0x10697;
    expect(rom.readByte(p + 2) & 0x80).toBe(0x80);
    expect(after.runs.map((r) => r.text)).toContain('Cartao Amarelo');
    // reverting the texts brings the screen back to its original slot
    const back = writeMenuScreen(rom, s.offset, { 0: 'Fouls', 3: 'Yellow Card', 6: 'Offside' });
    expect(back.ok).toBe(true);
    expect(screen(rom, 'rules').location).toBe(s.offset);
  });

  it('lets several moved screens share the free areas without overlapping', () => {
    const rom = load();
    const big = (id) => {
      const s = screen(rom, id);
      return {
        offset: s.offset,
        texts: Object.fromEntries(s.runs.map((r, i) => [i, [...r.text].reverse().join('')])),
      };
    };
    const results = writeMenuScreens(rom, ['rules', 'options', 'tactics', 'wsResults'].map(big));
    const placed = [...results.values()].filter((r) => r.ok && r.moved);
    expect(placed.length).toBeGreaterThan(0);
    const spans = rom
      .readMenuScreens()
      .map((s) => [s.location, s.location + s.size])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++)
      expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
  });

  it('restores the raw bytes for undo', () => {
    const rom = load();
    const snap = readMenuScreenBytes(rom);
    const before = readMenuScreens(rom);
    writeMenuScreen(rom, before[0].offset, { 0: 'Jogar' });
    const rules = before.find((s) => s.id === 'rules');
    writeMenuScreen(rom, rules.offset, { 0: 'Faltas', 3: 'Cartao Amarelo', 6: 'Impedimento' });
    restoreMenuScreenBytes(rom, snap);
    expect(readMenuScreens(rom)).toEqual(before);
  });
});
