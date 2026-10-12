/**
 * "Restore original" for the parts of a team: puts back the bytes the ROM had when it
 * was loaded (RomParser.getOriginalData), part by part.
 *
 * Colours are copied byte for byte. Names, flag designs and descriptions are written
 * again from the original values (their areas are re-packed, so the exact bytes can
 * differ while the result looks the same).
 */
import RomParser from './RomParser';
import { TEAMS, PLAYER_NAMES, UNIFORM_COLORS, FLAG_DESIGN_ORDINALS } from './constants';
import { getKitOffset, getHairSkinOffset, getFlagOffset } from './readers/UniformReader';

/** Parts a team can restore */
export const RESTORE_PARTS = [
  'uniform:home',
  'uniform:away',
  'uniform:goalkeeper',
  'hairSkin',
  'flagColors',
  'flagDesign',
  'teamName',
  'description',
  'predominantColor',
];

const original = (rom) => new RomParser(rom.getOriginalData());

function copyBytes(rom, orig, offset, length) {
  if (offset === null || offset === undefined) return;
  rom.writeBytes(offset, orig.readBytes(offset, length));
}

/**
 * Restore one part of a team.
 * @param {RomParser} rom
 * @param {number} teamIndex
 * @param {string} part - RESTORE_PARTS, or `player:N` (player N, 0-14: name and data)
 * @returns {{ ok: boolean, error?: string }}
 */
export function restoreTeamPart(rom, teamIndex, part) {
  const orig = original(rom);
  const id = TEAMS[teamIndex]?.id;
  if (!id) return { ok: false, error: 'badTeam' };

  if (part.startsWith('uniform:')) {
    const kit = part.slice(8);
    copyBytes(rom, orig, getKitOffset(id, kit), kit === 'goalkeeper' ? 12 : 16);
    return { ok: true };
  }
  if (part.startsWith('player:')) {
    const p = Number(part.slice(7));
    if (!(p >= 0 && p < 15)) return { ok: false, error: 'badPlayer' };
    const nameAt =
      PLAYER_NAMES.OFFSET + teamIndex * PLAYER_NAMES.TEAM_LENGTH + p * PLAYER_NAMES.NAME_LENGTH;
    copyBytes(rom, orig, nameAt, PLAYER_NAMES.NAME_LENGTH);
    const player = orig.readPlayers(teamIndex)[p];
    rom.writePlayerData(teamIndex, p, { ...player, rawBytes: player.rawBytes });
    return { ok: true };
  }
  switch (part) {
    case 'hairSkin':
      copyBytes(rom, orig, getHairSkinOffset(id, 'first'), 12);
      copyBytes(rom, orig, getHairSkinOffset(id, 'second'), 12);
      copyBytes(rom, orig, getHairSkinOffset(id, 'goalkeeper'), 8);
      rom.writeSpecialHair(teamIndex, orig.readSpecialHair(teamIndex));
      rom.writeSpecialSkin(teamIndex, orig.readSpecialSkin(teamIndex));
      return { ok: true };
    case 'flagColors':
      copyBytes(rom, orig, getFlagOffset(id), 8);
      return { ok: true };
    case 'flagDesign':
      return rom.writeFlagDesign(teamIndex, orig.readFlagDesign(teamIndex).grid)
        ? { ok: true }
        : { ok: false, error: 'toastFlagNoSpace' };
    case 'teamName': {
      const menu = rom.writeTeamNameMenu(teamIndex, orig.readTeamNameText(teamIndex));
      const tiles = rom.writeTeamNameInGameTiles(
        teamIndex,
        orig.readTeamNameInGame(teamIndex).tiles,
      );
      return menu && tiles ? { ok: true } : { ok: false, error: 'toastTeamNameNoSpace' };
    }
    case 'description': {
      const res = rom.writeTeamDescription(teamIndex, orig.readTeamDescription(teamIndex));
      return res.ok ? { ok: true } : { ok: false, error: 'descFull' };
    }
    case 'predominantColor':
      copyBytes(
        rom,
        orig,
        UNIFORM_COLORS.PREDOMINANT_COLOR_OFFSET + FLAG_DESIGN_ORDINALS[teamIndex],
        1,
      );
      return { ok: true };
    default:
      return { ok: false, error: 'badPart' };
  }
}

/**
 * Whether a part still has its original value (to disable the button).
 * Compares the team as read from both ROMs.
 */
export function isTeamPartOriginal(currentTeam, originalTeam, part) {
  if (!currentTeam || !originalTeam) return true;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const colors = (list) =>
    (list || []).map((c) => [c.r5 ?? c.r >> 3, c.g5 ?? c.g >> 3, c.b5 ?? c.b >> 3]);
  const kitColors = (kit) =>
    kit ? Object.fromEntries(Object.entries(kit).map(([k, v]) => [k, colors(v)])) : null;
  if (part.startsWith('uniform:')) {
    const kit = part.slice(8);
    return same(kitColors(currentTeam.uniforms?.[kit]), kitColors(originalTeam.uniforms?.[kit]));
  }
  if (part.startsWith('player:')) {
    const p = Number(part.slice(7));
    const a = currentTeam.players?.[p];
    const b = originalTeam.players?.[p];
    return !!a && !!b && a.name === b.name && same(a.rawBytes, b.rawBytes);
  }
  switch (part) {
    case 'hairSkin':
      return (
        ['first', 'second', 'goalkeeper'].every((k) =>
          same(kitColors(currentTeam.hairSkin?.[k]), kitColors(originalTeam.hairSkin?.[k])),
        ) &&
        currentTeam.specialHair === originalTeam.specialHair &&
        currentTeam.specialSkin === originalTeam.specialSkin
      );
    case 'flagColors':
      return same(colors(currentTeam.flagColors), colors(originalTeam.flagColors));
    case 'flagDesign':
      return same(currentTeam.flagDesign?.grid, originalTeam.flagDesign?.grid);
    case 'teamName':
      return (
        currentTeam.teamNameText === originalTeam.teamNameText &&
        same(currentTeam.teamNameInGameTiles, originalTeam.teamNameInGameTiles)
      );
    case 'description':
      return same(currentTeam.description, originalTeam.description);
    case 'predominantColor':
      return currentTeam.predominantColor === originalTeam.predominantColor;
    default:
      return true;
  }
}
