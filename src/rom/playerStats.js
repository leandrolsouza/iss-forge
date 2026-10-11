/**
 * Player attribute helpers shared by the reader, the writer and the UI.
 *
 * Game usage of each field (research/hidden-player-attributes.md):
 *  - acceleration (b0.lo): speed a player starts running at
 *  - topSpeed     (b0.hi): top running speed without the ball
 *  - dribbleSpeed (b3.hi): top running speed with the ball
 *  - attack       (b4.hi): strength in ball duels in the opponent's half
 *  - defense      (b4.lo): strength in ball duels in the player's own half
 *  - gkKickIndex  (b1.lo): goalkeeper kick power (only read in goalkeeper states)
 *
 * The 4-bit fields use the same 1-16 scale as stamina (nibble + 1).
 * The 3-bit fields (shooting, technique, gkKick) use SHOOTING_VALUES (index 0-7).
 */
import { SHOOTING_VALUES } from './constants';

/** 4-bit attributes, 1-16 in the editor (nibble + 1). */
export const NIBBLE_STATS = ['acceleration', 'topSpeed', 'dribbleSpeed', 'attack', 'defense'];

/** 3-bit attributes stored as an index 0-7 (shown as SHOOTING_VALUES). */
export const INDEX_STATS = ['shootingIndex', 'techniqueIndex', 'gkKickIndex'];

export const clampStat = (v) => Math.max(1, Math.min(16, Math.round(Number(v)) || 1));
export const clampIndex = (v) => Math.max(0, Math.min(7, Math.round(Number(v)) || 0));

/**
 * SPEED bar as the game draws it on the substitution screen ($00:EB20):
 * (2 * start speed + top speed + dribble speed) / 4, on the 1-16 scale.
 */
export function gameSpeed(p) {
  const n = (k) => clampStat(p?.[k] ?? 1) - 1;
  return ((2 * n('acceleration') + n('topSpeed') + n('dribbleSpeed')) >> 2) + 1;
}

/**
 * Recompute the read-only values derived from the editable ones
 * (shooting/technique/gkKick labels and the game's speed bar).
 */
export function withDerivedStats(p) {
  return {
    ...p,
    shooting: SHOOTING_VALUES[clampIndex(p.shootingIndex)],
    technique: SHOOTING_VALUES[clampIndex(p.techniqueIndex)],
    gkKick: SHOOTING_VALUES[clampIndex(p.gkKickIndex)],
    speed: gameSpeed(p),
  };
}
