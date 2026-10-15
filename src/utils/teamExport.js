/**
 * Team Import/Export as JSON
 * Allows sharing team configurations between users
 */
import { textPixelWidth, IN_GAME_NAME_WIDTH } from '../rom/TeamNameTileFont';
import { sharedKeeperTeams } from '../rom/readers/UniformReader';

/**
 * v3: the in-game name travels as the exact tile graphic (`teamNameInGameTiles`), and
 * `teamNameInGame` is its text (null for hand-drawn graphics). Before v3 the text was
 * never read from the ROM: exports carried the first 3 letters of the menu name.
 */
const EXPORT_VERSION = 3;

const isTileArray = (tiles) =>
  Array.isArray(tiles) && tiles.length === 64 && tiles.every((b) => Number.isInteger(b));

/**
 * Player fields to write on import.
 * v2+: `speed` is the read-only SPEED bar and is ignored.
 * v1: `speed` was the editor's name for byte 1 low nibble, which is really the
 * goalkeeper kick power (gkKickIndex = speed - 1, capped at 7).
 */
function importedPlayerFields(player, version) {
  const fields = { ...player };
  delete fields.speed;
  delete fields.raw;
  if (version < 2 && player.gkKickIndex == null && Number.isFinite(player.speed)) {
    fields.gkKickIndex = Math.max(0, Math.min(7, Math.round(player.speed) - 1));
  }
  return fields;
}

/**
 * Export a team to a JSON-compatible object
 * @param {object} team - Full team data from ROM
 * @returns {object} Exportable team data
 */
export function exportTeam(team) {
  return {
    _format: 'iss-forge-team',
    _version: EXPORT_VERSION,
    _exportedAt: new Date().toISOString(),
    name: team.name,
    id: team.id,
    teamNameText: team.teamNameText || '',
    teamNameInGame: team.teamNameInGame || null,
    teamNameInGameTiles: isTileArray(team.teamNameInGameTiles)
      ? [...team.teamNameInGameTiles]
      : undefined,
    players: team.players.map((p) => ({
      name: p.name,
      number: p.number,
      shooting: p.shooting,
      shootingIndex: p.shootingIndex,
      stamina: p.stamina,
      technique: p.technique,
      techniqueIndex: p.techniqueIndex,
      acceleration: p.acceleration,
      topSpeed: p.topSpeed,
      dribbleSpeed: p.dribbleSpeed,
      attack: p.attack,
      defense: p.defense,
      gkKickIndex: p.gkKickIndex,
      // Read-only: the SPEED bar shown by the game (derived from the three speeds)
      speed: p.speed,
      hairStyle: p.hairStyle,
      isSpecial: p.isSpecial,
      // Full 6-byte block, so the exact bytes travel with the team
      // (see research/hidden-player-attributes.md)
      raw: Array.isArray(p.rawBytes) ? [...p.rawBytes] : undefined,
    })),
    uniforms: team.uniforms,
    hairSkin: team.hairSkin,
    flagColors: team.flagColors,
    flagDesign: team.flagDesign ? { grid: team.flagDesign.grid } : null,
    specialHair: team.specialHair,
    specialSkin: team.specialSkin,
    // decides which team changes kit when both have the same (0-4)
    predominantColor: team.predominantColor,
    formation: team.formation ? { slots: team.formation.slots } : null,
    description: team.description || null,
  };
}

/**
 * Export all teams to a single JSON object
 * @param {object[]} teams
 * @returns {object}
 */
export function exportAllTeams(teams) {
  return {
    _format: 'iss-forge-all-teams',
    _version: EXPORT_VERSION,
    _exportedAt: new Date().toISOString(),
    teams: teams.map(exportTeam),
  };
}

/**
 * Validate imported team data
 * @param {object} data - Parsed JSON data
 * @returns {{ valid: boolean, error?: string, type: string }}
 */
export function validateImport(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'importErrInvalidJson' };
  }

  if (data._format === 'iss-forge-team') {
    if (!data.players || !Array.isArray(data.players) || data.players.length !== 15) {
      return { valid: false, error: 'importErrPlayerCount' };
    }
    return { valid: true, type: 'single' };
  }

  if (data._format === 'iss-forge-all-teams') {
    if (!data.teams || !Array.isArray(data.teams)) {
      return { valid: false, error: 'importErrNoTeams' };
    }
    return { valid: true, type: 'all' };
  }

  // Try to detect unformatted but valid data
  if (data.players && Array.isArray(data.players) && data.players.length === 15) {
    return { valid: true, type: 'single' };
  }

  return { valid: false, error: 'importErrFormat' };
}

/**
 * Apply imported team data to ROM via parser
 * @param {RomParser} romParser
 * @param {number} teamIndex - Target team slot
 * @param {object} teamData - Imported team data
 * @returns {{ warnings: string[] }} i18n keys of the parts that could not be written
 */
export function applyImportedTeam(romParser, teamIndex, teamData) {
  const version = Number.isFinite(teamData._version) ? teamData._version : 1;
  const warnings = [];
  // Write players
  if (teamData.players) {
    teamData.players.forEach((player, playerIndex) => {
      if (player.name) {
        romParser.writePlayerName(teamIndex, playerIndex, player.name);
      }
      // Use the exported 6-byte block when present so every bit travels with
      // the team; files without it fall back to the destination slot's bytes.
      const raw =
        Array.isArray(player.raw) && player.raw.length === 6 && player.raw.every(Number.isInteger)
          ? player.raw
          : null;
      romParser.writePlayerData(teamIndex, playerIndex, {
        ...importedPlayerFields(player, version),
        rawBytes: raw,
      });
    });
  }

  // Write uniforms
  if (teamData.uniforms) {
    ['home', 'away', 'goalkeeper'].forEach((kit) => {
      const kitData = teamData.uniforms[kit];
      if (!kitData) return;

      Object.entries(kitData).forEach(([part, colors]) => {
        if (Array.isArray(colors)) {
          colors.forEach((color, idx) => {
            if (color && color.r !== undefined) {
              romParser.writeUniformColor(teamIndex, kit, part, idx, color);
            }
          });
        }
      });
    });
  }

  // Write hair/skin
  if (teamData.hairSkin) {
    ['first', 'second', 'goalkeeper'].forEach((kit) => {
      const kitData = teamData.hairSkin[kit];
      if (!kitData) return;
      ['hair', 'skin'].forEach((part) => {
        if (kitData[part] && Array.isArray(kitData[part])) {
          kitData[part].forEach((color, idx) => {
            if (color && color.r !== undefined) {
              romParser.writeHairSkinColor(teamIndex, kit, part, idx, color);
            }
          });
        }
      });
    });
  }

  // Super Star has no goalkeeper of its own (it uses Belgium's): writing it changes the
  // other team's goalkeeper too
  if (
    (teamData.uniforms?.goalkeeper || teamData.hairSkin?.goalkeeper) &&
    sharedKeeperTeams(teamIndex).length
  ) {
    warnings.push('toastKeeperShared');
  }

  // Write flag colors
  if (teamData.flagColors && Array.isArray(teamData.flagColors)) {
    teamData.flagColors.forEach((color, idx) => {
      if (color && color.r !== undefined) {
        romParser.writeFlagColor(teamIndex, idx, color);
      }
    });
  }

  // Write team name (menu / selection screen)
  if (teamData.teamNameText) {
    if (!romParser.writeTeamNameMenu(teamIndex, teamData.teamNameText)) {
      warnings.push('toastTeamNameNoSpace');
    }
  }

  // In-game name graphic: the exact tiles when the file has them (v3+), else drawn
  // from the text
  if (isTileArray(teamData.teamNameInGameTiles)) {
    if (!romParser.writeTeamNameInGameTiles(teamIndex, teamData.teamNameInGameTiles)) {
      warnings.push('toastInGameNameNoSpace');
    }
  } else {
    let text = teamData.teamNameInGame;
    // Before v3 this was always the first 3 letters of the menu name (the real
    // graphic was never read): draw the full name, like the game does, when it fits
    const menu = String(teamData.teamNameText || '').toUpperCase();
    if (
      version < 3 &&
      text &&
      menu &&
      text === menu.substring(0, 3) &&
      textPixelWidth(menu) <= IN_GAME_NAME_WIDTH
    ) {
      text = menu;
    }
    if (text && !romParser.writeTeamNameInGame(teamIndex, text)) {
      warnings.push('toastInGameNameNoSpace');
    }
  }

  // Write default formation (optional — older exports don't have it)
  if (Array.isArray(teamData.formation?.slots) && teamData.formation.slots.length === 11) {
    romParser.writeFormation(teamIndex, teamData.formation.slots);
  }

  // Selection-screen description (optional)
  const d = teamData.description;
  if (d && typeof d.title === 'string' && typeof d.body === 'string') {
    const written = romParser.writeTeamDescription(teamIndex, {
      title: d.title,
      titleColor: Number.isInteger(d.titleColor) ? d.titleColor : 0x2c,
      body: d.body,
    });
    // the 27 descriptions share one area: nothing is written when it is full
    if (written && written.ok === false) warnings.push('descFull');
  }

  // Special hair / skin presets (optional)
  if (Number.isInteger(teamData.specialHair))
    romParser.writeSpecialHair(teamIndex, teamData.specialHair);
  if (Number.isInteger(teamData.specialSkin))
    romParser.writeSpecialSkin(teamIndex, teamData.specialSkin);
  if (Number.isInteger(teamData.predominantColor))
    romParser.writePredominantColor(teamIndex, teamData.predominantColor);

  // Flag design (optional; 2D grid of palette indexes)
  const grid = teamData.flagDesign?.grid;
  if (Array.isArray(grid) && grid.length && Array.isArray(grid[0])) {
    // nothing is written when the compressed flag does not fit
    if (!romParser.writeFlagDesign(teamIndex, grid)) warnings.push('toastFlagNoSpace');
  }

  return { warnings };
}

/**
 * Copy (or swap) a whole team between two slots: players incl. hidden
 * attributes, kits, hair/skin, flag, names, formation, description and the
 * crowd palette used when the team plays as team 1.
 * @param {RomParser} romParser
 * @param {number} from - source slot (TEAMS index)
 * @param {number} to - destination slot
 * @param {{ swap?: boolean }} [options]
 * @returns {{ warnings: string[] }}
 */
export function copyTeam(romParser, from, to, { swap = false } = {}) {
  if (from === to) return { warnings: [] };
  const src = JSON.parse(JSON.stringify(exportTeam(romParser.readTeam(from))));
  const dst = swap ? JSON.parse(JSON.stringify(exportTeam(romParser.readTeam(to)))) : null;
  const { crowdMap } = romParser.readMatchPalettes();

  const warnings = [...applyImportedTeam(romParser, to, src).warnings];
  const crowd = { [`crowdMap:${to}`]: crowdMap[from] };
  if (swap) {
    warnings.push(...applyImportedTeam(romParser, from, dst).warnings);
    crowd[`crowdMap:${from}`] = crowdMap[to];
  }
  romParser.applyPaletteUpdates(crowd);
  return { warnings: [...new Set(warnings)] };
}

/**
 * Download JSON data as a file (web fallback)
 */
export function downloadJson(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read a JSON file from disk (web fallback)
 * @returns {Promise<object|null>} null when cancelled; rejects when invalid or unreadable
 */
export function readJsonFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.oncancel = () => resolve(null);
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data === null) throw new Error('importJsonInvalid');
          resolve(data);
        } catch {
          reject(new Error('importJsonInvalid'));
        }
      };
      reader.onerror = () => reject(new Error('importFileReadFailed'));
      reader.onabort = () => reject(new Error('importFileReadFailed'));
      try {
        reader.readAsText(file);
      } catch {
        reject(new Error('importFileReadFailed'));
      }
    };
    input.click();
  });
}
