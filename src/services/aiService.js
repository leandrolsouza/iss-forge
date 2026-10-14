/**
 * AI Service — Prompt builder and LLM interaction for team generation
 *
 * Builds a system prompt with ROM constraints, asks for structured output
 * (buildOutputSchema), validates what the model returns and, when something
 * important is wrong, asks again with the list of problems (generateTeam).
 * The result follows the iss-forge-team JSON format used by applyImportedTeam.
 */
import { SHOOTING_VALUES, SPECIAL_HAIR, SPECIAL_SKIN, TEAMS } from '../rom/constants';
import RomParser from '../rom/RomParser';
import { sharedKeeperTeams } from '../rom/readers/UniformReader';
import { clampStat, gameSpeed } from '../rom/playerStats';
import {
  TEAM_DESC_CAPACITY,
  encodeTeamDescription,
  measureTeamDescriptions,
} from '../rom/teamDescription';
import { textPixelWidth, IN_GAME_NAME_WIDTH } from '../rom/TeamNameTileFont';
import { aiError, DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from './aiProviders';
import { streamCompletion } from './aiStream';
import {
  AI_FLAG_TEMPLATES,
  AI_FORMATIONS,
  AI_HAIR_SKIN_TEMPLATES,
  AI_LIMITS,
  CUSTOM_TEMPLATE,
  DEFAULT_AI_CONTEXT,
  SPECIAL_HAIR_KEYS,
  SPECIAL_SKIN_KEYS,
  averageColor,
  buildPartSchema,
  buildRepairPrompt,
  cleanPlayerName,
  cleanTeamName,
  findAiFormation,
  fitDescription,
  normalizeFlagGrid,
  pickPart,
  predominantColorOf,
  readColor,
  resolveFlagDesign,
  resolveHairSkin,
  validateGeneratedTeam,
} from './aiTeamSchema';

/** Attempts per generation: the first one plus up to two corrections */
export const AI_MAX_ATTEMPTS = 3;

/**
 * Limits of the target slot, read from the ROM: how many letters the menu name area
 * still takes, the exact menu-name fit, and the bytes free for the description
 * (the 27 descriptions share one area).
 * @param {import('../rom/RomParser').default|null} romParser
 * @param {number|null} teamIndex
 */
export function buildAiContext(romParser, teamIndex) {
  if (!romParser || !Number.isInteger(teamIndex)) return { ...DEFAULT_AI_CONTEXT };
  const fitMenuName = (text) => romParser.fitTeamNameMenu(teamIndex, text);
  const probe = fitMenuName('ABCDEFGHIJ'.slice(0, AI_LIMITS.teamNameText));
  let descriptionBudget = null;
  try {
    const all = romParser.readTeamDescriptions();
    const empty = { title: '', titleColor: 0x2c, body: '' };
    all[teamIndex] = empty;
    descriptionBudget =
      TEAM_DESC_CAPACITY -
      measureTeamDescriptions(all, romParser) +
      encodeTeamDescription(empty).length;
  } catch {
    // description area not readable: only the fixed limits are checked
  }

  // Dry run on a copy of the ROM: the compressed flags share one area
  const fitsFlag = (grid) =>
    new RomParser(romParser.getRomData(), romParser.getOriginalData()).writeFlagDesign(
      teamIndex,
      grid,
    );

  // The other teams' shirts, so a new team does not look like one of them
  const otherKits = [];
  TEAMS.forEach((info, i) => {
    if (i === teamIndex) return;
    try {
      const kits = romParser.readUniformColors(i);
      otherKits.push({
        name: romParser.readTeamNameText(i) || info.name,
        home: averageColor(kits.home.shirt),
        away: averageColor(kits.away.shirt),
      });
    } catch {
      // unreadable slot: skipped
    }
  });

  return {
    teamIndex,
    menuNameMax: Math.max(1, probe ? probe.length : 1),
    fitMenuName,
    descriptionBudget,
    fitsFlag,
    otherKits,
    // Super Star has no goalkeeper of its own: it uses Belgium's (and the other way round)
    sharedKeeperWith: sharedKeeperTeams(teamIndex).map(
      (i) => romParser.readTeamNameText(i) || TEAMS[i].name,
    ),
  };
}

/** Scoreboard name: letters the editor font can draw, cut to the 32-pixel graphic */
function fitInGameName(text) {
  let name = cleanTeamName(text);
  while (name.length > 1 && textPixelWidth(name) > IN_GAME_NAME_WIDTH) {
    name = name.slice(0, -1).trimEnd();
  }
  return name || 'AI';
}

const HAIR_STYLES = [
  '0: Short hair',
  '1: Curly hair',
  '2: Long curly',
  '3: Long with beard',
  '4: Long straight',
  '5: Dreadlocks',
  '6: Afro',
  '7: Ponytail',
  '8: Bald',
  '9: Mid length',
  '10: Long with ribbon',
];

/** "4-3-3 (433): GK LB CB CB RB DM LM RM LW RW ST" lines of the formations */
function formationLines() {
  return AI_FORMATIONS.map((f) => `- "${f.id}" (${f.label}): ${f.positions.join(' ')}`).join('\n');
}

/** One line per flag template: id and text preview */
function flagTemplateLines() {
  return AI_FLAG_TEMPLATES.map((t) => `- "${t.id}": ${t.thumbnail}`).join('\n');
}

const hex = (c) =>
  [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');

/** The other teams' shirts (home/away), so a new team does not copy one of them */
function otherKitsSection(otherKits) {
  const kits = (otherKits || []).filter((k) => k.home);
  if (!kits.length) return '';
  return `
## Other teams in this ROM (home / away shirt colors, hex RGB)
${kits.map((k) => `${k.name} ${hex(k.home)}/${k.away ? hex(k.away) : '-'}`).join(', ')}
For a fictional team (or when the user gives no colors) choose a home shirt that does not look like these. Real teams keep their real colors.
`;
}

/** Advice on the description length from the bytes free in the ROM */
function descriptionSpaceHint(budget) {
  const max = AI_LIMITS.descriptionLines * AI_LIMITS.descriptionColumns;
  if (budget == null) return `about ${max} characters at most`;
  // bytes the title takes (colour codes, line ends) before the body starts
  const overhead = encodeTeamDescription({
    title: 'Offensive 4-4-2',
    titleColor: 0x2c,
    body: '',
  }).length;
  // each wrapped line can add one line-end byte
  const chars = Math.min(max, Math.floor(((budget - overhead) * 15) / 16));
  if (chars < 15) return 'there is almost no space left in the ROM: write an EMPTY body ("")';
  return `at most ${chars} characters (the description area of the ROM is shared by all teams)`;
}

/** Steps of a generation: the squad first, then its visual identity */
export const AI_PARTS = ['squad', 'look'];

const SQUAD_EXAMPLE = `  "name": "Team Display Name",
  "teamNameText": "TEAMNAME",
  "teamNameInGame": "TEAM",
  "formation": "433",
  "players": [
    {
      "name": "PLAYER1",
      "number": 1,
      "acceleration": 8,
      "topSpeed": 8,
      "dribbleSpeed": 6,
      "stamina": 14,
      "shooting": 7,
      "technique": 9,
      "attack": 2,
      "defense": 12,
      "gkKick": 11,
      "hairStyle": 0,
      "isSpecial": false
    }
  ],
  "description": {
    "style": "offensive",
    "title": "Offensive 4-3-3",
    "body": "Fast wingers and a strong striker."
  },
  "specialHair": "regular",
  "specialSkin": "regular"`;

const LOOK_EXAMPLE = `  "uniforms": {
    "home": {
      "shirt": [{"r":0,"g":0,"b":128}, {"r":0,"g":0,"b":176}, {"r":0,"g":0,"b":224}],
      "shorts": [{"r":248,"g":248,"b":248}, {"r":200,"g":200,"b":200}, {"r":160,"g":160,"b":160}],
      "socks": [{"r":0,"g":0,"b":128}, {"r":0,"g":0,"b":224}]
    },
    "away": {
      "shirt": [{"r":248,"g":248,"b":248}, {"r":200,"g":200,"b":200}, {"r":160,"g":160,"b":160}],
      "shorts": [{"r":0,"g":0,"b":128}, {"r":0,"g":0,"b":176}, {"r":0,"g":0,"b":224}],
      "socks": [{"r":248,"g":248,"b":248}, {"r":160,"g":160,"b":160}]
    },
    "goalkeeper": {
      "shirtAndSocks": [{"r":0,"g":128,"b":0}, {"r":0,"g":176,"b":0}, {"r":0,"g":224,"b":0}, {"r":0,"g":128,"b":0}, {"r":0,"g":224,"b":0}],
      "shorts": [{"r":16,"g":16,"b":16}]
    }
  },
  "hairSkin": {
    "template": "european_light",
    "first": { "hair": [], "skin": [] },
    "second": { "hair": [], "skin": [] },
    "goalkeeper": { "hair": [{"r":40,"g":24,"b":8}], "skin": [] }
  },
  "flagColors": [
    {"r":0,"g":0,"b":128}, {"r":248,"g":248,"b":248}, {"r":200,"g":0,"b":0}, {"r":248,"g":200,"b":0}
  ],
  "flagDesign": {
    "template": "horizontal-3",
    "grid": []
  }`;

function squadSections(ctx) {
  const menuMax = Math.min(AI_LIMITS.teamNameText, ctx.menuNameMax);
  return `## Team Names
- name: descriptive display name (max 20 chars)
- teamNameText: max ${menuMax} chars UPPERCASE (shown in menus; this is all the space this team slot has)
- teamNameInGame: max ${AI_LIMITS.teamNameInGame} chars UPPERCASE (drawn on the scoreboard; usually the same name as teamNameText, or a shorter form)
- Allowed: A-Z, 0-9, '.', space

## Formation
Pick the formation that suits the team (style, era, famous tactics). It decides where players 1-11 play: player N plays the Nth position of the list.
${formationLines()}
Positions: GK goalkeeper, LB/RB full back, CB centre back, SW sweeper, DM defensive midfielder, CM centre midfielder, LM/RM wide midfielder, AM attacking midfielder, LW/RW winger, ST striker.

## Players (exactly ${AI_LIMITS.players})
- Players 1-11 = starters IN THE ORDER OF THE FORMATION POSITIONS (player 1 = goalkeeper). Players 12-15 = substitutes (include a second goalkeeper).
- Put each real player in his real position: e.g. in "433" player 2 is the left back and player 9 the left winger.
- Name: max ${AI_LIMITS.playerName} characters. Allowed: A-Z, a-z, 0-9, '.', '"', "'", '/', space. No accents (write JOSE, not JOSÉ).
- If a real name is longer than ${AI_LIMITS.playerName} characters, use a recognizable short form (shortened surname or nickname).
- Shirt number: 1-16, unique per player

## Attributes (all required for every player)
| Attribute | Range | Notes |
|-----------|-------|-------|
| acceleration | 1-16 | Speed when starting to run (quick, explosive players high) |
| topSpeed | 1-16 | Top running speed without the ball |
| dribbleSpeed | 1-16 | Top running speed with the ball (dribblers high) |
| stamina | 1-16 | Higher = more endurance |
| shooting | ${SHOOTING_VALUES.join(', ')} | Shot power. Odd values only |
| technique | ${SHOOTING_VALUES.join(', ')} | Shot accuracy. Odd values only |
| attack | 1-16 | Strength in ball duels in the opponent's half (forwards high) |
| defense | 1-16 | Strength in ball duels in the own half (defenders high) |
| gkKick | ${SHOOTING_VALUES.join(', ')} | Goalkeeper kick power. Odd values only. Matters for goalkeepers; use 7 for the others |

## Stat Distribution Guidelines
- Goalkeepers: high stamina (12-16), low speeds (6-10), high defense, gkKick 9-15
- Defenders: high stamina (12-16), moderate speed, high defense (10-15), low attack
- Midfielders: balanced stats, high technique for playmakers, high dribbleSpeed for dribblers
- Forwards: high speeds and shooting, lower stamina, high attack (10-15), low defense
- Star players: 1-3 per team with stats 13-15+
- Average players: stats around 7-9
- Make stat variation REALISTIC: not everyone should have the same values

## Hair Styles (hairStyle)
${HAIR_STYLES.join(' | ')}
- GOALKEEPERS (player 1 and the reserve goalkeeper) ALWAYS use hairStyle 0: the game only draws keepers with that hair, any other value shows broken sprites in the match.
- Most players of real teams use 0; give other styles to the players known for them (2-4 per team).

## Special players (isSpecial, specialHair, specialSkin)
- Most players use the team hair/skin colors: isSpecial = false.
- isSpecial = true: the player uses the team-wide presets specialHair and specialSkin instead. Use it for 0-3 players who look different from the rest (e.g. one blond or one dark-skinned player).
- specialHair: ${SPECIAL_HAIR_KEYS.join(', ')}. specialSkin: ${SPECIAL_SKIN_KEYS.join(', ')}. "regular" = same as the team colors. Use "regular" for both when no player is special.

## Description (team selection screen)
- style: "offensive" (pink title) or "defensive" (green title)
- title: max ${AI_LIMITS.descriptionTitle} chars, usually the style and the formation, e.g. "Offensive 4-3-3", "Defensive 5-3-2", "Technical 4-4-2"
- body: a short text about the team (key players, way of playing), wrapped on screen in lines of ${AI_LIMITS.descriptionColumns} characters, max ${AI_LIMITS.descriptionLines} lines: ${descriptionSpaceHint(ctx.descriptionBudget)}
- English unless the user asks for another language. No accents. Allowed: A-Z, a-z, 0-9, space and ! " ' , - . : ?
`;
}

function lookSections(ctx) {
  return `## Colors (SNES 5-bit RGB)
Every color is {"r","g","b"}. All values must be multiples of 8, range 0-248.

## Uniforms
Each list is the SHADING of ONE color (dark → medium → light), never different colors: a yellow shirt is dark yellow, yellow, light yellow. Stripes, collars or sleeves of another color are not possible.
Home kit:
- shirt: 3 shades (dark → medium → light)
- shorts: 3 shades (dark → medium → light)
- socks: 2 shades (dark → light)

Away kit: same structure, contrasting colors to home

Goalkeeper kit:
- shirtAndSocks: 5 shades of one color (dark → light)
- shorts: 1 color

IMPORTANT: Home and away kits must be VISUALLY DISTINCT. Goalkeeper must differ from both.
${
  ctx.sharedKeeperWith?.length
    ? `
NOTE: in this ROM slot the goalkeeper kit and the goalkeeper hair/skin are SHARED with ${ctx.sharedKeeperWith.join(', ')}: they change that team's goalkeeper too. Choose a goalkeeper kit that also works next to ${ctx.sharedKeeperWith.join(', ')}'s kits (or keep the usual goalkeeper colors of that team).
`
    : ''
}
## Hair & Skin (hairSkin)
- template: hair/skin colors taken from a real team of the game: ${AI_HAIR_SKIN_TEMPLATES.map((t) => `"${t.id}" (${t.baseTeam})`).join(', ')}; or "${CUSTOM_TEMPLATE}".
- Each list left EMPTY ([]) is taken from the template; a filled list overrides it (e.g. a template plus a blond hair color). With "${CUSTOM_TEMPLATE}" fill every list.
- first (home kit) and second (away kit): hair 1 color, skin 5 colors (darkest → lightest)
- goalkeeper: hair 1 color, skin 3 colors
- Prefer the template closest to the players; custom skin gradients should look natural (shadow → base → highlight)

## Flag (flagColors, flagDesign)
- flagColors: exactly 4 palette colors. In the design, cell value N uses flagColors[N-1]; 0 = transparent.
- flagDesign.template: a ready-made design from the list below, or "${CUSTOM_TEMPLATE}".
- flagDesign.grid: [] to use the template as it is. For "${CUSTOM_TEMPLATE}": EXACTLY 16 rows × 24 columns of 0-4 (count them).
- Use a template when one matches the flag (stripes, crosses, circle, diamond...) and choose flagColors for its numbers. Draw a custom grid only for designs no template has (emblems, letters, animals...).
- Custom designs: a RECOGNIZABLE shape/symbol, not just stripes. National teams: the real flag. Fictional teams: an iconic symbol (star, shield, bolt, skull...). Color 1 as background, 2-4 for the design. Simple, bold silhouettes read best at 16×24 and take less ROM space.
Templates (preview: 8 rows of 12 digits separated by "/", each digit = a 2×2 block of the design):
${flagTemplateLines()}
${otherKitsSection(ctx.otherKits)}`;
}

const PART_INTROS = {
  all: 'Output a single JSON object that will be imported directly into the game ROM.',
  squad:
    'This step creates the SQUAD of the team: names, formation, players and the selection-screen description. Kits, hair/skin colors and flag are made in another step: do not include them.',
  look: 'This step creates the VISUAL IDENTITY of a team whose squad is already made: kits, hair/skin colors and flag. Do not include players or names.',
};

const PART_CLOSINGS = {
  all: `Include ALL ${AI_LIMITS.players} players and ALL description/uniform/hairSkin/flag data. Output valid JSON only.`,
  squad: `Include ALL ${AI_LIMITS.players} players and the description. Output valid JSON only.`,
  look: 'Include ALL uniform, hairSkin and flag data. Output valid JSON only.',
};

/**
 * Build the system prompt with the ROM constraints of one step (or of the whole team).
 * The fields and their order match buildTeamSchema (aiTeamSchema.js).
 * @param {object} [context] - limits of the target slot (buildAiContext)
 * @param {'all'|'squad'|'look'} [part]
 */
export function buildSystemPrompt(context = DEFAULT_AI_CONTEXT, part = 'all') {
  const ctx = { ...DEFAULT_AI_CONTEXT, ...context };
  const sections = [
    part !== 'look' ? squadSections(ctx) : '',
    part !== 'squad' ? lookSections(ctx) : '',
  ].filter(Boolean);
  const example = [part !== 'look' ? SQUAD_EXAMPLE : '', part !== 'squad' ? LOOK_EXAMPLE : '']
    .filter(Boolean)
    .join(',\n');
  return `You are a team data generator for International Superstar Soccer (SNES, 1995). ${PART_INTROS[part]} Follow ALL constraints below.

# CONSTRAINTS

${sections.join('\n')}
# OUTPUT

Return ONLY a valid JSON object. No markdown fences, no explanation, no comments.

{
${example}
}
${part !== 'squad' ? `\nA custom flag instead looks like: "flagDesign": { "template": "${CUSTOM_TEMPLATE}", "grid": [[1,1,1, ... 24 numbers], ... 16 rows] }\n` : ''}
${PART_CLOSINGS[part]}`;
}

/**
 * User prompt of the visual step: the request plus what the squad step made, so the
 * kits, skin tones and flag match the team (fictional names, special players...).
 */
export function buildLookRequest(userPrompt, squad) {
  if (!squad || typeof squad !== 'object') return userPrompt;
  const players = Array.isArray(squad.players) ? squad.players : [];
  const names = players.map((p) => p?.name).filter(Boolean);
  const special = players.filter((p) => p?.isSpecial).map((p) => p.name);
  return [
    userPrompt,
    '',
    '---',
    `The squad of this team is already made: "${squad.name || squad.teamNameText || ''}" (menu name ${squad.teamNameText || '?'}).`,
    names.length ? `Players: ${names.join(', ')}.` : '',
    special.length
      ? `Special players (own hair/skin: ${squad.specialHair || 'regular'} / ${squad.specialSkin || 'regular'}): ${special.join(', ')}. The team hair/skin colors are for the others.`
      : '',
    'Now create only its kits, hair/skin colors and flag.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Round a color value to nearest valid SNES value (multiple of 8, clamped 0-248)
 */
function snapColor(value) {
  const n = Number.isFinite(value) ? value : 0;
  return Math.round(Math.max(0, Math.min(248, n)) / 8) * 8;
}

/**
 * Sanitize a color ({r,g,b}, [r,g,b] or "#RRGGBB") to valid SNES values
 */
function sanitizeColor(color) {
  const c = readColor(color) || { r: 0, g: 0, b: 0 };
  return { r: snapColor(c.r), g: snapColor(c.g), b: snapColor(c.b) };
}

/**
 * Clamp a shooting/technique value to valid options
 */
function clampToShootingValue(val) {
  return SHOOTING_VALUES.reduce((best, v) => (Math.abs(val - v) < Math.abs(best - v) ? v : best));
}

/**
 * shooting/technique value of a player. The value is what the model reasons about
 * ("shooting 15"): it wins over an index, so the preview shows what gets written.
 */
function shootingStat(value, index) {
  if (Number.isFinite(value)) return clampToShootingValue(value);
  if (Number.isFinite(index)) return SHOOTING_VALUES[Math.max(0, Math.min(7, Math.round(index)))];
  return 7;
}

/**
 * Sanitize and validate a team JSON generated by the LLM
 * Fixes common issues (out-of-range values, missing fields) without rejecting.
 * Problems worth a new attempt are found by validateGeneratedTeam.
 * @param {object} data
 * @param {object} [context] - limits of the target slot (buildAiContext)
 */
export function sanitizeGeneratedTeam(data, context = DEFAULT_AI_CONTEXT) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const ctx = { ...DEFAULT_AI_CONTEXT, ...context };

  let menuName =
    cleanTeamName(data.teamNameText || data.name || '').substring(0, AI_LIMITS.teamNameText) ||
    'AITEAM';
  // what the menu name area really takes (it would be cut on writing anyway)
  if (ctx.fitMenuName) menuName = ctx.fitMenuName(menuName) || menuName;

  const formation = findAiFormation(data.formation);

  const team = {
    _format: 'iss-forge-team',
    _version: 3,
    name: String(data.name || menuName).substring(0, 20),
    id: String(data.id || 'AITEAM')
      .substring(0, 10)
      .toUpperCase(),
    teamNameText: menuName,
    teamNameInGame: fitInGameName(data.teamNameInGame || menuName),
    players: [],
    uniforms: null,
    hairSkin: null,
    flagColors: [],
    // squad slot N plays position N of the formation (unknown id: the slot keeps its own)
    formation: formation ? { slots: formation.slots.map((s) => ({ ...s })) } : null,
    formationId: formation?.id || null,
    formationName: formation?.name || null,
    specialHair: SPECIAL_HAIR.TYPES[Math.max(0, SPECIAL_HAIR_KEYS.indexOf(data.specialHair))].id,
    specialSkin: SPECIAL_SKIN.TYPES[Math.max(0, SPECIAL_SKIN_KEYS.indexOf(data.specialSkin))].id,
  };

  // Sanitize players
  const rawPlayers = Array.isArray(data.players) ? data.players : [];
  const usedNumbers = new Set();

  for (let i = 0; i < AI_LIMITS.players; i++) {
    const p = rawPlayers[i] && typeof rawPlayers[i] === 'object' ? rawPlayers[i] : {};
    const shooting = shootingStat(p.shooting, p.shootingIndex);
    const technique = shootingStat(p.technique, p.techniqueIndex);

    let number = Math.max(1, Math.min(16, Math.round(Number(p.number)) || i + 1));
    while (usedNumbers.has(number)) {
      number = number < 16 ? number + 1 : 1;
    }
    usedNumbers.add(number);

    // The ROM stores three speeds; an overall "speed" fills the missing ones
    const speed = clampStat(p.speed ?? 8);
    const speeds = {
      acceleration: clampStat(p.acceleration ?? speed),
      topSpeed: clampStat(p.topSpeed ?? speed),
      dribbleSpeed: clampStat(p.dribbleSpeed ?? speed),
    };
    // goalkeeper kick: without it the slot keeps its old value
    const gkKick =
      Number.isFinite(p.gkKick) || Number.isFinite(p.gkKickIndex)
        ? shootingStat(p.gkKick, p.gkKickIndex)
        : null;

    team.players.push({
      // accents become plain letters before the cut ("JOSÉ" → "JOSE")
      name: cleanPlayerName(p.name).substring(0, AI_LIMITS.playerName) || `PLAY${i + 1}`,
      number,
      position: formation?.positions[i] || (i === 0 ? 'GK' : i > 10 ? 'SUB' : null),
      shooting,
      shootingIndex: SHOOTING_VALUES.indexOf(shooting),
      ...speeds,
      speed: gameSpeed(speeds), // read-only summary (ignored on import)
      stamina: clampStat(p.stamina ?? 8),
      technique,
      techniqueIndex: SHOOTING_VALUES.indexOf(technique),
      ...(p.attack != null ? { attack: clampStat(p.attack) } : {}),
      ...(p.defense != null ? { defense: clampStat(p.defense) } : {}),
      ...(gkKick != null ? { gkKick, gkKickIndex: SHOOTING_VALUES.indexOf(gkKick) } : {}),
      // the goalkeeper only has graphics for hair style 0 (others draw broken sprites)
      hairStyle:
        i === 0
          ? 0
          : Math.max(0, Math.min(AI_LIMITS.maxHairStyle, Math.round(Number(p.hairStyle)) || 0)),
      isSpecial: Boolean(p.isSpecial),
    });
  }

  // Sanitize uniforms
  const u = data.uniforms || {};
  team.uniforms = {
    home: {
      shirt: sanitizeColorArray(u.home?.shirt, 3),
      shorts: sanitizeColorArray(u.home?.shorts, 3),
      socks: sanitizeColorArray(u.home?.socks, 2),
    },
    away: {
      shirt: sanitizeColorArray(u.away?.shirt, 3),
      shorts: sanitizeColorArray(u.away?.shorts, 3),
      socks: sanitizeColorArray(u.away?.socks, 2),
    },
    goalkeeper: {
      shirtAndSocks: sanitizeColorArray(u.goalkeeper?.shirtAndSocks, 5),
      shorts: sanitizeColorArray(u.goalkeeper?.shorts, 1),
    },
  };

  // Sanitize hair/skin (empty lists come from the chosen template)
  const hs = resolveHairSkin(data.hairSkin);
  team.hairSkinTemplate = hs.template;
  team.hairSkin = {
    first: {
      hair: sanitizeColorArray(hs.first?.hair, 1),
      skin: sanitizeColorArray(hs.first?.skin, 5),
    },
    second: {
      hair: sanitizeColorArray(hs.second?.hair, 1),
      skin: sanitizeColorArray(hs.second?.skin, 5),
    },
    goalkeeper: {
      hair: sanitizeColorArray(hs.goalkeeper?.hair, 1),
      skin: sanitizeColorArray(hs.goalkeeper?.skin, 3),
    },
  };

  // Sanitize flag colors
  team.flagColors = sanitizeColorArray(data.flagColors, AI_LIMITS.flagColors);

  // Sanitize flag design (a drawn grid, or the chosen template)
  const flag = resolveFlagDesign(data.flagDesign);
  team.flagTemplate = flag.template;
  team.flagDesign = flag.grid ? { grid: normalizeFlagGrid(flag.grid) } : null;

  // Which team changes kit when both wear the same colour: follows the home shirt
  team.predominantColor = predominantColorOf(averageColor(team.uniforms.home.shirt));

  // Selection-screen description, fitted to the screen and to the free bytes. A team
  // without one would keep the old team's text: write at least the title.
  const description =
    data.description && typeof data.description === 'object'
      ? data.description
      : { style: 'offensive', title: `Offensive ${formation?.name || ''}`, body: '' };
  team.description = fitDescription(description, {
    formationName: formation?.name || null,
    budget: ctx.descriptionBudget,
  });

  return team;
}

/**
 * Sanitize an array of colors to the expected length
 */
function sanitizeColorArray(arr, expectedLength) {
  const result = [];
  const source = Array.isArray(arr) ? arr : [];
  for (let i = 0; i < expectedLength; i++) {
    result.push(sanitizeColor(source[i]));
  }
  return result;
}

/**
 * Find and parse the JSON object in the model's answer.
 * Handles <think> blocks of reasoning models, code fences, text around the object
 * and the usual slips (trailing commas, // comments).
 * @returns {{ data: object } | { error: {code: string, detail: string} }}
 */
export function extractJson(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return { error: aiError('empty') };
  }

  let text = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) return { error: aiError('empty') };

  // Remove markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Try to find JSON object boundaries
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  try {
    return { data: JSON.parse(text) };
  } catch (e) {
    const repaired = text
      .replace(/\/\/[^\n"]*$/gm, '') // line comments (not inside "http://..." strings)
      .replace(/,\s*([}\]])/g, '$1'); // trailing commas
    try {
      return { data: JSON.parse(repaired) };
    } catch {
      return { error: aiError('parse', e.message) };
    }
  }
}

/**
 * Parse LLM response text into a team object
 * Handles cases where the LLM wraps JSON in code fences or adds explanations
 * @returns {{ success: true, team, errors: string[], warnings: string[] } | { success: false, error }}
 */
export function parseLLMResponse(responseText, context = DEFAULT_AI_CONTEXT) {
  const parsed = extractJson(responseText);
  if (parsed.error) return { success: false, error: parsed.error };
  const team = sanitizeGeneratedTeam(parsed.data, context);
  if (!team) {
    return { success: false, error: aiError('parse', 'not a JSON object') };
  }
  return { success: true, team, ...validateGeneratedTeam(parsed.data, context) };
}

/**
 * Default AI settings
 */
export const DEFAULT_AI_SETTINGS = {
  endpoint: 'http://localhost:1234/v1/chat/completions',
  model: '',
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
};

/**
 * Provider/model pairs that refused the structured-output request (HTTP 400/422):
 * the next generations of the session go straight to plain JSON for them.
 */
const noStructuredOutput = new Set();

const structuredKey = (settings) =>
  [settings.provider, settings.endpoint, settings.model].map((v) => v || '').join('|');

/** An HTTP 400/422 to a request with a schema: most likely the schema/tool was refused */
function isSchemaRejected(error) {
  return error?.code === 'api' && /^HTTP (400|422)\b/.test(error.detail || '');
}

/** Whether structured output is still worth trying with these settings this session */
export function structuredState(settings) {
  return { structured: !noStructuredOutput.has(structuredKey(settings)) };
}

/**
 * One JSON request with corrections: request → parse → validate, asking again (with
 * the list of problems and the previous answer) while errors remain.
 * Shared by the team steps and the championship plan.
 * @param {object} options
 * @param {string} options.systemPrompt
 * @param {object} options.schema - structured-output definition
 * @param {string} options.userPrompt
 * @param {object} options.settings
 * @param {function} options.validate - (data) => { raw, errors, warnings }
 * @param {object} [options.state] - structuredState(settings), shared between requests
 * @param {object} [options.attemptInfo] - extra fields for onAttempt (e.g. { part })
 * @returns {Promise<{ raw: object, errors: string[], warnings: string[], attempts: number }>}
 */
export async function requestValidated({
  systemPrompt,
  schema,
  userPrompt,
  settings,
  validate,
  state = structuredState(settings),
  attemptInfo = {},
  onChunk,
  onAttempt,
  signal,
  maxAttempts = AI_MAX_ATTEMPTS,
  stream = streamCompletion,
}) {
  let best = null;
  let lastError = null;
  let feedback = null; // { previous, problems } of the last attempt
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    onAttempt?.({ ...attemptInfo, attempt, maxAttempts, problems: feedback?.problems || [] });
    const prompt = feedback
      ? buildRepairPrompt(userPrompt, feedback.previous, feedback.problems)
      : userPrompt;

    let result;
    try {
      result = await stream({
        systemPrompt,
        userPrompt: prompt,
        settings,
        schema: state.structured ? schema : null,
        onChunk,
        signal,
      });
    } catch (err) {
      if (state.structured && isSchemaRejected(err)) {
        // the server does not take the schema: same attempt again, plain JSON
        state.structured = false;
        noStructuredOutput.add(structuredKey(settings));
        attempt--;
        continue;
      }
      throw err;
    }

    if (result.truncated) {
      // the same token budget would cut the answer again
      if (best) break;
      throw aiError('truncated', `max tokens: ${settings.maxTokens || DEFAULT_MAX_TOKENS}`);
    }

    const parsed = extractJson(result.text);
    const isObject =
      !parsed.error &&
      parsed.data &&
      typeof parsed.data === 'object' &&
      !Array.isArray(parsed.data);
    if (!isObject) {
      lastError = parsed.error || aiError('parse', 'not a JSON object');
      feedback = {
        previous: null,
        problems: [
          `the answer was not a valid JSON object (${lastError.detail || lastError.code})`,
        ],
      };
      continue;
    }

    const { raw, errors, warnings } = validate(parsed.data);
    if (!best || errors.length < best.errors.length) {
      best = { raw, errors, warnings };
    }
    if (!errors.length) break;
    feedback = { previous: JSON.stringify(raw), problems: errors };
  }

  if (best) return { ...best, attempts: attempt };
  throw lastError || aiError('parse');
}

/** One step of a team generation ('squad' or 'look') */
function generatePart({ part, userPrompt, settings, context, state, ...options }) {
  return requestValidated({
    systemPrompt: buildSystemPrompt(context, part),
    schema: buildPartSchema(context, part),
    userPrompt,
    settings,
    state,
    attemptInfo: { part },
    validate: (data) => {
      const raw = pickPart(data, part);
      return { raw, ...validateGeneratedTeam(raw, context, part) };
    },
    ...options,
  });
}

/**
 * Generate a team in two steps: the squad (names, formation, players, description),
 * then its visual identity (kits, hair/skin, flag), each with its own corrections.
 * `parts` + `previous` regenerate one step and keep the other one.
 *
 * @param {object} options
 * @param {string} options.userPrompt
 * @param {object} options.settings - { provider, endpoint, model, apiKey, temperature, maxTokens }
 * @param {object} [options.context] - limits of the target slot (buildAiContext)
 * @param {string[]} [options.parts] - steps to run (default: all, in AI_PARTS order)
 * @param {object} [options.previous] - an earlier result: its other steps are kept
 * @param {function} [options.onStage] - ({ part, index, total }) before each step
 * @param {function} [options.onAttempt] - ({ part, attempt, maxAttempts, problems }) before each request
 * @param {function} [options.onChunk] - text of the current request, as it streams
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.maxAttempts] - per step
 * @param {function} [options.stream] - streamCompletion (replaceable in tests)
 * @returns {Promise<{ team, raw, parts, errors: string[], warnings: string[], attempts: number, structured: boolean }>}
 *   `raw` has the answer of each step, `parts` their { errors, warnings, attempts };
 *   `errors` are the problems still there after the last attempts (the sanitizer
 *   fixed them as well as it could). Rejects with an AI error { code, detail }; when a
 *   later step fails, the error carries `partial` (the steps already done).
 */
export async function generateTeam({
  userPrompt,
  settings,
  context = DEFAULT_AI_CONTEXT,
  parts = AI_PARTS,
  previous = null,
  onStage,
  onAttempt,
  onChunk,
  signal,
  maxAttempts = AI_MAX_ATTEMPTS,
  stream = streamCompletion,
}) {
  const state = { structured: !noStructuredOutput.has(structuredKey(settings)) };
  const raw = { ...(previous?.raw || {}) };
  const done = { ...(previous?.parts || {}) };
  // a step without a previous answer has to run
  const todo = AI_PARTS.filter((p) => parts.includes(p) || !raw[p]);

  for (const [index, part] of todo.entries()) {
    onStage?.({ part, index, total: todo.length });
    try {
      const result = await generatePart({
        part,
        userPrompt: part === 'look' ? buildLookRequest(userPrompt, raw.squad) : userPrompt,
        settings,
        context,
        onChunk,
        onAttempt,
        signal,
        maxAttempts,
        stream,
        state,
      });
      raw[part] = result.raw;
      done[part] = { errors: result.errors, warnings: result.warnings, attempts: result.attempts };
    } catch (err) {
      if (Object.keys(raw).length && err && typeof err === 'object') {
        err.partial = { raw: { ...raw }, parts: { ...done } };
      }
      throw err;
    }
  }

  const team = sanitizeGeneratedTeam({ ...raw.squad, ...raw.look }, context);
  const all = AI_PARTS.map((p) => done[p]).filter(Boolean);
  return {
    team,
    raw,
    parts: done,
    errors: all.flatMap((p) => p.errors),
    warnings: all.flatMap((p) => p.warnings),
    attempts: todo.reduce((n, p) => n + done[p].attempts, 0),
    structured: state.structured,
  };
}

// ─── Prompt optimizer ────────────────────────────────────────────────────────

/** Longest brief the optimizer should write (a few short lines per topic) */
const OPTIMIZED_PROMPT_MAX_CHARS = 1500;

/**
 * System prompt of the "improve my prompt" step: rewrites the user's request into a
 * complete brief for the team generator, using only what the game can do.
 * @param {object} [context] - limits of the target slot (buildAiContext)
 */
export function buildOptimizerPrompt(context = DEFAULT_AI_CONTEXT) {
  const ctx = { ...DEFAULT_AI_CONTEXT, ...context };
  const menuMax = Math.min(AI_LIMITS.teamNameText, ctx.menuNameMax);
  const hair = HAIR_STYLES.map((h) => h.replace(/^\d+: /, '').toLowerCase()).join(', ');
  const formations = AI_FORMATIONS.map((f) => f.label).join(', ');
  return `You improve requests for an AI that creates teams for International Superstar Soccer (SNES, 1995). Rewrite the user's request into a clear and complete brief for that generator.

Keep the user's idea and every fact and value they gave; never contradict them. Fill in what is missing with sensible choices and write them explicitly: for a real team, its real squad, kits and flag of that time; for a fictional one, choices that match its theme.

A good brief covers, in short lines:
- Team: who it is (real team and year, or fictional theme), its name, a menu name of max ${menuMax} letters and a scoreboard name of max ${AI_LIMITS.teamNameInGame} letters.
- Style and formation (one of: ${formations}), offensive or defensive.
- Players: goalkeeper, defenders, midfielders and forwards in their positions, plus 4 substitutes (one goalkeeper). Names of max ${AI_LIMITS.playerName} letters without accents (short forms or nicknames for long names), shirt numbers 1-16. The stars and what they are good at. Attributes go from 1 to 16: acceleration, top speed, speed with the ball, stamina, shooting, technique, attack and defense duels, goalkeeper kick.
- Looks: hair styles (${hair}) and skin tones of the team; up to 3 "special" players can have their own hair (${SPECIAL_HAIR_KEYS.filter((k) => k !== 'regular').join(', ')}) or skin (${SPECIAL_SKIN_KEYS.filter((k) => k !== 'regular').join(', ')}).
- Kits: home, away and goalkeeper colors of shirt, shorts and socks. A shirt is one color with shading: no stripes, hoops, halves, text or logos.
- Flag: a simple design that reads at 24×16 pixels with up to 4 colors (stripes, cross, circle, diamond, star, a bold emblem).
- Selection-screen description: a short title (e.g. "Offensive 4-3-3") and one or two sentences about the team.

Rules:
- Write in the SAME LANGUAGE as the user's request.
- Return ONLY the improved brief as plain text: no markdown headings, no code fences, no notes before or after it.
- Keep it under about ${OPTIMIZED_PROMPT_MAX_CHARS} characters.`;
}

/**
 * The brief from the optimizer's answer: no <think> blocks (also an unfinished one
 * while streaming), code fences, "Here is the prompt:" lines or wrapping quotes.
 */
export function cleanOptimizedPrompt(text) {
  let out = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();
  const fence = out.match(/```[a-z]*\s*\n?([\s\S]*?)(?:\n?```|$)/i);
  if (fence) out = fence[1].trim();
  out = out.replace(
    /^(?:here(?:'s| is)|aqui est[aá]|segue|prompt (?:melhorado|otimizado|improved)|improved prompt|brief)[^\n]{0,60}:\s*\n/i,
    '',
  );
  const quoted = out.match(/^["“]([\s\S]*)["”]$/);
  return (quoted ? quoted[1] : out).trim();
}

/**
 * Rewrite the user's request into a complete brief for generateTeam.
 * @param {object} options
 * @param {string} options.userPrompt
 * @param {object} options.settings
 * @param {object} [options.context] - limits of the target slot (buildAiContext)
 * @param {function} [options.onChunk] - raw text as it streams
 * @param {AbortSignal} [options.signal]
 * @param {function} [options.stream] - streamCompletion (replaceable in tests)
 * @returns {Promise<string>} the improved prompt. Rejects with an AI error.
 */
export async function optimizePrompt({
  userPrompt,
  settings,
  context = DEFAULT_AI_CONTEXT,
  onChunk,
  signal,
  stream = streamCompletion,
}) {
  const result = await stream({
    systemPrompt: buildOptimizerPrompt(context),
    userPrompt,
    settings,
    schema: null,
    onChunk,
    signal,
  });
  if (result.truncated) {
    throw aiError('truncated', `max tokens: ${settings.maxTokens || DEFAULT_MAX_TOKENS}`);
  }
  const text = cleanOptimizedPrompt(result.text);
  if (!text) throw aiError('empty');
  return text;
}
