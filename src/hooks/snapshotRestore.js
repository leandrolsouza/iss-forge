/**
 * Undo/redo: put the ROM buffer back to a history snapshot.
 *
 * Only the parts that really differ are written and reported as changed, so the
 * caller re-reads (and re-renders) only those. This matters for the editors with
 * an unapplied draft (scenarios, texts, menus, draws, descriptions...): their draft
 * is rebuilt whenever their stored data changes, so undoing an unrelated edit must
 * leave that data — and the objects holding it — untouched.
 */

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * `next` with every team (and every field of a team) that equals the one in `prev`
 * replaced by the `prev` object, so React sees no change there.
 * @param {object[]} next
 * @param {object[]} prev
 * @returns {object[]}
 */
export function keepUnchangedTeams(next, prev) {
  if (!Array.isArray(prev)) return next;
  return next.map((team, i) => {
    const old = prev[i];
    if (!old) return team;
    if (same(team, old)) return old;
    const merged = { ...team };
    for (const key of Object.keys(team)) {
      if (key in old && same(team[key], old[key])) merged[key] = old[key];
    }
    return merged;
  });
}

// Byte sections of a snapshot: [snapshot key, read, restore, state it feeds (or null)]
const BYTE_SECTIONS = [
  ['teamNameBytes', 'readTeamNameBytes', 'restoreTeamNameBytes', null],
  ['flagBytes', 'readFlagDesignBytes', 'restoreFlagDesignBytes', null],
  ['teamDescBytes', 'readTeamDescriptionBytes', 'restoreTeamDescriptionBytes', null],
  ['drawBytes', 'readTournamentDrawBytes', 'restoreTournamentDrawBytes', 'tournamentDraws'],
  ['gameTextBytes', 'readTrainingTextBytes', 'restoreTrainingTextBytes', 'gameTexts'],
  ['menuBytes', 'readMenuScreenBytes', 'restoreMenuScreenBytes', 'menuScreens'],
  ['screenTextBytes', 'readScreenTextBytes', 'restoreScreenTextBytes', 'screenTexts'],
  ['titleScreenBytes', 'readTitleScreenBytes', 'restoreTitleScreenBytes', 'titleScreen'],
];

/**
 * The global (non-team) part of a history snapshot. Byte sections are raw ROM bytes:
 * name, description, flag and text writes shift and re-pack data, which re-encoding
 * would not reproduce byte for byte, so undo restores the exact bytes.
 * @param {import('../rom/RomParser').default|null} rom
 * @param {{ scenarios?: object[], matchPalettes?: object }} state - current React state
 */
export function snapshotGlobals(rom, { scenarios = null, matchPalettes = null } = {}) {
  const out = { scenarios, matchPalettes };
  for (const [key, read] of BYTE_SECTIONS) out[key] = rom ? rom[read]() : null;
  return out;
}

/**
 * Write a history snapshot back into the ROM.
 * @param {import('../rom/RomParser').default} rom
 * @param {object} restored - snapshot ({ teams, scenarios, matchPalettes, ...Bytes })
 * @param {object[]} currentTeams - teams state before the undo/redo
 * @returns {{ teams: object[], changed: Set<string> }} teams to put in state (unchanged
 *   ones keep their identity) and the global states that must be re-read:
 *   'scenarios', 'matchPalettes', 'tournamentDraws', 'gameTexts', 'menuScreens',
 *   'screenTexts', 'titleScreen'
 */
export function restoreSnapshot(rom, restored, currentTeams) {
  const snapshot = Array.isArray(restored) ? { teams: restored } : restored;
  const changed = new Set();

  // Teams first (writes only the fields that differ), then the exact bytes
  rom.reloadTeams(snapshot.teams, currentTeams);

  if (snapshot.scenarios && !same(snapshot.scenarios, rom.readScenarios())) {
    rom.restoreScenarios(snapshot.scenarios);
    changed.add('scenarios');
  }
  for (const [key, read, restore, state] of BYTE_SECTIONS) {
    if (!snapshot[key] || same(snapshot[key], rom[read]())) continue;
    rom[restore](snapshot[key]);
    if (state) changed.add(state);
  }
  if (snapshot.matchPalettes && !same(snapshot.matchPalettes, rom.readMatchPalettes())) {
    rom.restoreMatchPalettes(snapshot.matchPalettes);
    changed.add('matchPalettes');
  }

  return { teams: keepUnchangedTeams(snapshot.teams, currentTeams), changed };
}
