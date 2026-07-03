/**
 * Team Import/Export as JSON
 * Allows sharing team configurations between users
 */

const EXPORT_VERSION = 1;

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
    teamNameInGame: team.teamNameInGame || (team.teamNameText || team.name).substring(0, 3).toUpperCase(),
    players: team.players.map((p) => ({
      name: p.name,
      number: p.number,
      shooting: p.shooting,
      shootingIndex: p.shootingIndex,
      speed: p.speed,
      stamina: p.stamina,
      technique: p.technique,
      techniqueIndex: p.techniqueIndex,
      hairStyle: p.hairStyle,
      isSpecial: p.isSpecial,
    })),
    uniforms: team.uniforms,
    hairSkin: team.hairSkin,
    flagColors: team.flagColors,
    flagDesign: team.flagDesign ? { grid: team.flagDesign.grid } : null,
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
    return { valid: false, error: 'Invalid JSON data' };
  }

  if (data._format === 'iss-forge-team') {
    if (!data.players || !Array.isArray(data.players) || data.players.length !== 15) {
      return { valid: false, error: 'Team must have exactly 15 players' };
    }
    return { valid: true, type: 'single' };
  }

  if (data._format === 'iss-forge-all-teams') {
    if (!data.teams || !Array.isArray(data.teams)) {
      return { valid: false, error: 'Missing teams array' };
    }
    return { valid: true, type: 'all' };
  }

  // Try to detect unformatted but valid data
  if (data.players && Array.isArray(data.players) && data.players.length === 15) {
    return { valid: true, type: 'single' };
  }

  return { valid: false, error: 'Unrecognized format. Expected ISS Forge export file.' };
}

/**
 * Apply imported team data to ROM via parser
 * @param {RomParser} romParser
 * @param {number} teamIndex - Target team slot
 * @param {object} teamData - Imported team data
 */
export function applyImportedTeam(romParser, teamIndex, teamData) {
  // Write players
  if (teamData.players) {
    teamData.players.forEach((player, playerIndex) => {
      if (player.name) {
        romParser.writePlayerName(teamIndex, playerIndex, player.name);
      }
      romParser.writePlayerData(teamIndex, playerIndex, {
        ...player,
        rawBytes: null, // Force fresh write
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
    romParser.writeTeamNameMenu(teamIndex, teamData.teamNameText);
  }

  // Write team name (in-game / scoreboard)
  if (teamData.teamNameInGame) {
    romParser.writeTeamNameInGame(teamIndex, teamData.teamNameInGame);
  }
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
 * @returns {Promise<object|null>}
 */
export function readJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          resolve(JSON.parse(ev.target.result));
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
