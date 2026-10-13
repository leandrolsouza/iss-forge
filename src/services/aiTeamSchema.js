/**
 * AI team generation: the JSON schema the model must follow (structured output)
 * and the validation of what comes back.
 *
 * The schema is the contract between the prompt (buildSystemPrompt), the model and
 * sanitizeGeneratedTeam: keep the three in sync. It only uses keywords accepted by
 * OpenAI strict mode, Gemini, Anthropic tools and llama.cpp/LM Studio grammars
 * (type, properties, required, additionalProperties, items, minItems, maxItems,
 * minimum, maximum, enum, pattern, description).
 *
 * validateGeneratedTeam lists problems in English: they go back to the model in the
 * repair prompt and are shown as technical details in the preview.
 *  - errors: data that would be lost, cut or replaced by defaults (missing parts,
 *    wrong counts, names or texts that do not fit). They trigger a new attempt.
 *  - warnings: small things the sanitizer fixes without losing meaning.
 *
 * Some limits depend on the target slot and the rest of the ROM (menu name area,
 * shared description area): they come in an AI context (see buildAiContext).
 */
import {
  FORMATION_PRESETS,
  SCENARIO_TEXT_CHARSET,
  SHOOTING_VALUES,
  SPECIAL_HAIR,
  SPECIAL_SKIN,
} from '../rom/constants';
import { getFormationName, getPositionLabel, getPresetSlots } from '../rom/formation';
import { FLAG_TEMPLATES } from '../rom/flagTemplates';
import { HAIR_SKIN_TEMPLATES } from '../rom/hairSkinTemplates';
import { TEAM_DESC, encodeTeamDescription, wrapDescriptionBody } from '../rom/teamDescription';
import { textPixelWidth, IN_GAME_NAME_WIDTH } from '../rom/TeamNameTileFont';

export const AI_LIMITS = {
  players: 15,
  playerName: 8,
  /** what the menu name area takes at most; the real limit of a slot is in the context */
  teamNameText: 10,
  teamNameInGame: 7,
  maxHairStyle: 10,
  flagRows: 16,
  flagCols: 24,
  flagColors: 4,
  descriptionTitle: TEAM_DESC.COLUMNS,
  descriptionColumns: TEAM_DESC.COLUMNS,
  descriptionLines: TEAM_DESC.BODY_LINES,
};

/**
 * Limits of the target slot. `fitMenuName(text)` returns the menu name the ROM would
 * really get (shortened when the name area is full, null if nothing fits);
 * `descriptionBudget` is the number of bytes free for this team's description;
 * `fitsFlag(grid)` tells whether a flag design fits in the flag area;
 * `otherKits` lists the other teams' shirts ({ name, home, away } colors).
 * Without a ROM (tests, previews) only the fixed limits are checked.
 */
export const DEFAULT_AI_CONTEXT = {
  menuNameMax: 8,
  fitMenuName: null,
  descriptionBudget: null,
  fitsFlag: null,
  otherKits: [],
  sharedKeeperWith: [],
};

/** Every color list of the team: [path, number of colors] */
export const COLOR_PARTS = [
  ['uniforms.home.shirt', 3],
  ['uniforms.home.shorts', 3],
  ['uniforms.home.socks', 2],
  ['uniforms.away.shirt', 3],
  ['uniforms.away.shorts', 3],
  ['uniforms.away.socks', 2],
  ['uniforms.goalkeeper.shirtAndSocks', 5],
  ['uniforms.goalkeeper.shorts', 1],
  ['hairSkin.first.hair', 1],
  ['hairSkin.first.skin', 5],
  ['hairSkin.second.hair', 1],
  ['hairSkin.second.skin', 5],
  ['hairSkin.goalkeeper.hair', 1],
  ['hairSkin.goalkeeper.skin', 3],
  ['flagColors', 4],
];

/**
 * Formations the model can choose, from the game's own records (FORMATION_PRESETS):
 * `positions[i]` is where squad slot i plays (players 12-15 are substitutes).
 */
export const AI_FORMATIONS = FORMATION_PRESETS.map((preset) => {
  const slots = getPresetSlots(preset.id);
  return {
    id: preset.id,
    name: getFormationName(slots),
    label: preset.nameEn || preset.name,
    slots,
    positions: slots.map(getPositionLabel),
  };
});

export const findAiFormation = (id) => AI_FORMATIONS.find((f) => f.id === id) || null;

/** Team-wide presets used by players with isSpecial = true */
export const SPECIAL_HAIR_KEYS = SPECIAL_HAIR.TYPES.map((t) => t.key);
export const SPECIAL_SKIN_KEYS = SPECIAL_SKIN.TYPES.map((t) => t.key);

/** Description title colours: 0x2C (pink, "Offensive" teams) / 0x24 (green, "Defensive") */
export const DESCRIPTION_STYLES = { offensive: 0x2c, defensive: 0x24 };

/** Value of a template field that means "no template: everything is in the answer" */
export const CUSTOM_TEMPLATE = 'custom';

/** Clamp a flag design to 16 rows × 24 cells of 0-4 (missing cells transparent) */
export function normalizeFlagGrid(grid) {
  const rows = Array.isArray(grid) ? grid : [];
  return Array.from({ length: AI_LIMITS.flagRows }, (_, r) => {
    const src = Array.isArray(rows[r]) ? rows[r] : [];
    return Array.from({ length: AI_LIMITS.flagCols }, (_, col) => {
      const v = Number(src[col]);
      return Number.isFinite(v) ? Math.max(0, Math.min(4, Math.round(v))) : 0;
    });
  });
}

/**
 * Text preview of a flag for the prompt: 8 rows of 12 digits, each digit one 2×2
 * block (the rarest colour of the block wins, so thin crosses and stripes show).
 */
export function flagThumbnail(grid) {
  const counts = [0, 0, 0, 0, 0];
  grid.flat().forEach((v) => counts[v]++);
  const rows = [];
  for (let r = 0; r < AI_LIMITS.flagRows; r += 2) {
    let line = '';
    for (let c = 0; c < AI_LIMITS.flagCols; c += 2) {
      const block = [grid[r][c], grid[r][c + 1], grid[r + 1][c], grid[r + 1][c + 1]];
      line += block.reduce((best, v) => (counts[v] < counts[best] ? v : best));
    }
    rows.push(line);
  }
  return rows.join('/');
}

/** Ready-made flag designs (the editor's flag templates) the model can start from */
export const AI_FLAG_TEMPLATES = FLAG_TEMPLATES.map((tpl) => {
  const grid = normalizeFlagGrid(tpl.generate());
  return { id: tpl.id, grid, thumbnail: flagThumbnail(grid) };
});

const plainColors = (list) => list.map(({ r, g, b }) => ({ r, g, b }));

/** Hair & skin sets taken from teams of the original ROM */
export const AI_HAIR_SKIN_TEMPLATES = HAIR_SKIN_TEMPLATES.map((tpl) => ({
  id: tpl.id,
  baseTeam: tpl.baseTeam,
  hairSkin: {
    first: { hair: plainColors(tpl.outfield.hair), skin: plainColors(tpl.outfield.skin) },
    second: { hair: plainColors(tpl.outfield.hair), skin: plainColors(tpl.outfield.skin) },
    goalkeeper: { hair: plainColors(tpl.goalkeeper.hair), skin: plainColors(tpl.goalkeeper.skin) },
  },
}));

/**
 * hairSkin of an answer with its template applied: lists left empty come from the
 * template, filled lists override it (e.g. a template with a blond hair colour).
 */
export function resolveHairSkin(hairSkin) {
  const hs = hairSkin && typeof hairSkin === 'object' ? hairSkin : {};
  const tpl = AI_HAIR_SKIN_TEMPLATES.find((t) => t.id === hs.template);
  const out = { template: tpl ? tpl.id : CUSTOM_TEMPLATE };
  for (const kit of ['first', 'second', 'goalkeeper']) {
    out[kit] = {};
    for (const part of ['hair', 'skin']) {
      const given = hs[kit]?.[part];
      out[kit][part] =
        Array.isArray(given) && given.length ? given : tpl ? tpl.hairSkin[kit][part] : given;
    }
  }
  return out;
}

/**
 * Flag design of an answer: the drawn grid when there is one, else the template's.
 * @returns {{ grid: number[][]|null, template: string }} raw (not normalized) grid
 */
export function resolveFlagDesign(flagDesign) {
  const fd = flagDesign && typeof flagDesign === 'object' ? flagDesign : {};
  if (Array.isArray(fd.grid) && fd.grid.length) return { grid: fd.grid, template: CUSTOM_TEMPLATE };
  const tpl = AI_FLAG_TEMPLATES.find((t) => t.id === fd.template);
  return tpl
    ? { grid: tpl.grid.map((row) => [...row]), template: tpl.id }
    : { grid: null, template: CUSTOM_TEMPLATE };
}

const DEFENDER_POSITIONS = ['LB', 'CB', 'RB', 'SW'];
const FORWARD_POSITIONS = ['LW', 'ST', 'RW'];

// ─── Text helpers ────────────────────────────────────────────────────────────

/** Accents become plain letters ("JOSÉ" → "JOSE") so the character filter does not eat them */
export function stripAccents(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u00b4`]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');
}

/** Player name with only the characters the game font has (not cut to length) */
export function cleanPlayerName(text) {
  return stripAccents(text)
    .replace(/[^A-Za-z0-9.'"/ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Team name (menu / scoreboard): uppercase letters, digits, '.' and space */
export function cleanTeamName(text) {
  return stripAccents(text)
    .toUpperCase()
    .replace(/[^A-Z0-9. ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Description text with only the characters of the selection-screen font */
export function cleanDescriptionText(text, { multiline = false } = {}) {
  const chars = [...stripAccents(text)].filter(
    (ch) => SCENARIO_TEXT_CHARSET.includes(ch) || (multiline && ch === '\n'),
  );
  return chars
    .join('')
    .replace(/[ ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

// ─── Colors ──────────────────────────────────────────────────────────────────

/**
 * A color as the model may write it: {r,g,b}, [r,g,b] or "#RRGGBB".
 * Returns {r,g,b} (unclamped numbers) or null.
 */
export function readColor(c) {
  if (typeof c === 'string') {
    const m = c.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }
  if (Array.isArray(c)) {
    return c.length === 3 && c.every(Number.isFinite) ? { r: c[0], g: c[1], b: c[2] } : null;
  }
  if (c && typeof c === 'object' && [c.r, c.g, c.b].every(Number.isFinite)) {
    return { r: c.r, g: c.g, b: c.b };
  }
  return null;
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/** Average of a color list (null when there is none) */
export function averageColor(list) {
  const colors = (Array.isArray(list) ? list : []).map(readColor).filter(Boolean);
  if (!colors.length) return null;
  const sum = colors.reduce((s, c) => ({ r: s.r + c.r, g: s.g + c.g, b: s.b + c.b }), {
    r: 0,
    g: 0,
    b: 0,
  });
  return { r: sum.r / colors.length, g: sum.g / colors.length, b: sum.b / colors.length };
}

const colorDistance = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

/** Below this the two kits are hard to tell apart on screen */
const SIMILAR_KIT_DISTANCE = 60;
/** Below this a shirt looks like another team's */
const SAME_KIT_DISTANCE = 40;

/**
 * Predominant colour id of a shirt as the game groups them (0 white, 1 blue,
 * 2 red/orange, 3 yellow, 4 green): two teams with the same id clash and team 2
 * wears its second kit. Greys and black count as white, purple as blue.
 */
export function predominantColorOf(color) {
  if (!color) return 0;
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max < 0.25) return 0;
  let hue;
  if (max === r) hue = (60 * ((g - b) / (max - min)) + 360) % 360;
  else if (max === g) hue = 60 * ((b - r) / (max - min)) + 120;
  else hue = 60 * ((r - g) / (max - min)) + 240;
  if (hue < 40 || hue >= 330) return 2;
  if (hue < 75) return 3;
  if (hue < 170) return 4;
  return 1;
}

// ─── JSON schema ─────────────────────────────────────────────────────────────

const obj = (properties, description) => ({
  type: 'object',
  ...(description ? { description } : {}),
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const int = (minimum, maximum, description) => ({
  type: 'integer',
  minimum,
  maximum,
  ...(description ? { description } : {}),
});
const list = (items, count, description) => ({
  type: 'array',
  ...(description ? { description } : {}),
  items,
  minItems: count,
  maxItems: count,
});
const oneOf = (values, description) => ({
  type: 'string',
  enum: values,
  ...(description ? { description } : {}),
});
const color = obj({ r: int(0, 248), g: int(0, 248), b: int(0, 248) });
const colors = (count, description) => list(color, count, description);
/** 0 to `max` colours (hair/skin lists: empty = from the template) */
const colorsUpTo = (max) => ({ type: 'array', items: color, maxItems: max });
const oddStat = (description) =>
  int(1, 15, `${description}. Odd values only: ${SHOOTING_VALUES.join(', ')}`);

/** Regex character class of the description font */
const DESCRIPTION_CLASS = SCENARIO_TEXT_CHARSET.replace(/[\\\]^-]/g, '\\$&');

const playerSchema = obj({
  name: {
    type: 'string',
    description: `Max ${AI_LIMITS.playerName} characters, no accents`,
    pattern: `^[A-Za-z0-9.'"/ ]{1,${AI_LIMITS.playerName}}$`,
  },
  number: int(1, 16, 'Shirt number, unique in the team'),
  acceleration: int(1, 16, 'Speed when starting to run'),
  topSpeed: int(1, 16, 'Top running speed without the ball'),
  dribbleSpeed: int(1, 16, 'Top running speed with the ball'),
  stamina: int(1, 16),
  shooting: oddStat('Shot power'),
  technique: oddStat('Shot accuracy'),
  attack: int(1, 16, "Strength in ball duels in the opponent's half"),
  defense: int(1, 16, 'Strength in ball duels in the own half'),
  gkKick: oddStat('Goalkeeper kick power (only used when the player is in goal)'),
  hairStyle: int(0, AI_LIMITS.maxHairStyle),
  isSpecial: { type: 'boolean', description: 'Uses specialHair/specialSkin' },
});

/**
 * JSON schema of a generated team. `menuNameMax` is the menu name limit of the
 * target slot.
 */
export function buildTeamSchema({ menuNameMax = DEFAULT_AI_CONTEXT.menuNameMax } = {}) {
  const menuMax = Math.max(1, Math.min(AI_LIMITS.teamNameText, menuNameMax));
  return obj({
    name: { type: 'string', description: 'Descriptive display name, max 20 characters' },
    teamNameText: {
      type: 'string',
      description: `Menu name, max ${menuMax} characters, uppercase`,
      pattern: `^[A-Z0-9. ]{1,${menuMax}}$`,
    },
    teamNameInGame: {
      type: 'string',
      description: `Scoreboard name, max ${AI_LIMITS.teamNameInGame} characters, uppercase`,
      pattern: `^[A-Z0-9. ]{1,${AI_LIMITS.teamNameInGame}}$`,
    },
    formation: oneOf(
      AI_FORMATIONS.map((f) => f.id),
      'Formation id: decides the position of players 1-11',
    ),
    players: list(
      playerSchema,
      AI_LIMITS.players,
      'Players 1-11 in the order of the formation positions, 12-15 = substitutes',
    ),
    description: obj({
      style: oneOf(Object.keys(DESCRIPTION_STYLES), 'Title colour'),
      title: {
        type: 'string',
        description: `Max ${AI_LIMITS.descriptionTitle} characters, e.g. "Offensive 4-3-3"`,
        pattern: `^[${DESCRIPTION_CLASS}]{1,${AI_LIMITS.descriptionTitle}}$`,
      },
      body: {
        type: 'string',
        description: `Max ${AI_LIMITS.descriptionLines} lines of ${AI_LIMITS.descriptionColumns} characters`,
        pattern: `^[${DESCRIPTION_CLASS}\\n]{0,${AI_LIMITS.descriptionLines * AI_LIMITS.descriptionColumns}}$`,
      },
    }),
    specialHair: oneOf(SPECIAL_HAIR_KEYS, 'Hair of the isSpecial players'),
    specialSkin: oneOf(SPECIAL_SKIN_KEYS, 'Skin of the isSpecial players'),
    uniforms: obj({
      home: obj({ shirt: colors(3), shorts: colors(3), socks: colors(2) }),
      away: obj({ shirt: colors(3), shorts: colors(3), socks: colors(2) }),
      goalkeeper: obj({ shirtAndSocks: colors(5), shorts: colors(1) }),
    }),
    hairSkin: obj({
      template: oneOf(
        [...AI_HAIR_SKIN_TEMPLATES.map((t) => t.id), CUSTOM_TEMPLATE],
        'Hair/skin set of a real team; empty lists are taken from it',
      ),
      first: obj({ hair: colorsUpTo(1), skin: colorsUpTo(5) }),
      second: obj({ hair: colorsUpTo(1), skin: colorsUpTo(5) }),
      goalkeeper: obj({ hair: colorsUpTo(1), skin: colorsUpTo(3) }),
    }),
    flagColors: colors(AI_LIMITS.flagColors),
    flagDesign: obj({
      template: oneOf(
        [...AI_FLAG_TEMPLATES.map((t) => t.id), CUSTOM_TEMPLATE],
        'Ready-made design, or "custom" to draw the grid',
      ),
      grid: {
        type: 'array',
        description:
          '[] to use the template; for "custom" 16 rows of 24 cells: 0 = transparent, 1-4 = flagColors index',
        items: { type: 'array', items: int(0, 4), maxItems: AI_LIMITS.flagCols },
        maxItems: AI_LIMITS.flagRows,
      },
    }),
  });
}

/** Structured-output definition sent to the providers (see buildRequestBody) */
export function buildOutputSchema(context = DEFAULT_AI_CONTEXT) {
  return {
    name: 'iss_team',
    description: 'Complete team data for International Superstar Soccer (SNES)',
    schema: buildTeamSchema(context),
  };
}

/** Fields of each generation step (see AI_PARTS in aiService.js) */
export const PART_FIELDS = {
  squad: [
    'name',
    'teamNameText',
    'teamNameInGame',
    'formation',
    'players',
    'description',
    'specialHair',
    'specialSkin',
  ],
  look: ['uniforms', 'hairSkin', 'flagColors', 'flagDesign'],
};

const PART_SCHEMA_INFO = {
  squad: ['iss_team_squad', 'Squad of a team for International Superstar Soccer (SNES)'],
  look: ['iss_team_look', 'Kits, hair/skin colors and flag of a team for ISS (SNES)'],
};

/**
 * Structured-output definition of one step ('squad' or 'look'), or of the whole team
 * ('all'): the team schema with only that step's fields.
 */
export function buildPartSchema(context = DEFAULT_AI_CONTEXT, part = 'all') {
  if (!PART_FIELDS[part]) return buildOutputSchema(context);
  const full = buildTeamSchema(context);
  const keys = PART_FIELDS[part];
  const [name, description] = PART_SCHEMA_INFO[part];
  return {
    name,
    description,
    schema: {
      ...full,
      properties: Object.fromEntries(keys.map((k) => [k, full.properties[k]])),
      required: keys,
    },
  };
}

/** Only the fields of one step from an answer */
export function pickPart(data, part) {
  if (!PART_FIELDS[part] || !data || typeof data !== 'object') return data;
  return Object.fromEntries(PART_FIELDS[part].filter((k) => k in data).map((k) => [k, data[k]]));
}

/** Schema for a slot with the default limits */
export const TEAM_OUTPUT_SCHEMA = buildOutputSchema();

// ─── Description ─────────────────────────────────────────────────────────────

/**
 * The description as it will be written: allowed characters only, the formation
 * name of the title matching the chosen formation, body wrapped to the screen
 * (cut to its lines and, with a budget, to the free bytes).
 * @returns {{ title, titleColor, body } | null} null when not even the title fits
 */
export function fitDescription(desc, { formationName = null, budget = null } = {}) {
  if (!desc || typeof desc !== 'object') return null;
  let title = cleanDescriptionText(desc.title).slice(0, AI_LIMITS.descriptionTitle).trim();
  if (formationName && /\d-\d-\d/.test(title)) title = title.replace(/\d-\d-\d/, formationName);
  const titleColor = DESCRIPTION_STYLES[desc.style] ?? DESCRIPTION_STYLES.offensive;
  let lines = wrapDescriptionBody(cleanDescriptionText(desc.body, { multiline: true })).slice(
    0,
    AI_LIMITS.descriptionLines,
  );
  const build = () => ({ title, titleColor, body: lines.join('\n') });
  if (budget != null) {
    // drop words from the end until it fits
    while (encodeTeamDescription(build()).length > budget && lines.length) {
      const last = lines[lines.length - 1].replace(/\s*\S+$/, '');
      if (last) lines[lines.length - 1] = last;
      else lines = lines.slice(0, -1);
    }
    if (encodeTeamDescription(build()).length > budget) return null;
  }
  return build();
}

// ─── Validation ──────────────────────────────────────────────────────────────

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function nearestShootingValue(v) {
  return SHOOTING_VALUES.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best));
}

function validateNames(data, context, errors, warnings) {
  const menuMax = Math.min(AI_LIMITS.teamNameText, context.menuNameMax ?? AI_LIMITS.teamNameText);
  const menu = cleanTeamName(typeof data.teamNameText === 'string' ? data.teamNameText : '');
  if (!menu) {
    errors.push('teamNameText is missing');
  } else if (menu.length > menuMax) {
    errors.push(`teamNameText "${menu}" has ${menu.length} characters (max ${menuMax})`);
  } else if (context.fitMenuName) {
    const fitted = context.fitMenuName(menu);
    if (fitted !== menu) {
      errors.push(
        fitted
          ? `teamNameText "${menu}" does not fit in the menu name area: only "${fitted}" fits, use a shorter name`
          : 'the menu name area is full: no teamNameText fits',
      );
    }
  }

  const inGame = cleanTeamName(typeof data.teamNameInGame === 'string' ? data.teamNameInGame : '');
  if (!inGame) {
    warnings.push('teamNameInGame is missing: made from teamNameText');
  } else if (textPixelWidth(inGame) > IN_GAME_NAME_WIDTH) {
    errors.push(
      `teamNameInGame "${inGame}" is too wide for the scoreboard graphic (${IN_GAME_NAME_WIDTH} pixels): use a shorter form`,
    );
  }
}

function validatePlayers(data, errors, warnings) {
  const players = data.players;
  if (!Array.isArray(players)) {
    errors.push(`"players" must be an array of exactly ${AI_LIMITS.players} players`);
    return;
  }
  if (players.length !== AI_LIMITS.players) {
    errors.push(`"players" has ${players.length} entries (must be exactly ${AI_LIMITS.players})`);
  }
  const positions = findAiFormation(data.formation)?.positions || [];

  const numberOwner = new Map();
  players.slice(0, AI_LIMITS.players).forEach((p, i) => {
    const at = `players[${i}]`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      errors.push(`${at} is not a player object`);
      return;
    }

    const raw = typeof p.name === 'string' ? p.name : '';
    const name = cleanPlayerName(raw);
    if (!name) {
      errors.push(`${at}.name is missing or has no valid characters`);
    } else if (name.length > AI_LIMITS.playerName) {
      errors.push(
        `${at}.name "${name}" has ${name.length} characters (max ${AI_LIMITS.playerName}): use a recognizable short form`,
      );
    } else if (stripAccents(raw).replace(/\s+/g, ' ').trim() !== name) {
      warnings.push(`${at}.name "${raw}": unsupported characters removed ("${name}")`);
    }

    if (!Number.isInteger(p.number) || p.number < 1 || p.number > 16) {
      errors.push(`${at}.number must be an integer from 1 to 16`);
    } else if (numberOwner.has(p.number)) {
      errors.push(
        `${at}.number ${p.number} is already used by players[${numberOwner.get(p.number)}] (shirt numbers must be unique)`,
      );
    } else {
      numberOwner.set(p.number, i);
    }

    for (const key of ['shooting', 'technique']) {
      const v = p[key];
      if (!isNumber(v)) errors.push(`${at}.${key} is missing`);
      else if (!SHOOTING_VALUES.includes(v)) {
        warnings.push(`${at}.${key} ${v} changed to ${nearestShootingValue(v)} (odd values only)`);
      }
    }
    // the three speeds; an overall "speed" is accepted for all of them
    const speedKeys = ['acceleration', 'topSpeed', 'dribbleSpeed'];
    if (!speedKeys.every((k) => isNumber(p[k])) && isNumber(p.speed)) {
      warnings.push(`${at}: only "speed" given, used for acceleration, topSpeed and dribbleSpeed`);
    } else {
      for (const key of speedKeys) if (!isNumber(p[key])) errors.push(`${at}.${key} is missing`);
    }
    for (const key of ['stamina', 'attack', 'defense', ...speedKeys]) {
      const v = p[key];
      if (!isNumber(v)) {
        if (!speedKeys.includes(key)) errors.push(`${at}.${key} is missing`);
      } else if (!Number.isInteger(v) || v < 1 || v > 16) {
        warnings.push(`${at}.${key} ${v} changed to the 1-16 range`);
      }
    }
    if (!isNumber(p.gkKick)) {
      if (i === 0) warnings.push(`${at}.gkKick is missing (the slot's old value is kept)`);
    } else if (!SHOOTING_VALUES.includes(p.gkKick)) {
      warnings.push(`${at}.gkKick ${p.gkKick} changed to ${nearestShootingValue(p.gkKick)}`);
    }
    if (!isNumber(p.hairStyle)) {
      warnings.push(`${at}.hairStyle is missing (short hair used)`);
    } else if (!Number.isInteger(p.hairStyle) || p.hairStyle < 0 || p.hairStyle > 10) {
      warnings.push(`${at}.hairStyle ${p.hairStyle} changed to the 0-10 range`);
    }

    // players out of place for the formation (stats of a forward in defence...)
    const pos = positions[i];
    if (pos && isNumber(p.attack) && isNumber(p.defense)) {
      if (DEFENDER_POSITIONS.includes(pos) && p.attack - p.defense >= 5) {
        warnings.push(`${at} "${name}" has forward stats but plays ${pos} in this formation`);
      } else if (FORWARD_POSITIONS.includes(pos) && p.defense - p.attack >= 5) {
        warnings.push(`${at} "${name}" has defender stats but plays ${pos} in this formation`);
      }
    }
  });
}

function validateTeamSetup(data, context, errors, warnings) {
  const formation = findAiFormation(data.formation);
  if (!formation) {
    errors.push(
      `formation must be one of: ${AI_FORMATIONS.map((f) => f.id).join(', ')}${data.formation ? ` (got "${data.formation}")` : ''}`,
    );
  }

  for (const [key, keys] of [
    ['specialHair', SPECIAL_HAIR_KEYS],
    ['specialSkin', SPECIAL_SKIN_KEYS],
  ]) {
    if (!keys.includes(data[key])) {
      warnings.push(`${key} must be one of: ${keys.join(', ')} ("regular" used)`);
    }
  }

  const d = data.description;
  if (!d || typeof d !== 'object') {
    errors.push('description is missing ({ "style", "title", "body" })');
    return;
  }
  if (!(d.style in DESCRIPTION_STYLES)) {
    warnings.push('description.style must be "offensive" or "defensive" ("offensive" used)');
  }
  const title = cleanDescriptionText(d.title);
  if (!title) {
    errors.push('description.title is missing');
  } else if (title.length > AI_LIMITS.descriptionTitle) {
    errors.push(
      `description.title "${title}" has ${title.length} characters (max ${AI_LIMITS.descriptionTitle})`,
    );
  }
  const body = cleanDescriptionText(d.body, { multiline: true });
  const lines = wrapDescriptionBody(body);
  if (lines.length > AI_LIMITS.descriptionLines) {
    errors.push(
      `description.body takes ${lines.length} lines of ${AI_LIMITS.descriptionColumns} characters on screen (max ${AI_LIMITS.descriptionLines}): shorten it`,
    );
  }
  const typed = stripAccents(`${d.title ?? ''}${d.body ?? ''}`).replace(/\s+/g, '');
  if (typed !== `${title}${body}`.replace(/\s+/g, '')) {
    warnings.push('description: unsupported characters removed');
  }
  if (context.descriptionBudget != null && title) {
    const bytes = encodeTeamDescription({
      title: title.slice(0, AI_LIMITS.descriptionTitle),
      titleColor: 0x2c,
      body: lines.slice(0, AI_LIMITS.descriptionLines).join('\n'),
    }).length;
    if (bytes > context.descriptionBudget) {
      errors.push(
        `description takes ${bytes} bytes but only ${context.descriptionBudget} are free in the ROM: shorten the body to about ${Math.max(0, context.descriptionBudget - (bytes - body.length))} characters`,
      );
    }
  }
}

function validateColors(data, errors) {
  for (const section of ['uniforms', 'hairSkin']) {
    if (!data[section] || typeof data[section] !== 'object') {
      errors.push(`"${section}" is missing`);
    }
  }
  for (const [path, count] of COLOR_PARTS) {
    const section = path.split('.')[0];
    if (section !== 'flagColors' && (!data[section] || typeof data[section] !== 'object')) continue;
    const value = getPath(data, path);
    if (!Array.isArray(value)) {
      errors.push(`${path} is missing (needs ${count} color${count > 1 ? 's' : ''})`);
      continue;
    }
    if (value.length !== count) {
      errors.push(
        value.length === 0 && section === 'hairSkin'
          ? `${path} is empty: fill it or choose a hairSkin.template`
          : `${path} has ${value.length} colors (must be exactly ${count})`,
      );
    }
    const bad = value.slice(0, count).filter((c) => !readColor(c)).length;
    if (bad) errors.push(`${path}: ${bad} color(s) are not {"r","g","b"} numbers`);
  }
}

function validateFlag(data, context, errors, warnings) {
  const requested = data.flagDesign?.template;
  const { grid } = resolveFlagDesign(data.flagDesign);
  if (!Array.isArray(grid)) {
    errors.push(
      requested && requested !== CUSTOM_TEMPLATE
        ? `flagDesign.template "${requested}" does not exist: choose one of the list or "custom" with a grid`
        : `flagDesign: choose a template, or "custom" with a grid of ${AI_LIMITS.flagRows} rows of ${AI_LIMITS.flagCols} numbers`,
    );
    return;
  }
  const errorsBefore = errors.length;
  const badRows = grid.filter((row) => !Array.isArray(row) || row.length !== AI_LIMITS.flagCols);
  if (grid.length !== AI_LIMITS.flagRows || badRows.length) {
    const sizes = grid.map((row) => (Array.isArray(row) ? row.length : 0));
    errors.push(
      `flagDesign.grid must be exactly ${AI_LIMITS.flagRows} rows of ${AI_LIMITS.flagCols} numbers (got ${grid.length} rows, row lengths ${[...new Set(sizes)].join('/')})`,
    );
  }
  const cells = grid.flat();
  const badCells = cells.filter((v) => !Number.isInteger(v) || v < 0 || v > 4).length;
  if (badCells) errors.push(`flagDesign.grid has ${badCells} cell(s) that are not integers 0-4`);
  if (new Set(cells.filter((v) => Number.isInteger(v) && v > 0)).size < 2) {
    warnings.push('flagDesign.grid uses a single color: the flag will show no design');
  }
  // compressed designs share one area of the ROM: too much detail does not fit
  if (
    errors.length === errorsBefore &&
    context.fitsFlag &&
    !context.fitsFlag(normalizeFlagGrid(grid))
  ) {
    errors.push(
      'the flag design does not fit in the flag space of the ROM (too much detail): use larger areas of one color, or a template',
    );
  }
}

function validateLooks(data, context, warnings) {
  const home = averageColor(data.uniforms?.home?.shirt);
  const away = averageColor(data.uniforms?.away?.shirt);
  const keeper = averageColor(data.uniforms?.goalkeeper?.shirtAndSocks);
  if (home && away && colorDistance(home, away) < SIMILAR_KIT_DISTANCE) {
    warnings.push('home and away shirts are almost the same color');
  }
  if (home && keeper && colorDistance(home, keeper) < SIMILAR_KIT_DISTANCE) {
    warnings.push('goalkeeper shirt is almost the same color as the home shirt');
  }
  if (context.sharedKeeperWith?.length && data.uniforms?.goalkeeper) {
    warnings.push(
      `the goalkeeper kit and goalkeeper hair/skin of this slot are shared with ${context.sharedKeeperWith.join(', ')}: its goalkeeper changes too`,
    );
  }
  if (home) {
    const twins = (context.otherKits || [])
      .filter((kit) => kit.home && colorDistance(home, kit.home) < SAME_KIT_DISTANCE)
      .map((kit) => kit.name);
    if (twins.length) {
      warnings.push(
        `home shirt is almost the same color as ${twins.slice(0, 3).join(', ')}${twins.length > 3 ? ` and ${twins.length - 3} more` : ''}`,
      );
    }
  }
}

/**
 * Check the raw object parsed from the model's answer (before sanitizing).
 * @param {object} data
 * @param {object} [context] - limits of the target slot (see DEFAULT_AI_CONTEXT)
 * @param {'all'|'squad'|'look'} [part] - only the checks of one generation step
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateGeneratedTeam(data, context = DEFAULT_AI_CONTEXT, part = 'all') {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: ['the answer must be one JSON object with the team data'], warnings };
  }
  const ctx = { ...DEFAULT_AI_CONTEXT, ...context };

  if (part !== 'look') {
    validateNames(data, ctx, errors, warnings);
    validateTeamSetup(data, ctx, errors, warnings);
    validatePlayers(data, errors, warnings);
  }

  if (part !== 'squad') {
    // templates fill what the answer leaves empty
    const resolved = {
      ...data,
      ...(data.hairSkin && typeof data.hairSkin === 'object'
        ? { hairSkin: resolveHairSkin(data.hairSkin) }
        : {}),
    };
    const hairTemplate = data.hairSkin?.template;
    if (
      hairTemplate &&
      hairTemplate !== CUSTOM_TEMPLATE &&
      !AI_HAIR_SKIN_TEMPLATES.some((t) => t.id === hairTemplate)
    ) {
      warnings.push(`hairSkin.template "${hairTemplate}" does not exist (treated as "custom")`);
    }
    validateColors(resolved, errors);
    validateFlag(data, ctx, errors, warnings);
    validateLooks(data, ctx, warnings);
  }

  return { errors, warnings };
}

/** Max problems listed back to the model (keeps the repair prompt short) */
const MAX_LISTED_PROBLEMS = 25;

/**
 * User prompt of a new attempt: the original request, what was wrong and the
 * previous answer (when it could be read), asking for the full corrected object.
 * @param {string} userPrompt - the user's original request
 * @param {string|null} previous - previous answer as compact JSON (null if unreadable)
 * @param {string[]} problems
 */
export function buildRepairPrompt(userPrompt, previous, problems) {
  const listed = problems.slice(0, MAX_LISTED_PROBLEMS).map((p) => `- ${p}`);
  if (problems.length > MAX_LISTED_PROBLEMS) {
    listed.push(`- ...and ${problems.length - MAX_LISTED_PROBLEMS} more of the same kind`);
  }
  return [
    userPrompt,
    '',
    '---',
    'Your previous answer could not be used as it was. Problems found:',
    ...listed,
    '',
    previous
      ? `Previous answer:\n${previous}\n\nReturn the complete corrected JSON object. Keep everything that was right and change only what is needed to fix the problems.`
      : 'Return one complete, valid JSON object following all the rules.',
  ].join('\n');
}
