/**
 * AI championship generator: a whole league (e.g. "Brasileirao 2002") in the team slots.
 *
 *  1. Plan (one request, reviewed by the user): the clubs in final-standing order,
 *     completed with the best-placed clubs of the division below when the league has
 *     fewer clubs than the game has slots. Menu and scoreboard names are checked
 *     together against the shared name areas of the ROM.
 *  2. Teams: each club goes through generateTeam with its line of the plan, the other
 *     clubs' colours and its share of the shared ROM areas (descriptions, flags), so
 *     all of them fit once written.
 *  3. Apply (applyLeague): every generated team at once — one undo step.
 */
import { TEAMS } from '../rom/constants';
import RomParser from '../rom/RomParser';
import { sharedKeeperTeams } from '../rom/readers/UniformReader';
import {
  TEAM_DESC_CAPACITY,
  encodeTeamDescription,
  measureTeamDescriptions,
  writeTeamDescriptions,
} from '../rom/teamDescription';
import { textPixelWidth, IN_GAME_NAME_WIDTH } from '../rom/TeamNameTileFont';
import { flagAreaUsage, flagDesignSize } from '../rom/writers/FlagDesignWriter';
import { applyImportedTeam } from '../utils/teamExport';
import {
  AI_FORMATIONS,
  AI_LIMITS,
  DEFAULT_AI_CONTEXT,
  averageColor,
  cleanPlayerName,
  cleanTeamName,
  findAiFormation,
  readColor,
} from './aiTeamSchema';
import { generateTeam, requestValidated } from './aiService';

/** Slots a championship fills: every selectable team (Super Star stays as it is) */
export const LEAGUE_SLOTS = TEAMS.map((_, i) => i).filter((i) => TEAMS[i].id !== 'SUPERSTAR');

export const LEAGUE_LIMITS = {
  name: 20,
  menuName: 8,
  inGameName: AI_LIMITS.teamNameInGame,
  stars: 4,
  brief: 500,
};

// ─── Plan schema and prompt ──────────────────────────────────────────────────

const obj = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = (description, pattern) => ({
  type: 'string',
  description,
  ...(pattern ? { pattern } : {}),
});
const int = (minimum, maximum, description) => ({ type: 'integer', minimum, maximum, description });
const oneOf = (values, description) => ({ type: 'string', enum: values, description });
const HEX = '^#[0-9A-Fa-f]{6}$';

/** Structured-output definition of the plan */
export function buildPlanSchema(slotCount = LEAGUE_SLOTS.length) {
  const club = obj({
    name: str('Usual club name, no accents, max 20 characters'),
    menuName: str(
      `Selection menu name, max ${LEAGUE_LIMITS.menuName} characters, uppercase`,
      `^[A-Z0-9. ]{1,${LEAGUE_LIMITS.menuName}}$`,
    ),
    inGameName: str(
      `Scoreboard name, max ${LEAGUE_LIMITS.inGameName} characters, uppercase`,
      `^[A-Z0-9. ]{1,${LEAGUE_LIMITS.inGameName}}$`,
    ),
    division: oneOf(['main', 'lower'], 'main = the requested competition'),
    position: int(1, 60, 'Final position in its division'),
    strength: int(1, 10, 'Squad strength compared with the other clubs of this list'),
    formation: oneOf(
      AI_FORMATIONS.map((f) => f.id),
      'Usual formation',
    ),
    style: oneOf(['offensive', 'defensive'], 'Way of playing'),
    homeShirt: str('Main color of the home shirt', HEX),
    awayShirt: str('Main color of the away shirt', HEX),
    stars: {
      type: 'array',
      description: 'Key players of that season, max 8 letters each',
      items: str('Player name', `^[A-Za-z0-9.'" ]{1,${AI_LIMITS.playerName}}$`),
      maxItems: LEAGUE_LIMITS.stars,
    },
    brief: str('1-3 short sentences for the team generator'),
  });
  return {
    name: 'iss_league_plan',
    description: 'Clubs of a championship for International Superstar Soccer (SNES)',
    schema: obj({
      competition: obj({
        name: str('Competition name'),
        season: str('Season, e.g. "2002" or "1998/99"'),
        lowerDivision: str('Name of the division below (the clubs that complete the list)'),
      }),
      teams: {
        type: 'array',
        items: club,
        minItems: slotCount,
        maxItems: slotCount,
      },
    }),
  };
}

/** System prompt of the plan step */
export function buildPlanPrompt(slotCount = LEAGUE_SLOTS.length) {
  return `You plan a football championship for International Superstar Soccer (SNES, 1995). The game has exactly ${slotCount} team slots, and all of them will be replaced by the clubs of the championship the user asks for.

# THE LIST (exactly ${slotCount} clubs)
1. Every club of the requested competition and season, in FINAL league position order (champion first): division "main", position = final position.
2. If the competition has fewer than ${slotCount} clubs, complete the list with the best-placed clubs of the division immediately below in the same season (e.g. Brazilian Serie A → Serie B, Premier League → Championship, La Liga → Segunda Division, Serie A → Serie B), in their final position there: division "lower", position = final position in that division.
3. If it has more than ${slotCount} clubs, keep the ${slotCount} best placed.
4. No club twice. Use the real data of that season as well as you know it.

# EACH CLUB
- name: the usual club name, max ${LEAGUE_LIMITS.name} characters, no accents.
- menuName: max ${LEAGUE_LIMITS.menuName} UPPERCASE characters (A-Z, 0-9, '.', space) for the selection menu, recognizable (e.g. FLAMENGO, S.PAULO, ATL.MG, MAN UTD). All ${slotCount} menu names share a small area of the ROM: prefer short forms (5-7 letters) for long names.
- inGameName: max ${LEAGUE_LIMITS.inGameName} UPPERCASE characters for the scoreboard (e.g. FLA, SPFC, ARSENAL).
- strength: 1-10 compared with the other clubs of THIS list (champion 9-10, mid-table 5-7, relegated 3-4, lower division 2-5).
- formation: the usual formation, one of ${AI_FORMATIONS.map((f) => `"${f.id}" (${f.label})`).join(', ')}.
- style: "offensive" or "defensive".
- homeShirt / awayShirt: main shirt colors of that season as "#RRGGBB".
- stars: up to ${LEAGUE_LIMITS.stars} key players of that season, max ${AI_LIMITS.playerName} letters each, no accents (short forms or nicknames).
- brief: 1-3 short sentences for the team generator: coach, key players and their positions, way of playing, shorts/socks colors, crest idea for the flag. Write it in the language of the user's request.

# OUTPUT
Return ONLY a valid JSON object, no markdown fences:
{
  "competition": { "name": "Campeonato Brasileiro Serie A", "season": "2002", "lowerDivision": "Serie B" },
  "teams": [
    {
      "name": "Santos",
      "menuName": "SANTOS",
      "inGameName": "SANTOS",
      "division": "main",
      "position": 1,
      "strength": 9,
      "formation": "442-box",
      "style": "offensive",
      "homeShirt": "#F8F8F8",
      "awayShirt": "#101010",
      "stars": ["Robinho", "Diego", "Elano"],
      "brief": "..."
    }
  ]
}
Include all ${slotCount} clubs.`;
}

// ─── Plan validation ─────────────────────────────────────────────────────────

const toHex = (c) =>
  c
    ? `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('')}`
    : '-';

/** Scoreboard name the game can draw: font letters only, cut to the 32-pixel graphic */
function fitScoreboardName(text) {
  let name = cleanTeamName(text).slice(0, LEAGUE_LIMITS.inGameName);
  while (name.length > 1 && textPixelWidth(name) > IN_GAME_NAME_WIDTH) {
    name = name.slice(0, -1).trimEnd();
  }
  return name;
}

/**
 * The plan in a fixed shape: clubs of the competition first, then the ones of the
 * division below, each group in final-position order, cut to `slotCount`.
 */
export function sanitizeLeaguePlan(data, slotCount = LEAGUE_SLOTS.length) {
  const c = data?.competition && typeof data.competition === 'object' ? data.competition : {};
  const raw = Array.isArray(data?.teams) ? data.teams : [];
  const teams = raw
    .filter((t) => t && typeof t === 'object' && !Array.isArray(t))
    .map((t, order) => {
      const name = cleanPlayerName(t.name).slice(0, LEAGUE_LIMITS.name) || `CLUB ${order + 1}`;
      const menuName =
        cleanTeamName(t.menuName || t.name).slice(0, LEAGUE_LIMITS.menuName) ||
        cleanTeamName(name).slice(0, LEAGUE_LIMITS.menuName);
      return {
        name,
        menuName,
        inGameName: fitScoreboardName(t.inGameName || menuName) || menuName.slice(0, 3),
        division: t.division === 'lower' ? 'lower' : 'main',
        position: Number.isInteger(t.position) ? t.position : order + 1,
        strength: Math.max(1, Math.min(10, Math.round(Number(t.strength)) || 5)),
        formation: findAiFormation(t.formation)?.id || null,
        style: t.style === 'defensive' ? 'defensive' : 'offensive',
        homeShirt: readColor(t.homeShirt),
        awayShirt: readColor(t.awayShirt),
        stars: (Array.isArray(t.stars) ? t.stars : [])
          .map((s) => cleanPlayerName(s).slice(0, AI_LIMITS.playerName))
          .filter(Boolean)
          .slice(0, LEAGUE_LIMITS.stars),
        brief: String(t.brief || '')
          .trim()
          .slice(0, LEAGUE_LIMITS.brief),
        order,
      };
    });
  teams.sort(
    (a, b) =>
      (a.division === 'lower') - (b.division === 'lower') ||
      a.position - b.position ||
      a.order - b.order,
  );
  return {
    competition: {
      name: String(c.name || '').trim(),
      season: String(c.season || '').trim(),
      lowerDivision: String(c.lowerDivision || '').trim(),
    },
    teams: teams.slice(0, slotCount).map(({ order: _order, ...t }) => t),
  };
}

/**
 * Dry run of the names on a copy of the ROM, as applyLeague writes them: the menu
 * names and scoreboard graphics of every slot share two areas (writing short
 * placeholders first frees all the room the slots have).
 * @returns {{ menu: string|null, inGameOk: boolean }[]} what each club would really get
 */
export function leagueNameFit(romParser, slots, teams) {
  const rom = new RomParser(romParser.getRomData(), romParser.getOriginalData());
  const used = slots.slice(0, teams.length);
  used.forEach((slot) => {
    rom.writeTeamNameMenu(slot, 'A');
    rom.writeTeamNameInGame(slot, ' ');
  });
  return used.map((slot, i) => {
    const menu = rom.fitTeamNameMenu(slot, teams[i].menuName);
    rom.writeTeamNameMenu(slot, teams[i].menuName);
    return { menu, inGameOk: rom.writeTeamNameInGame(slot, teams[i].inGameName) };
  });
}

/**
 * Problems of a plan answer (English: they go back to the model).
 * @param {object} data - raw answer
 * @param {{ slotCount?: number, fitNames?: function }} [ctx] - fitNames(teams) is
 *   leagueNameFit bound to the ROM and the slots
 */
export function validateLeaguePlan(
  data,
  { slotCount = LEAGUE_SLOTS.length, fitNames = null } = {},
) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object' || !Array.isArray(data.teams)) {
    return {
      errors: ['the answer must be a JSON object with "competition" and "teams"'],
      warnings,
    };
  }
  if (data.teams.length !== slotCount) {
    errors.push(
      `"teams" has ${data.teams.length} clubs (must be exactly ${slotCount}: complete with the best-placed clubs of the division below, or keep the ${slotCount} best placed)`,
    );
  }
  const seenNames = new Map();
  const seenMenu = new Map();
  data.teams.forEach((t, i) => {
    const at = `teams[${i}]`;
    if (!t || typeof t !== 'object') {
      errors.push(`${at} is not a club object`);
      return;
    }
    const name = cleanPlayerName(t.name);
    if (!name) errors.push(`${at}.name is missing`);
    else if (seenNames.has(name.toLowerCase())) {
      errors.push(
        `${at} "${name}" is already in the list (teams[${seenNames.get(name.toLowerCase())}])`,
      );
    } else seenNames.set(name.toLowerCase(), i);

    const menu = cleanTeamName(t.menuName);
    if (!menu) errors.push(`${at}.menuName is missing`);
    else if (menu.length > LEAGUE_LIMITS.menuName) {
      errors.push(
        `${at}.menuName "${menu}" has ${menu.length} characters (max ${LEAGUE_LIMITS.menuName})`,
      );
    } else if (seenMenu.has(menu)) {
      errors.push(`${at}.menuName "${menu}" is also used by teams[${seenMenu.get(menu)}]`);
    } else seenMenu.set(menu, i);

    const inGame = cleanTeamName(t.inGameName);
    if (!inGame) warnings.push(`${at}.inGameName is missing: made from menuName`);
    else if (
      inGame.length > LEAGUE_LIMITS.inGameName ||
      textPixelWidth(inGame) > IN_GAME_NAME_WIDTH
    ) {
      errors.push(
        `${at}.inGameName "${inGame}" is too wide for the scoreboard: use a shorter form`,
      );
    }
    if (!String(t.brief || '').trim()) errors.push(`${at}.brief is missing`);
    if (!readColor(t.homeShirt)) warnings.push(`${at}.homeShirt is not a "#RRGGBB" color`);
    if (t.formation && !findAiFormation(t.formation)) {
      warnings.push(`${at}.formation "${t.formation}" does not exist (the generator chooses one)`);
    }
  });

  const lowerBeforeMain = data.teams.findIndex((t) => t?.division === 'lower');
  if (
    lowerBeforeMain >= 0 &&
    data.teams.slice(lowerBeforeMain).some((t) => t?.division === 'main')
  ) {
    warnings.push('clubs of the lower division were listed before main ones: the list was sorted');
  }

  if (fitNames && !errors.length) {
    const plan = sanitizeLeaguePlan(data, slotCount);
    const fit = fitNames(plan.teams);
    const cut = plan.teams
      .map((t, i) => ({ t, f: fit[i] }))
      .filter(({ t, f }) => f && f.menu !== t.menuName);
    if (cut.length) {
      const letters = cut.reduce((n, { t, f }) => n + t.menuName.length - (f.menu || '').length, 0);
      errors.push(
        `the menu names do not fit together in the ROM name area: about ${letters} letter(s) too many (${cut
          .slice(0, 4)
          .map(({ t, f }) => `"${t.menuName}" would become "${f.menu || ''}"`)
          .join(', ')}). Use shorter menuNames (5-7 letters) for the clubs with long names`,
      );
    }
    const noTiles = plan.teams.filter((t, i) => fit[i] && !fit[i].inGameOk);
    if (noTiles.length) {
      errors.push(
        `the scoreboard names do not fit together in the ROM: use shorter inGameNames (e.g. 3-4 letters), starting with ${noTiles
          .slice(0, 4)
          .map((t) => `"${t.inGameName}"`)
          .join(', ')}`,
      );
    }
  }
  return { errors, warnings };
}

/**
 * Ask for the plan of a championship, with corrections.
 * @returns {Promise<{ plan, errors, warnings, attempts }>}
 */
export async function generateLeaguePlan({
  userPrompt,
  settings,
  romParser = null,
  slots = LEAGUE_SLOTS,
  ...options
}) {
  const slotCount = slots.length;
  const fitNames = romParser ? (teams) => leagueNameFit(romParser, slots, teams) : null;
  const result = await requestValidated({
    systemPrompt: buildPlanPrompt(slotCount),
    schema: buildPlanSchema(slotCount),
    userPrompt,
    settings,
    attemptInfo: { part: 'plan' },
    validate: (data) => ({ raw: data, ...validateLeaguePlan(data, { slotCount, fitNames }) }),
    ...options,
  });
  return { ...result, plan: sanitizeLeaguePlan(result.raw, slotCount) };
}

/** Problems of a plan edited by the user (names that no longer fit, duplicates) */
export function checkLeaguePlan(romParser, slots, plan) {
  const data = {
    competition: plan.competition,
    teams: plan.teams.map((t) => ({ ...t, homeShirt: toHex(t.homeShirt) })),
  };
  return validateLeaguePlan(data, {
    slotCount: plan.teams.length,
    fitNames: romParser ? (teams) => leagueNameFit(romParser, slots, teams) : null,
  });
}

// ─── Team generation ─────────────────────────────────────────────────────────

/**
 * Share of the shared ROM areas for each club, so all of them fit once written:
 * description bytes (all written together) and flag bytes (each slot may use its own
 * blocks plus an equal part of the free space).
 */
export function leagueBudgets(romParser, slots) {
  let description = null;
  try {
    const all = romParser.readTeamDescriptions();
    const empty = { title: '', titleColor: 0x2c, body: '' };
    slots.forEach((slot) => {
      all[slot] = empty;
    });
    const free = TEAM_DESC_CAPACITY - measureTeamDescriptions(all, romParser);
    description =
      encodeTeamDescription(empty).length + Math.floor(Math.max(0, free) / slots.length);
  } catch {
    // description area not readable: only the fixed limits are checked
  }
  let flag = null;
  try {
    const { free, ownSize } = flagAreaUsage(romParser);
    const extra = Math.floor(free / slots.length);
    flag = Object.fromEntries(slots.map((slot) => [slot, ownSize[slot] + extra]));
  } catch {
    // flag area not readable
  }
  return { description, flag };
}

/** Request of one club for generateTeam: its line of the plan, in full */
export function buildLeagueTeamRequest(plan, index, userRequest = '') {
  const t = plan.teams[index];
  const c = plan.competition;
  const where =
    t.division === 'lower'
      ? `${c.lowerDivision || 'lower division'} ${c.season} (completes the league), final position ${t.position}`
      : `final position ${t.position}`;
  return [
    userRequest ? `Championship: ${userRequest}` : '',
    `Club: ${t.name} — ${[c.name, c.season].filter(Boolean).join(' ')}, ${where}.`,
    `Strength ${t.strength}/10 compared with the other clubs of this championship: scale every attribute to it (10 = the best squad of the league, 1 = the weakest).`,
    t.brief,
    t.stars.length ? `Key players: ${t.stars.join(', ')}.` : '',
    [
      t.formation ? `Formation "${t.formation}"` : '',
      `${t.style} style`,
      t.homeShirt ? `home shirt ${toHex(t.homeShirt)}` : '',
      t.awayShirt ? `away shirt ${toHex(t.awayShirt)}` : '',
    ]
      .filter(Boolean)
      .join(', ') + '.',
    `Use teamNameText "${t.menuName}" and teamNameInGame "${t.inGameName}".`,
    'Use the real squad of that season as well as you know it.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Generation context of one club: its slot, its share of the shared areas and the
 * colours of every other club of the league (generated ones, or planned ones).
 * @param {object} results - { [index]: { team } } clubs already generated
 */
export function buildLeagueTeamContext(romParser, plan, slots, index, budgets, results = {}) {
  const slot = slots[index];
  const inLeague = new Map(slots.map((s, i) => [s, i]));
  const otherKits = [];
  plan.teams.forEach((t, i) => {
    if (i === index) return;
    const team = results[i]?.team;
    otherKits.push({
      name: t.menuName,
      home: team ? averageColor(team.uniforms.home.shirt) : t.homeShirt,
      away: team ? averageColor(team.uniforms.away.shirt) : t.awayShirt,
    });
  });
  TEAMS.forEach((info, i) => {
    if (inLeague.has(i)) return;
    const kits = romParser.readUniformColors(i);
    otherKits.push({
      name: romParser.readTeamNameText(i) || info.name,
      home: averageColor(kits.home.shirt),
      away: averageColor(kits.away.shirt),
    });
  });
  const flagBudget = budgets.flag?.[slot];
  return {
    ...DEFAULT_AI_CONTEXT,
    teamIndex: slot,
    // the plan's names are used (checked together for the shared name areas)
    menuNameMax: AI_LIMITS.teamNameText,
    descriptionBudget: budgets.description,
    fitsFlag: flagBudget != null ? (grid) => flagDesignSize(grid) <= flagBudget : null,
    otherKits: otherKits.filter((k) => k.home),
    sharedKeeperWith: sharedKeeperTeams(slot).map((s) =>
      inLeague.has(s)
        ? plan.teams[inLeague.get(s)]?.name || TEAMS[s].name
        : romParser.readTeamNameText(s) || TEAMS[s].name,
    ),
  };
}

/**
 * Generate one club of the plan (generateTeam with the league request and context);
 * the names of the plan are kept.
 */
export async function generateLeagueTeam({
  romParser,
  plan,
  slots,
  index,
  userRequest,
  budgets,
  results,
  ...options
}) {
  const entry = plan.teams[index];
  const result = await generateTeam({
    userPrompt: buildLeagueTeamRequest(plan, index, userRequest),
    context: buildLeagueTeamContext(romParser, plan, slots, index, budgets, results),
    ...options,
  });
  result.team = {
    ...result.team,
    name: entry.name,
    teamNameText: entry.menuName,
    teamNameInGame: entry.inGameName,
  };
  return result;
}

/**
 * Run `worker(item)` for every item, `concurrency` at a time; stops starting new
 * ones when `shouldStop()` is true. The worker handles its own errors.
 */
export async function runQueue(items, worker, { concurrency = 1, shouldStop = () => false } = {}) {
  let next = 0;
  const lanes = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (next < items.length && !shouldStop()) {
        const item = items[next++];
        await worker(item);
      }
    },
  );
  await Promise.all(lanes);
}

/** Requests at a time: a local server answers one at a time, cloud APIs take a few */
export function defaultConcurrency(providerId) {
  return !providerId || providerId === 'openai-compatible' ? 1 : 3;
}

// ─── Apply ───────────────────────────────────────────────────────────────────

/**
 * Write the generated clubs. Names first get short placeholders (so the shared name
 * areas have all their room), descriptions are written together at the end.
 * @param {RomParser} romParser
 * @param {{ slot: number, team: object }[]} items
 * @returns {{ warnings: string[] }} i18n keys
 */
export function applyLeague(romParser, items) {
  const warnings = new Set();
  items.forEach(({ slot }) => {
    romParser.writeTeamNameMenu(slot, 'A');
    romParser.writeTeamNameInGame(slot, ' ');
  });
  const descriptions = romParser.readTeamDescriptions();
  for (const { slot, team } of items) {
    // keepers only have graphics for hair style 0 (also fixes drafts generated before)
    const players = team.players?.map((p, i) => (i === 0 ? { ...p, hairStyle: 0 } : p));
    applyImportedTeam(romParser, slot, { ...team, players, description: null }).warnings.forEach(
      (w) => warnings.add(w),
    );
    if (team.description) descriptions[slot] = team.description;
  }
  if (items.some(({ team }) => team.description)) {
    const written = writeTeamDescriptions(romParser, descriptions);
    if (!written.ok) warnings.add('descFull');
  }
  return { warnings: [...warnings] };
}

// ─── Draft (kept between sessions) ───────────────────────────────────────────

const DRAFT_PREFIX = 'iss-forge-ai-league:';

/** The championship being made for a ROM / project ({ request, plan, slots, results }) */
export function loadLeagueDraft(key) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLeagueDraft(key, draft) {
  try {
    if (draft) localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_PREFIX + key);
    return true;
  } catch {
    return false; // storage full: the draft lives until the panel closes
  }
}

/** A cancelled or failed run as stored: running clubs go back to the queue */
export function settleDraftResults(results = {}) {
  return Object.fromEntries(
    Object.entries(results).map(([i, r]) => [
      i,
      r?.status === 'running' ? { ...r, status: r.team ? 'done' : 'pending' } : r,
    ]),
  );
}
