/**
 * ROM Save Validation
 * Checks for data inconsistencies before saving.
 *
 * Every warning carries an i18n key + params (the UI translates them):
 * { teamIndex, teamName, playerIndex?, type: 'error' | 'warning', key, params }
 */

/** Statistic fields kept in 1-16, with the i18n key of their name */
const NIBBLE_STATS = {
  acceleration: 'statAccelerationLong',
  topSpeed: 'statTopSpeedLong',
  dribbleSpeed: 'statDribbleSpeedLong',
  attack: 'statAttackLong',
  defense: 'statDefenseLong',
};

/**
 * Shirt numbers used by more than one player of a team.
 * @returns {Map<number, number[]>} number -> player indexes (only repeated numbers)
 */
export function duplicateNumbers(players = []) {
  const byNumber = new Map();
  players.forEach((p, i) => {
    if (!Number.isFinite(p?.number)) return;
    byNumber.set(p.number, [...(byNumber.get(p.number) || []), i]);
  });
  for (const [n, list] of byNumber) if (list.length < 2) byNumber.delete(n);
  return byNumber;
}

/**
 * Validate all teams for potential issues
 * @param {object[]} teams - Array of team data
 * @returns {object[]} warnings (see the file header)
 */
export function validateRom(teams) {
  const warnings = [];

  teams.forEach((team, teamIndex) => {
    const push = (type, key, params, playerIndex) =>
      warnings.push({ teamIndex, teamName: team.name, playerIndex, type, key, params });

    team.players.forEach((player, playerIndex) => {
      const p = { n: playerIndex + 1, name: player.name };
      if (!player.name || player.name.trim() === '') push('error', 'valNoName', p, playerIndex);
      if (player.name && player.name.length > 8) push('error', 'valNameTooLong', p, playerIndex);
      if (player.shooting < 1 || player.shooting > 15) {
        push('error', 'valShooting', { ...p, value: player.shooting }, playerIndex);
      }
      for (const [field, labelKey] of Object.entries(NIBBLE_STATS)) {
        const v = player[field];
        if (v !== undefined && (v < 1 || v > 16)) {
          push('error', 'valStatRange', { ...p, stat: { key: labelKey }, value: v }, playerIndex);
        }
      }
      if (player.gkKickIndex !== undefined && (player.gkKickIndex < 0 || player.gkKickIndex > 7)) {
        push('error', 'valGkKick', { ...p, value: player.gkKickIndex }, playerIndex);
      }
      if (player.stamina < 1 || player.stamina > 16) {
        push('error', 'valStamina', { ...p, value: player.stamina }, playerIndex);
      }
    });

    // The game only has keeper graphics for hair style 0: any other style draws the
    // goalkeeper as a cluster of broken sprites (checked in the emulator)
    const keeper = team.players[0];
    if (keeper && keeper.hairStyle > 0) {
      push('warning', 'valKeeperHair', { n: 1, name: keeper.name }, 0);
    }

    // Duplicate numbers in the same team (one warning per repeated number)
    for (const [number, list] of duplicateNumbers(team.players)) {
      push('warning', 'valDuplicateNumber', {
        number,
        players: list.map((i) => i + 1).join(', '),
      });
    }

    // All-black home shirt (usually a broken import)
    if (team.uniforms?.home?.shirt) {
      const allBlack = team.uniforms.home.shirt.every((c) => c.r === 0 && c.g === 0 && c.b === 0);
      if (allBlack) push('warning', 'valBlackShirt', {});
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

/**
 * Text of a warning: `t` is the i18n function; params that are { key } are translated.
 */
export function validationText(w, t) {
  const params = Object.fromEntries(
    Object.entries(w.params || {}).map(([k, v]) => [k, v && typeof v === 'object' ? t(v.key) : v]),
  );
  return t(w.key, params);
}
