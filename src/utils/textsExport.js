/**
 * Translation pack: export / import every editable text as one JSON file
 * (training texts, menu screens, scenario texts, team descriptions).
 *
 * Import is all-or-nothing: everything is written to a copy of the ROM first
 * and only copied back when every part fits.
 */
import RomParser from '../rom/RomParser';
import { TEAMS, GAME_TEXTS, SCENARIO_DATA } from '../rom/constants';
import { validateTrainingTexts, findInvalidBoxChars, findInvalidIssChars } from '../rom/gameTexts';
import { findInvalidMenuChars, menuTextLength, writeMenuScreens } from '../rom/menuScreens';
import { encodeScreenField, measureScreenPacks } from '../rom/screenTexts';
import { SCREEN_TEXTS } from '../rom/constants';
import { findInvalidChars, wrapScenarioText } from '../rom/scenario';
import {
  writeTeamDescriptions,
  readTeamDescriptions,
  wrapDescriptionBody,
  TEAM_DESC,
} from '../rom/teamDescription';

export const TEXTS_FORMAT = 'iss-forge-texts';
export const TEXTS_VERSION = 1;

const teamId = (i) => TEAMS[i]?.id;

export function exportTexts(romParser) {
  const training = romParser.readTrainingTexts();
  const menus = {};
  for (const screen of romParser.readMenuScreens()) {
    menus[screen.id] = screen.runs.map((r) => ({
      at: `${r.row},${r.col}`,
      max: r.maxLength,
      // text of the original ROM (the file matches by it when "at" is missing)
      original: r.original ?? r.text,
      ...(r.prefix ? { note: `the game draws "${r.prefix}" right before this text` } : {}),
      text: r.text,
    }));
  }
  const scenarios = romParser.readScenarios().map((sc, i) => ({
    index: i + 1,
    match: `${teamId(sc.team1)} ${sc.goals1}x${sc.goals2} ${teamId(sc.team2)}`,
    text: sc.text,
  }));
  const teamDescriptions = readTeamDescriptions(romParser).map((d, i) => ({
    team: teamId(i),
    title: d.title,
    body: d.body,
  }));
  const current = romParser.readScreenTexts();
  const screens = Object.fromEntries(
    SCREEN_TEXTS.map((s) => [
      s.id,
      s.fields.map((f) => ({ id: f.id, limit: screenFieldLimit(f), text: current[s.id][f.id] })),
    ]),
  );
  return {
    _format: TEXTS_FORMAT,
    _version: TEXTS_VERSION,
    _exportedAt: new Date().toISOString(),
    _help: [
      'Edit only the "text" / "title" / "body" values. "\\n" forces a new line.',
      'The game fonts have no accents: they are removed on import (técnico -> tecnico).',
      'Menu texts: at most "max" characters. "original" and "at" identify the text and are not imported.',
      '{1S}{T} and {2N}{D} draw "1ST" and "2ND". Codes like {7a} keep special tiles.',
      'Parts or entries can be removed from the file: missing ones are left unchanged.',
      'Screens: "limit" tells the room of each text. {fe}{xx} changes the colour and takes no cell.',
    ],
    training,
    menus,
    screens,
    scenarios,
    teamDescriptions,
  };
}

/** Human-readable room of a screen text field (exported as "limit") */
export function screenFieldLimit(f) {
  if (f.kind === 'box') return `${f.lines} lines x ${f.columns} columns`;
  if (f.lines > 1) return `${f.lines} lines x ${f.columns} letters`;
  if (f.kind === 'label') return `${f.columns} letters (filled with dots)`;
  return `${f.columns} letters`;
}

export function validateTextsFile(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid JSON data' };
  if (data._format !== TEXTS_FORMAT) {
    return {
      valid: false,
      error: `Not an ISS Forge texts file (_format must be "${TEXTS_FORMAT}")`,
    };
  }
  return { valid: true };
}

const isStr = (v) => typeof v === 'string';

/** The fonts have no accents: "técnico" -> "tecnico", "ç" -> "c", typographic quotes -> ASCII */
export function stripAccents(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
}

/** Deep copy of the file with every string passed through stripAccents; counts the changes */
function normalizeStrings(value, counter) {
  if (typeof value === 'string') {
    const s = stripAccents(value);
    if (s !== value) counter.n++;
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => normalizeStrings(v, counter));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === 'original' || k === 'at' ? v : normalizeStrings(v, counter),
      ]),
    );
  }
  return value;
}

/** "a" / "b" / "c" — how the game will break a text, for error messages */
const showLines = (lines) => lines.map((l) => `"${l}"`).join(' / ');

/**
 * Apply a texts file. Texts that do not fit are skipped (the rest is imported)
 * and listed in `skipped` with the reason and the lines as the game would draw them.
 * @param {{ beforeCommit?: () => void }} [options] - called right before the ROM is changed
 *   (e.g. to push an undo snapshot); not called when nothing changes
 * @returns {{ ok: boolean, errors: string[], skipped: string[], warnings: string[],
 *   moved: string[], changed: object }}
 */
export function applyTexts(romParser, input, { beforeCommit } = {}) {
  const errors = [];
  const skipped = [];
  const warnings = [];
  const moved = [];
  const changed = { training: 0, menus: 0, screens: 0, scenarios: 0, teamDescriptions: 0 };
  const check = validateTextsFile(input);
  if (!check.valid) return { ok: false, errors: [check.error], skipped, warnings, moved, changed };
  const counter = { n: 0 };
  const data = normalizeStrings(input, counter);
  if (counter.n) warnings.push(`${counter.n} text(s): accents removed (the game fonts have none)`);

  // Work on a copy; capacities are measured against the ROM as loaded
  const work = new RomParser(romParser.getRomData());
  work.originalData = romParser.getOriginalData();
  const invalidChars = (path, chars) =>
    chars.length && warnings.push(`${path}: no glyph for ${chars.join(' ')} (shown as space)`);

  // --- Training ---
  if (data.training && typeof data.training === 'object') {
    const cur = work.readTrainingTexts();
    const next = structuredClone(cur);
    const t = data.training;
    for (const key of ['titles', 'intros', 'messages']) {
      if (!Array.isArray(t[key])) continue;
      t[key].forEach((v, i) => {
        if (i < next[key].length && isStr(v)) next[key][i] = v;
      });
    }
    if (Array.isArray(t.results)) {
      t.results.forEach((group, g) => {
        if (!Array.isArray(group) || g >= next.results.length) return;
        group.forEach((v, k) => {
          if (k < next.results[g].length && isStr(v)) next.results[g][k] = v;
        });
      });
    }
    if (isStr(t.record)) next.record = t.record;

    // Per text: the box it must fit in, a getter/setter on `next` and on `cur`
    const items = [
      ...next.titles.map((_, i) => ({
        path: `training.titles[${i}]`,
        kind: 'title',
        i,
        box: { lines: 1, columns: GAME_TEXTS.TITLE_LENGTH },
        fixed: true,
        get: (o) => o.titles[i],
        set: (o, v) => (o.titles[i] = v),
      })),
      ...next.intros.map((_, i) => ({
        path: `training.intros[${i}]`,
        kind: 'intro',
        i,
        box: GAME_TEXTS.INTRO_BOX,
        get: (o) => o.intros[i],
        set: (o, v) => (o.intros[i] = v),
      })),
      ...next.results.flatMap((group, g) =>
        group.map((_, k) => ({
          path: `training.results[${g}][${k}]`,
          kind: 'result',
          i: g * 4 + k,
          box: GAME_TEXTS.RESULT_BOX,
          get: (o) => o.results[g][k],
          set: (o, v) => (o.results[g][k] = v),
        })),
      ),
      {
        path: 'training.record',
        kind: 'record',
        box: GAME_TEXTS.RESULT_BOX,
        get: (o) => o.record,
        set: (o, v) => (o.record = v),
      },
      ...next.messages.map((_, i) => ({
        path: `training.messages[${i}]`,
        kind: 'message',
        i,
        box: GAME_TEXTS.MESSAGE_BOX,
        fixed: true,
        get: (o) => o.messages[i],
        set: (o, v) => (o.messages[i] = v),
      })),
    ];
    const changedItems = items.filter((it) => it.get(next) !== it.get(cur));
    for (const it of changedItems) {
      const text = it.get(next);
      invalidChars(it.path, it.fixed ? findInvalidIssChars(text) : findInvalidBoxChars(text));
    }
    // Texts that do not fit their own box
    for (const is of validateTrainingTexts(next)) {
      const it = items.find((x) => x.kind === is.kind && (x.i === undefined || x.i === is.index));
      if (!it || it.get(next) === it.get(cur)) continue;
      const lines = it.fixed
        ? wrapFixed(it.get(next), it.box.columns)
        : wrapScenarioText(it.get(next), it.box.columns);
      skipped.push(
        `${it.path}: ${lines.length} lines, max ${it.box.lines} (${it.box.columns} columns): ${showLines(lines)}`,
      );
      it.set(next, it.get(cur));
    }
    // Total space of the packed areas: drop the longest new texts until it fits
    for (const [kind, full, label] of [
      ['intro', 'introFull', 'instructions'],
      ['result', 'resultFull', 'result comments'],
    ]) {
      const area = items.filter(
        (x) =>
          (x.kind === kind || (kind === 'result' && x.kind === 'record')) &&
          x.get(next) !== x.get(cur),
      );
      area.sort((a, b) => b.get(next).length - a.get(next).length);
      while (validateTrainingTexts(next).some((x) => x.kind === full) && area.length) {
        const it = area.shift();
        skipped.push(
          `${it.path}: no room left in the ${label} area (shorten the texts of this group)`,
        );
        it.set(next, it.get(cur));
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      const res = work.writeTrainingTexts(next);
      if (res.ok) changed.training = items.filter((it) => it.get(next) !== it.get(cur)).length;
      else skipped.push('training: could not be written');
    }
  }

  // --- Menus ---
  if (data.menus && typeof data.menus === 'object') {
    const screens = work.readMenuScreens();
    const changes = [];
    for (const [id, entries] of Object.entries(data.menus)) {
      const screen = screens.find((s) => s.id === id);
      if (!screen) {
        warnings.push(`menus.${id}: unknown screen (ignored)`);
        continue;
      }
      if (!Array.isArray(entries)) continue;
      const texts = {};
      entries.forEach((e, n) => {
        if (!e || !isStr(e.text)) return;
        let text = e.text;
        let k = screen.runs.findIndex((r) => `${r.row},${r.col}` === e.at);
        // match by the text of the original ROM (the current one may already be translated)
        if (k < 0 && isStr(e.original)) k = screen.runs.findIndex((r) => r.original === e.original);
        // Older exports included the "1ST " / "2ND " the game draws by itself
        const ord = isStr(e.original) ? /^(1ST|2ND) (.*)$/.exec(e.original) : null;
        if (k < 0 && ord) {
          k = screen.runs.findIndex((r) => r.prefix === ord[1] && r.original === ord[2]);
          if (k >= 0) {
            const rest = text.startsWith(`${ord[1]} `)
              ? text.slice(4)
              : text.replace(/^\S+\s+/, '');
            warnings.push(
              `menus.${id} "${e.original}": the game draws "${ord[1]}" by itself, imported only "${rest}"`,
            );
            text = rest;
          }
        }
        if (k < 0) {
          warnings.push(`menus.${id}[${n}]: text "${e.original ?? e.at}" not found on the screen`);
          return;
        }
        const run = screen.runs[k];
        if (text === run.text) return;
        if (menuTextLength(text) > run.maxLength) {
          skipped.push(
            `menus.${id} "${run.text}" -> "${text}": ${menuTextLength(text)} letters, max ${run.maxLength}`,
          );
          return;
        }
        invalidChars(`menus.${id} "${run.text}"`, findInvalidMenuChars(text));
        texts[k] = text;
      });
      if (Object.keys(texts).length) changes.push({ screen, texts });
    }
    const results = writeMenuScreens(
      work,
      changes.map((c) => ({ offset: c.screen.offset, texts: c.texts })),
    );
    for (const { screen, texts } of changes) {
      const res = results.get(screen.offset);
      const n = Object.keys(texts).length;
      if (res?.ok) {
        changed.menus += n;
        if (res.moved) moved.push(screen.id);
      } else if (res?.error === 'menuScreenFull') {
        skipped.push(
          `menus.${screen.id}: ${n} text(s) not imported — the screen packs to ${res.size} bytes and the largest free room is ${res.capacity} (shorten a text by a few letters)`,
        );
      } else skipped.push(`menus.${screen.id}: ${res?.error || 'not written'}`);
    }
  }

  // --- Screen texts (drawn by code) ---
  if (data.screens && typeof data.screens === 'object') {
    const cur = work.readScreenTexts();
    const next = structuredClone(cur);
    const touched = [];
    for (const [id, entries] of Object.entries(data.screens)) {
      const screen = SCREEN_TEXTS.find((s) => s.id === id);
      if (!screen) {
        warnings.push(`screens.${id}: unknown screen (ignored)`);
        continue;
      }
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        if (!e || !isStr(e.text)) continue;
        const f = screen.fields.find((x) => x.id === e.id);
        if (!f) {
          warnings.push(`screens.${id}: unknown text "${e.id}" (ignored)`);
          continue;
        }
        if (e.text === cur[id][f.id]) continue;
        const path = `screens.${id}.${f.id}`;
        const res = encodeScreenField(f, e.text);
        if (res.error) {
          skipped.push(`${path} "${e.text}": ${screenFieldError(f, e.text, res)}`);
          continue;
        }
        invalidChars(path, res.invalid);
        next[id][f.id] = e.text;
        touched.push({ id, f, path });
      }
    }
    // Packed areas: drop the longest new texts until everything fits
    for (const [pack, m] of Object.entries(measureScreenPacks(next))) {
      if (m.used <= m.capacity) continue;
      const items = touched
        .filter((t) => t.f.pack === pack)
        .sort((a, b) => next[b.id][b.f.id].length - next[a.id][a.f.id].length);
      while (measureScreenPacks(next)[pack].used > m.capacity && items.length) {
        const it = items.shift();
        skipped.push(
          `${it.path}: no room left in the ${pack} area (shorten the texts of this group)`,
        );
        next[it.id][it.f.id] = cur[it.id][it.f.id];
        touched.splice(touched.indexOf(it), 1);
      }
    }
    if (touched.length) {
      const res = work.writeScreenTexts(next);
      if (res.ok) changed.screens = touched.length;
      else skipped.push('screens: could not be written');
    }
  }

  // --- Scenarios ---
  if (Array.isArray(data.scenarios)) {
    const cur = work.readScenarios();
    data.scenarios.forEach((e, n) => {
      const i = Number.isInteger(e?.index) ? e.index - 1 : n;
      if (!cur[i] || !isStr(e?.text) || e.text === cur[i].text) return;
      invalidChars(`scenarios[${i + 1}]`, findInvalidChars(e.text));
      const res = work.writeScenario(i, { ...work.readScenarios()[i], text: e.text });
      if (res.ok) changed.scenarios++;
      else {
        const lines = wrapScenarioText(e.text);
        skipped.push(
          `scenarios[${i + 1}]: ${
            res.error === 'scenarioTooManyLines'
              ? `${lines.length} lines, max ${SCENARIO_DATA.TEXT_LINES}: ${showLines(lines)}`
              : res.error === 'scenarioTextFull'
                ? `no room left in the scenario text area (${res.used} of ${res.capacity} bytes)`
                : res.error || 'does not fit'
          }`,
        );
      }
    });
  }

  // --- Team descriptions ---
  if (Array.isArray(data.teamDescriptions)) {
    const cur = readTeamDescriptions(work);
    const next = cur.map((d) => ({ ...d }));
    const touched = [];
    data.teamDescriptions.forEach((e, n) => {
      const i = isStr(e?.team) ? TEAMS.findIndex((t) => t.id === e.team) : n;
      if (i < 0 || !next[i]) {
        warnings.push(`teamDescriptions[${n}]: unknown team "${e?.team}"`);
        return;
      }
      const cand = { ...next[i] };
      if (isStr(e.title)) cand.title = e.title;
      if (isStr(e.body)) cand.body = e.body;
      if (cand.title === cur[i].title && cand.body === cur[i].body) return;
      const path = `teamDescriptions.${teamId(i)}`;
      const lines = wrapDescriptionBody(cand.body);
      if (cand.title.length > TEAM_DESC.COLUMNS) {
        skipped.push(
          `${path}: title "${cand.title}" has ${cand.title.length} letters, max ${TEAM_DESC.COLUMNS}`,
        );
        return;
      }
      if (lines.length > TEAM_DESC.BODY_LINES) {
        skipped.push(
          `${path}: body has ${lines.length} lines, max ${TEAM_DESC.BODY_LINES} (${TEAM_DESC.COLUMNS} columns): ${showLines(lines)}`,
        );
        return;
      }
      invalidChars(path, findInvalidChars(`${cand.title}${cand.body}`));
      next[i] = cand;
      touched.push(i);
    });
    // Total room: drop the longest new descriptions until everything fits
    touched.sort((a, b) => next[b].body.length - next[a].body.length);
    let res = touched.length ? writeTeamDescriptions(work, next) : { ok: true };
    while (!res.ok && touched.length) {
      const i = touched.shift();
      skipped.push(`teamDescriptions.${teamId(i)}: no room left in the descriptions area`);
      next[i] = cur[i];
      res = writeTeamDescriptions(work, next);
    }
    changed.teamDescriptions = touched.length;
  }

  if (Object.values(changed).some(Boolean)) {
    beforeCommit?.();
    romParser.getRomData().set(work.getRomData());
  }
  return { ok: true, errors, skipped, warnings, moved, changed };
}

/** Why a screen text does not fit, for the import report */
function screenFieldError(f, text, res) {
  if (res.error === 'tooManyLines') {
    const lines = f.kind === 'box' ? wrapScenarioText(text, f.columns) : wrapFixed(text, f.columns);
    return `${lines.length} lines, max ${f.lines} (${f.columns} columns): ${showLines(lines)}`;
  }
  if (res.error === 'tooLong') return `${res.cells} letters, max ${f.columns}`;
  return `${res.bytes?.length ?? '?'} bytes, max ${f.room ?? f.columns}`;
}

/** Lines of a fixed-length text as layoutFixed breaks them */
function wrapFixed(text, columns) {
  const out = [];
  for (const p of String(text).split('\n')) {
    if (menuTextLength(p) <= columns) out.push(p);
    else out.push(...wrapScenarioText(p, columns));
  }
  return out;
}
