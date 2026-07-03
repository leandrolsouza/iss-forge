/**
 * ROM Save Validation
 * Checks for data inconsistencies before saving
 */

/**
 * Validate all teams for potential issues
 * @param {object[]} teams - Array of team data
 * @returns {object[]} Array of warnings { teamIndex, teamName, type, message }
 */
export function validateRom(teams) {
  const warnings = [];

  teams.forEach((team, teamIndex) => {
    // Check player names
    team.players.forEach((player, playerIndex) => {
      // Empty name
      if (!player.name || player.name.trim() === '') {
        warnings.push({
          teamIndex,
          teamName: team.name,
          type: 'error',
          message: `Jogador ${playerIndex + 1} sem nome`,
        });
      }

      // Name too long (should be max 8)
      if (player.name && player.name.length > 8) {
        warnings.push({
          teamIndex,
          teamName: team.name,
          type: 'error',
          message: `Jogador ${playerIndex + 1} "${player.name}" excede 8 caracteres`,
        });
      }

      // Duplicate numbers in same team
      const sameNumber = team.players.filter(
        (p, i) => i !== playerIndex && p.number === player.number,
      );
      if (sameNumber.length > 0 && playerIndex < team.players.indexOf(sameNumber[0])) {
        warnings.push({
          teamIndex,
          teamName: team.name,
          type: 'warning',
          message: `Numero ${player.number} duplicado (jogadores ${playerIndex + 1} e ${team.players.indexOf(sameNumber[0]) + 1})`,
        });
      }

      // Stats out of range
      if (player.shooting < 1 || player.shooting > 15) {
        warnings.push({
          teamIndex,
          teamName: team.name,
          type: 'error',
          message: `Jogador ${playerIndex + 1} "${player.name}" chute invalido: ${player.shooting}`,
        });
      }
      if (player.speed < 1 || player.speed > 16) {
        warnings.push({
          teamIndex,
          teamName: team.name,
          type: 'error',
          message: `Jogador ${playerIndex + 1} "${player.name}" velocidade invalida: ${player.speed}`,
        });
      }
      if (player.stamina < 1 || player.stamina > 16) {
        warnings.push({
          teamIndex,
          teamName: team.name,
          type: 'error',
          message: `Jogador ${playerIndex + 1} "${player.name}" stamina invalida: ${player.stamina}`,
        });
      }
    });

    // Check for all-zero uniform colors
    if (team.uniforms?.home?.shirt) {
      const allBlack = team.uniforms.home.shirt.every((c) => c.r === 0 && c.g === 0 && c.b === 0);
      if (allBlack) {
        warnings.push({
          teamIndex,
          teamName: team.name,
          type: 'warning',
          message: `Todas as cores da camisa titular estao pretas (0,0,0)`,
        });
      }
    }
  });

  return warnings;
}

/**
 * Get summary of validation results
 * @param {object[]} warnings
 * @returns {object} { errors, warnings, isValid }
 */
export function getValidationSummary(warnings) {
  const errors = warnings.filter((w) => w.type === 'error');
  const warns = warnings.filter((w) => w.type === 'warning');
  return {
    errors: errors.length,
    warnings: warns.length,
    isValid: errors.length === 0,
    total: warnings.length,
  };
}
