/**
 * Tournament draws (International Cup / World Series)
 *
 * 32 pre-set draws of 24 teams (6 groups of 4). See TOURNAMENT_DRAWS in
 * constants.js and research/tournaments.md.
 */
import { TOURNAMENT_DRAWS, TEAMS } from './constants';
import { ordinalToTeamIndex, teamIndexToOrdinal } from './scenario';

const D = TOURNAMENT_DRAWS;

const drawAddress = (index) => D.OFFSET + index * D.TEAMS;

/**
 * Read one draw as 24 TEAMS indexes (groups are slices of 4).
 * Bytes that are not a valid team id come back as -1.
 */
export function readDraw(rom, index) {
  const bytes = rom.readBytes(drawAddress(index), D.TEAMS);
  return Array.from(bytes, (b) => (b % 2 === 0 ? ordinalToTeamIndex(b / 2) : -1));
}

export function readDraws(rom) {
  return Array.from({ length: D.COUNT }, (_, i) => readDraw(rom, i));
}

export function readDrawBytes(rom) {
  return Array.from(rom.readBytes(D.OFFSET, D.COUNT * D.TEAMS));
}

export function restoreDrawBytes(rom, bytes) {
  if (Array.isArray(bytes) && bytes.length === D.COUNT * D.TEAMS) {
    rom.writeBytes(D.OFFSET, new Uint8Array(bytes));
  }
}

/** Write one draw (24 TEAMS indexes). */
export function writeDraw(rom, index, teams) {
  if (index < 0 || index >= D.COUNT) throw new Error('Draw index out of range');
  if (!Array.isArray(teams) || teams.length !== D.TEAMS) throw new Error('A draw has 24 teams');
  const bytes = teams.map((t) => {
    const ordinal = teamIndexToOrdinal(t);
    if (ordinal === undefined) throw new Error(`Invalid team index ${t}`);
    return ordinal * 2;
  });
  rom.writeBytes(drawAddress(index), new Uint8Array(bytes));
}

/**
 * Only the draws of `changes` ({ index: 24 TEAMS indexes }) that differ from the ROM,
 * so saving an unchanged draw does not create an empty undo step.
 */
export function changedDraws(rom, changes) {
  return Object.fromEntries(
    Object.entries(changes || {}).filter(
      ([index, draw]) =>
        !Array.isArray(draw) ||
        readDraw(rom, Number(index)).some((team, i) => team !== draw[i]) ||
        draw.length !== D.TEAMS,
    ),
  );
}

/** Split a draw into its 6 groups. */
export const drawGroups = (draw) =>
  Array.from({ length: D.GROUPS }, (_, g) => draw.slice(g * D.GROUP_SIZE, (g + 1) * D.GROUP_SIZE));

/** TEAMS indexes the player can pick in the menus (Super Star excluded). */
export const SELECTABLE_TEAMS = TEAMS.map((_, i) => i).filter(
  (i) => teamIndexToOrdinal(i) < D.SELECTABLE_ORDINALS,
);

/** How many draws contain each team (index = TEAMS index). */
export function drawCoverage(draws) {
  const count = new Array(TEAMS.length).fill(0);
  for (const draw of draws) for (const t of new Set(draw)) if (t >= 0) count[t]++;
  return count;
}

/**
 * Problems in a list of draws.
 * - error 'missing': a selectable team is in no draw (the game freezes when it is picked)
 * - warning 'duplicate': the same team twice in one draw (it would play itself)
 * - warning 'invalid': a byte that is not a team id
 */
export function validateDraws(draws) {
  const issues = [];
  const coverage = drawCoverage(draws);
  for (const t of SELECTABLE_TEAMS) {
    if (coverage[t] === 0) issues.push({ type: 'error', code: 'missing', team: t });
  }
  draws.forEach((draw, index) => {
    const seen = new Set();
    draw.forEach((t) => {
      if (t < 0) issues.push({ type: 'warning', code: 'invalid', draw: index });
      else if (seen.has(t))
        issues.push({ type: 'warning', code: 'duplicate', draw: index, team: t });
      seen.add(t);
    });
  });
  return issues;
}
