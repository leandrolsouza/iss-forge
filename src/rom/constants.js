/**
 * ISS (International Superstar Soccer) - SNES 1995 (Europe)
 * ROM Structure Constants and Offset Map
 *
 * Based on research from:
 * - Rodrigo Mallmann Guerra (ISS Studio / issparser)
 * - Esteban Fuentealba (Web ISS Studio)
 * - Equipe Puma / Equipe Falcon Brasil
 */

// ============================================================
// TEAMS
// ============================================================

export const TEAMS = [
  { id: 'GERMANY', name: 'Germany', nameEn: 'Germany' },
  { id: 'ITALY', name: 'Italy', nameEn: 'Italy' },
  { id: 'HOLLAND', name: 'Holland', nameEn: 'Netherlands' },
  { id: 'SPAIN', name: 'Spain', nameEn: 'Spain' },
  { id: 'ENGLAND', name: 'England', nameEn: 'England' },
  { id: 'WALES', name: 'Wales', nameEn: 'Wales' },
  { id: 'FRANCE', name: 'France', nameEn: 'France' },
  { id: 'DENMARK', name: 'Denmark', nameEn: 'Denmark' },
  { id: 'SWEDEN', name: 'Sweden', nameEn: 'Sweden' },
  { id: 'NORWAY', name: 'Norway', nameEn: 'Norway' },
  { id: 'IRELAND', name: 'Ireland', nameEn: 'Ireland' },
  { id: 'BELGIUM', name: 'Belgium', nameEn: 'Belgium' },
  { id: 'AUSTRIA', name: 'Austria', nameEn: 'Austria' },
  { id: 'SWISS', name: 'Swiss', nameEn: 'Switzerland' },
  { id: 'ROMANIA', name: 'Romania', nameEn: 'Romania' },
  { id: 'BULGARIA', name: 'Bulgaria', nameEn: 'Bulgaria' },
  { id: 'RUSSIA', name: 'Russia', nameEn: 'Russia' },
  { id: 'ARGENTINA', name: 'Argentina', nameEn: 'Argentina' },
  { id: 'BRAZIL', name: 'Brazil', nameEn: 'Brazil' },
  { id: 'COLOMBIA', name: 'Colombia', nameEn: 'Colombia' },
  { id: 'MEXICO', name: 'Mexico', nameEn: 'Mexico' },
  { id: 'USA', name: 'U.S.A.', nameEn: 'United States' },
  { id: 'NIGERIA', name: 'Nigeria', nameEn: 'Nigeria' },
  { id: 'CAMEROON', name: 'Cameroon', nameEn: 'Cameroon' },
  { id: 'SCOTLAND', name: 'Scotland', nameEn: 'Scotland' },
  { id: 'SKOREA', name: 'S.Korea', nameEn: 'South Korea' },
  { id: 'SUPERSTAR', name: 'Super Star', nameEn: 'Super Star' },
];

export const TEAM_COUNT = 27;
export const PLAYERS_PER_TEAM = 15;

// ============================================================
// TEAM FORMATIONS (default tactical setup per team, stored in the ROM)
//
// Reverse engineered from the ROM + 65816 code ($00:EC68 / $00:EC9A):
//   Pointer table: 0x382E4 — 28 x 16-bit pointers into bank $07 (LoROM),
//                  in ROM ordinal team order (same as FLAG_DESIGN_ORDINALS).
//   Records:       0x3831C — 44 bytes per team = 11 slots x 4 bytes.
//   Slot N describes the player in squad position N (players 1-11 start).
//
//   Slot byte 0: depth from own goal line (game multiplies by 32 → pixels)
//   Slot byte 1: high nibble = lateral position (0 = left … 15 = right, 7 = centre)
//                low nibble  = line (0 GK, 1 defence, 2 midfield, 3 attack)
//   Slot byte 2: role (see FORMATION_ROLES — names inferred from usage)
//   Slot byte 3: AI behaviour, two nibbles read separately by the engine
//                (low nibble ×32, high nibble ×2 — meaning not fully mapped)
// ============================================================

export const FORMATION_DATA = {
  POINTER_TABLE: 0x382e4,
  POINTER_COUNT: 28,
  BANK_FILE_BASE: 0x38000, // LoROM bank $07 → file offset 0x38000 + (addr - 0x8000)
  RECORD_LENGTH: 44,
  SLOTS: 11,
  SLOT_LENGTH: 4,
  MAX_DEPTH: 0x28,
  MAX_LATERAL: 15,
};

/** Role ids found in the ROM. `line` is the line the game expects for that role. */
export const FORMATION_ROLES = [
  { id: 0, key: 'roleGK', short: 'GK', line: 0 },
  { id: 1, key: 'roleFullBack', short: 'FB', line: 1 },
  { id: 2, key: 'roleCentreBack', short: 'CB', line: 1 },
  { id: 7, key: 'roleSweeper', short: 'SW', line: 1 },
  { id: 3, key: 'roleDefMid', short: 'DM', line: 2 },
  { id: 4, key: 'roleMid', short: 'CM', line: 2 },
  { id: 5, key: 'roleAttMid', short: 'AM', line: 2 },
  { id: 6, key: 'roleForward', short: 'FW', line: 3 },
];

/**
 * Formation presets copied verbatim from original team records
 * (11 slots x 4 bytes, hex). Using real game data guarantees the AI
 * behaviour bytes stay coherent with the positions.
 */
export const FORMATION_PRESETS = [
  {
    id: '442-flat',
    name: '4-4-2',
    source: 'Wales',
    hex: '007000370b2101320a5102420a9102420bc1013217220436165204361692043617c204362253060022930600',
  },
  {
    id: '442-diamond',
    name: '4-4-2 (losango)',
    nameEn: '4-4-2 (diamond)',
    source: 'Italy',
    hex: '007000370c2101320a5102420a9102420cc10132127203741832044418b204441a7205742253060022930600',
  },
  {
    id: '442-box',
    name: '4-4-2 (quadrado)',
    nameEn: '4-4-2 (box)',
    source: 'Brazil',
    hex: '007000370e2101320a5102420a9102420ec101321242034412a203441a5205541a9205542243063022a30630',
  },
  {
    id: '433',
    name: '4-3-3',
    source: 'England',
    hex: '007000370e2101320a5102420a9102420ec10132147203741822045418c204542223063422c3063024730630',
  },
  {
    id: '451',
    name: '4-5-1',
    source: 'Sweden',
    hex: '007000370c2101320a5102420a9102420cc1013212520354129203541822045418c204841e82053024630630',
  },
  {
    id: '343',
    name: '3-4-3',
    source: 'Holland',
    hex: '007000370a310242097102420ab10242127203751622045416c204541a7205732023060020c3060022730600',
  },
  {
    id: '352',
    name: '3-5-2',
    source: 'Nigeria',
    hex: '007000370c3102420a7102420cb102421222035412c20354167204741a3205441ab205442243063022a30630',
  },
  {
    id: '532',
    name: '5-3-2 (libero)',
    nameEn: '5-3-2 (sweeper)',
    source: 'Germany',
    hex: '00700037101101320a410242097107320aa1024210d10132147203741832054418b205442243060022a30600',
  },
  {
    id: '424',
    name: '4-2-4',
    source: 'Super Star',
    hex: '007000370a2101320a5107420a9102420ac101321642057816a2047822230630225306302293063022c30630',
  },
];

// ============================================================
// SCENARIO MODE (9 pre-set match situations)
//
// Reverse engineered from $00:ED41-$00:EDE4 (setup) and $07:D4AA (menu):
//   Team pairs:    0x9CAE ($81:9CAE) — 9 x 2 bytes, team ordinal * 2
//                  (first = team 1 → $1720, second = team 2 → $1770)
//   Record ptrs:   0x9CC0 ($81:9CC0) — 9 x 16-bit pointers into bank $01
//   Records:       0x9CD2 — 12 bytes each:
//     +0  word  match clock, BCD m:ss → $1A44 (final whistle when it hits 0)
//     +2  word  displayed clock, BCD m:ss → $1A46 (0 = no clock shown)
//     +4  byte  team 1 goals → $1724
//     +5  byte  team 2 goals → $1774
//     +6  byte  initial game state → $9E (restart type; not fully mapped)
//     +7  byte  flag → $B0/$B2 = 0x0C00 if set, else 0x0520 (not mapped)
//     +8  word  → $0504 (probably ball X)
//     +10 word  → $0506 (probably ball Y)
//   Player state:  0x9C66 — 9 x 8 bytes, per-player condition masks for both
//                  teams ($85:A3FF). Preserved as-is (meaning not mapped).
//   Texts:         pointers at 0x38036 ($87:8036, 9 x 16-bit, bank $02),
//                  ASCII area 0x114AF-0x11910. Rendered by $00:E2AC as
//                  8 lines x 23 columns. 0xFD = new line, 0xFF = end.
// ============================================================

export const SCENARIO_DATA = {
  COUNT: 9,
  TEAM_TABLE: 0x9cae,
  RECORD_PTRS: 0x9cc0,
  RECORD_BANK_FILE_BASE: 0x8000, // bank $01
  RECORD_LENGTH: 12,
  PLAYER_STATE_TABLE: 0x9c66,
  TEXT_PTRS: 0x38036,
  TEXT_BANK_FILE_BASE: 0x10000, // bank $02
  TEXT_AREA_START: 0x114af,
  TEXT_AREA_END: 0x11911, // exclusive
  TEXT_COLUMNS: 23,
  TEXT_LINES: 8,
  TEXT_NEWLINE: 0xfd,
  TEXT_END: 0xff,
  MAX_GOALS: 9,
  MAX_MINUTES: 9,
};

// ============================================================
// TOURNAMENT DRAWS (International Cup / World Series)
//   32 pre-set draws at $87:A17B, 24 bytes each (ROM ordinal x2), read
//   in groups of 4 (groups A-F). When a tournament starts, $05:8A95 lists
//   the draws containing the player's team and $05:8AE1 picks one at
//   random. International Cup: the draw is copied to $7E:9090, a random
//   group (A-F) is shuffled and the player's team takes its first slot.
//   World Series: the same draw is the 24-team league ($7E:9128).
//   A selectable team missing from every draw freezes the game.
//   See research/tournaments.md.
// ============================================================

export const TOURNAMENT_DRAWS = {
  OFFSET: 0x3a17b,
  COUNT: 32,
  TEAMS: 24,
  GROUPS: 6,
  GROUP_SIZE: 4,
  /** Team ids selectable in the menus (0-25; Super Star is not selectable) */
  SELECTABLE_ORDINALS: 26,
};

/** Characters with a glyph in the scenario text font ($82:8C80) */
export const SCENARIO_TEXT_CHARSET =
  ' !"\',-.0123456789:?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// ============================================================
// GAME TEXTS (training mode)
//   Box texts (ASCII, 8x8 font, $80:E2AC like the scenarios; FD = new line,
//   FF = end), found through word pointer tables in bank $02:
//   - intros:  table $82:8CFB (5 words, read at $07:D419), 8 lines x 18 cols,
//              strings packed in 0x10D05-0x10F3E
//   - results: table $82:8F3F (5 words -> 5 sub-tables of 4 words, read at
//              $04:C577), 5 lines x 16 cols; plus the "course record" text
//              loaded with LDY #$92D4 at $04:C56D (operand at 0x2456E).
//              Sub-tables and strings packed in 0x10F49-0x11307.
//   Fixed-length texts (ISS charset, 8x16 font via $82:8AF4):
//   - messages: table $82:9308 (4 words, $06:971A), 3 lines x 20 cols each
//   - titles:   table $82:940A (5 words, $07:D405), 15 chars each
//   See research/game-texts.md.
// ============================================================

export const GAME_TEXTS = {
  BANK_FILE_BASE: 0x10000, // bank $02: file = 0x10000 + (ptr - 0x8000)
  INTRO_TABLE: 0x10cfb,
  INTRO_COUNT: 5,
  INTRO_AREA: [0x10d05, 0x10f3f],
  INTRO_BOX: { lines: 8, columns: 18 },
  RESULT_TABLE: 0x10f3f,
  RESULT_GROUPS: 5,
  RESULT_PER_GROUP: 4,
  RESULT_AREA: [0x10f49, 0x11308],
  RESULT_BOX: { lines: 5, columns: 16 },
  RECORD_OPERAND: 0x2456e, // LDY #$92D4 at $04:C56D
  MESSAGE_TABLE: 0x11308,
  MESSAGE_COUNT: 4,
  MESSAGE_BOX: { lines: 3, columns: 20 },
  TITLE_TABLE: 0x1140a,
  TITLE_COUNT: 5,
  TITLE_LENGTH: 15,
};

// ============================================================
// MENU SCREENS (Europe ROM)
//   Menus are 32x32 BG tilemaps (2048 bytes) packed with Konami's compressor.
//   Text uses the 8x16 font: a character is a top tile on row r and a bottom
//   tile on row r+1, as given by the table $82:8AF4 (FONT16_TABLE). A few
//   screens use alternative tile pairs (e.g. "T" = E2/E1), listed in
//   FONT16_EXTRA_PAIRS. Blocks are packed one after the other, so an edited
//   screen must recompress into its original size (plus 0xFF padding).
//   See research/game-texts.md.
// ============================================================

export const FONT16_TABLE = 0x10af4;

/** Tile pairs ("top,bottom") seen in the menus that are not in FONT16_TABLE */
export const FONT16_EXTRA_PAIRS = {
  '226,225': 'T',
  '276,281': 'e',
  '276,301': 'o',
  '180,247': 'V',
  '312,321': 'y',
};

/**
 * pointers: file offsets of every 3-byte long pointer to the screen (load
 * descriptors in bank $02). Screens with pointers can be moved to free space
 * when an edit no longer fits; the others (references inside code or not
 * found) can only be rewritten in place.
 */
export const MENU_SCREENS = [
  { offset: 0x3fe82, id: 'prematch', label: 'Pre-match menu (Open Game)', pointers: [0x10503] },
  {
    offset: 0xd49da,
    id: 'prematchCup',
    label: 'Pre-match menu (tournaments)',
    pointers: [0x10557],
  },
  { offset: 0xbe003, id: 'prematchShort', label: 'Pre-match menu (short)', pointers: [0x1052d] },
  { offset: 0x67124, id: 'players', label: '1P vs CPU / 1P vs 2P', pointers: [0x1048d] },
  { offset: 0x67a94, id: 'rules', label: 'Rules', pointers: [0x10697] },
  { offset: 0x6b63a, id: 'tactics', label: 'Tactics', pointers: [0x1040d] },
  { offset: 0x7734b, id: 'options', label: 'Options', pointers: [0x105a5] },
  { offset: 0xb7a01, id: 'sound', label: 'Sound', pointers: [0x1081d] },
  { offset: 0x6fe61, id: 'password', label: 'Password', pointers: [0x1087b] },
  { offset: 0x277d8, id: 'enterPassword', label: 'Enter password', pointers: [0x10872] },
  { offset: 0xf7030, id: 'cupGroup', label: 'International Cup group', pointers: [0x10750] },
  {
    offset: 0x779b8,
    id: 'stageTable',
    label: 'Stage table (won / lost)',
    pointers: [0x1023e, 0x10247],
  },
  {
    offset: 0xbe92d,
    id: 'wsFixtures',
    label: 'World Series fixtures',
    pointers: [0x101f4, 0x101fd],
  },
  { offset: 0x57d78, id: 'wsResults', label: 'World Series results', pointers: [0x10223, 0x1022c] },
  { offset: 0x8fb23, id: 'congrats', label: 'Congratulations', pointers: [] },
  { offset: 0xf0c1f, id: 'trainingMenu', label: 'Training menu', pointers: [0x107cd] },
  { offset: 0xf0a67, id: 'trainingName', label: 'Training: input name', pointers: [0x107bc] },
  { offset: 0xf0f88, id: 'trainingLevels', label: 'Training: levels', pointers: [0x107fc] },
  // Second half of the levels screen: same load descriptor, loaded to $7E:4B90
  { offset: 0xf10c9, id: 'trainingScore', label: 'Training: score', pointers: [0x10802] },
  // Mode titles (VRAM 0x0000, tiles of TITLE_FONT at 0x2000): edited as screen texts
  { offset: 0xd4b15, id: 'titleCup', label: 'Title: Intl Cup', pointers: [0x106ff], title: true },
  {
    offset: 0xd4c4e,
    id: 'titleCupFinal',
    label: 'Title: Intl Cup final',
    pointers: [0x10707],
    title: true,
  },
  {
    offset: 0x97e5e,
    id: 'titleCupTournament',
    label: 'Title: Intl Cup tournament',
    pointers: [0x1070f],
    title: true,
  },
  {
    offset: 0xd4d97,
    id: 'titleChampionship',
    label: 'Title: Championship',
    pointers: [0x10760],
    title: true,
  },
  { offset: 0xd4eac, id: 'titleWs1', label: 'Title: WS 1st', pointers: [0x10768], title: true },
  { offset: 0xf367a, id: 'titleWs2', label: 'Title: WS 2nd', pointers: [0x10770], title: true },
  {
    offset: 0xa6187,
    id: 'titleSpecial',
    label: 'Title: Special game',
    pointers: [0x1078a],
    title: true,
  },
  // Title screen (TITLE_SCREEN.TEXT): BG3 map with the copyright lines and the
  // plain font (BG3 tiles 0x20-0x5F, only loaded by the title screen and the
  // wrong-region warning). Not menu texts: edited in the title screen tab.
  {
    offset: 0xd43c8,
    id: 'titleScreenMap',
    label: 'Title screen: copyright map',
    pointers: [0x1019f],
    title: true,
  },
  {
    offset: 0x7f81b,
    id: 'titleScreenFont',
    label: 'Title screen: plain font',
    pointers: [0x10050],
    title: true,
  },
  // Title screen background (TITLE_SCREEN.BACKGROUND): BG1 map and tiles
  {
    offset: 0x67e6e,
    id: 'titleBgMap',
    label: 'Title screen: BG1 map',
    pointers: [0x1019a],
    title: true,
  },
  {
    offset: 0xbe106,
    id: 'titleBgTiles',
    label: 'Title screen: BG1 tiles',
    pointers: [0x1017c],
    title: true,
  },
];

// ============================================================
// MODE TITLE FONT
//   The big titles ("INTERNATIONAL CUP", "WORLD SERIES 1ST SEASON"...) are
//   32x32 tilemaps (compressed, loaded to VRAM 0x0000) over a shared set of 105
//   tiles (block 0x97B09, loaded to 0x2000). Each letter is 4 rows x 1-2
//   columns of tiles; a column lists the 4 tilemap words (tile | flip bits,
//   palette 3 is added). Lines start at rows 8, 13, 18 and are centred.
// ============================================================

export const TITLE_FONT = {
  1: [[79, 49168, 11, 80]],
  2: [
    [81, 83, 85, 87],
    [82, 84, 86, 88],
  ],
  A: [
    [10, 20, 28, 36],
    [16394, 16404, 16412, 16420],
  ],
  C: [
    [37, 39, 41, 48],
    [38, 40, 42, 49],
  ],
  D: [
    [8, 11, 11, 71],
    [66, 68, 68, 72],
  ],
  E: [
    [16386, 16, 32784, 16413],
    [7, 17, 25, 34],
  ],
  F: [
    [16386, 16, 32784, 16413],
    [7, 17, 25, 1],
  ],
  G: [
    [37, 39, 41, 48],
    [38, 40, 63, 64],
  ],
  H: [
    [73, 74, 75, 77],
    [4, 13, 76, 78],
  ],
  I: [[2, 11, 11, 29]],
  L: [
    [16386, 16395, 16395, 16413],
    [1, 1, 1, 46],
  ],
  M: [
    [51, 52, 53, 54],
    [16435, 16436, 16437, 16438],
  ],
  N: [
    [3, 12, 21, 30],
    [4, 13, 22, 31],
  ],
  O: [
    [37, 43, 44, 45],
    [16421, 16427, 16428, 16429],
  ],
  P: [
    [8, 18, 26, 29],
    [9, 19, 47, 1],
  ],
  R: [
    [8, 18, 26, 29],
    [9, 19, 27, 35],
  ],
  S: [
    [55, 57, 59, 61],
    [56, 58, 60, 62],
  ],
  T: [
    [5, 14, 23, 32],
    [6, 15, 24, 33],
  ],
  U: [
    [2, 11, 11, 50],
    [16386, 16395, 16395, 16434],
  ],
  W: [
    [65, 67, 69, 70],
    [16449, 16451, 16453, 16454],
  ],
  // Built by ISS Forge from tiles of other letters: B = top of P + bottom of D,
  // J = right half of U + the bottom of its left half
  B: [
    [8, 18, 11, 71],
    [9, 19, 68, 72],
  ],
  J: [
    [1, 1, 1, 50],
    [16386, 16395, 16395, 16434],
  ],
};

/**
 * Title letters drawn by ISS Forge (K Q V X Y Z): tilemap columns like TITLE_FONT.
 * Tiles below 0x59 are the original ones (some flipped); the others are new and live in
 * TITLE_NEW_TILES (8 rows, "#" = letter). The block only gets the tiles of the letters the
 * titles use (TITLE_FONT_BLOCK): 0x59-0x5F are free in the original set, 0x60-0x68 are the
 * texture of the letters (other BG layer) and 0x69+ is appended after the block.
 */
export const TITLE_FONT_DRAWN = {
  V: [
    [2, 89, 90, 91],
    [16386, 16473, 16474, 16475],
  ],
  Y: [
    [2, 92, 23, 32],
    [93, 94, 24, 33],
  ],
  K: [
    [2, 95, 105, 29],
    [16386, 16476, 106, 107],
  ],
  Z: [
    [108, 109, 110, 111],
    [112, 113, 114, 115],
  ],
  X: [
    [2, 116, 117, 118],
    [16386, 16500, 16501, 16502],
  ],
  Q: [
    [37, 43, 44, 45],
    [16421, 16427, 16428, 119],
  ],
};

export const TITLE_NEW_TILES = {
  0x59: [
    '.#####..',
    '..#####.',
    '..#####.',
    '..#####.',
    '..#####.',
    '...#####',
    '...#####',
    '...#####',
  ],
  0x5a: [
    '...#####',
    '...#####',
    '....####',
    '....####',
    '....####',
    '....####',
    '....####',
    '.....###',
  ],
  0x5b: [
    '.....###',
    '.....###',
    '.....###',
    '.....###',
    '.....###',
    '......##',
    '......##',
    '.......#',
  ],
  0x5c: [
    '..#####.',
    '..#####.',
    '...#####',
    '...#####',
    '....####',
    '....####',
    '.....###',
    '.....###',
  ],
  0x5d: [
    '........',
    '........',
    '........',
    '.#######',
    '.#######',
    '.#######',
    '..#####.',
    '.#####..',
  ],
  0x5e: [
    '.#####..',
    '#####...',
    '#####...',
    '####....',
    '####....',
    '###.....',
    '###.....',
    '##......',
  ],
  0x5f: [
    '.#####..',
    '.#####..',
    '.#####..',
    '.#####..',
    '.#####.#',
    '.#####.#',
    '.#######',
    '.#######',
  ],
  0x69: [
    '.#######',
    '.#######',
    '.#######',
    '.#####.#',
    '.#####.#',
    '.#####.#',
    '.#####..',
    '.#####..',
  ],
  0x6a: [
    '##......',
    '###.....',
    '###.....',
    '####....',
    '####....',
    '####....',
    '#####...',
    '#####...',
  ],
  0x6b: [
    '.#####..',
    '.#####..',
    '.#####..',
    '..#####.',
    '..#####.',
    '.#######',
    '.#######',
    '.#######',
  ],
  0x6c: [
    '........',
    '........',
    '........',
    '.#######',
    '.#######',
    '.#######',
    '.#######',
    '.#######',
  ],
  0x6d: [
    '.#######',
    '........',
    '........',
    '........',
    '.......#',
    '.......#',
    '......##',
    '......##',
  ],
  0x6e: [
    '.....###',
    '.....###',
    '....####',
    '....####',
    '...#####',
    '...#####',
    '..######',
    '..######',
  ],
  0x6f: [
    '.######.',
    '.######.',
    '########',
    '########',
    '########',
    '########',
    '########',
    '########',
  ],
  0x70: [
    '........',
    '........',
    '........',
    '########',
    '########',
    '########',
    '########',
    '########',
  ],
  0x71: [
    '########',
    '.######.',
    '######..',
    '######..',
    '#####...',
    '#####...',
    '####....',
    '####....',
  ],
  0x72: [
    '###.....',
    '###.....',
    '##......',
    '##......',
    '#.......',
    '#.......',
    '........',
    '........',
  ],
  0x73: [
    '........',
    '........',
    '#######.',
    '#######.',
    '#######.',
    '#######.',
    '#######.',
    '#######.',
  ],
  0x74: [
    '..#####.',
    '..#####.',
    '...#####',
    '...#####',
    '...#####',
    '....####',
    '....####',
    '.....###',
  ],
  0x75: [
    '.....###',
    '.....###',
    '.....###',
    '.....###',
    '....####',
    '....####',
    '...#####',
    '...#####',
  ],
  0x76: [
    '...#####',
    '..#####.',
    '..#####.',
    '.#####..',
    '.#####..',
    '#######.',
    '#######.',
    '#######.',
  ],
  0x77: [
    '..####..',
    '..####..',
    '.#####..',
    '#####...',
    '#####...',
    '######..',
    '########',
    '#...####',
  ],
};

/** Compressed tiles of the title font (loaded to VRAM 0x2000); rewritten in place */
export const TITLE_FONT_BLOCK = { offset: 0x97b09, pointer: 0x106d3, capacity: 839, tiles: 105 };

export const TITLE_LAYOUT = {
  ROWS: [8, 13, 18], // first tile row of each line
  BLANK: 0x0c01, // tile 1, palette 3
  PALETTE: 0x0c00,
  COLUMNS: 32,
};

/**
 * Free space for relocated menu screens: 0xFF padding at the end of banks in the
 * original ROM, [start, end) file offsets. Excludes areas used by other editors
 * (0x17680-0x17FFF team-name tiles) and the padding right after the pre-match
 * and password screens (already counted as their own room). The last 35 bytes
 * of bank $81 are kept for a longer title-screen PRESS START (TITLE_SCREEN.TEXT).
 */
export const MENU_FREE_SPACE = [
  [0x0febb, 0x0ffdd],
  [0x1fe2a, 0x20000],
  [0x27f53, 0x28000],
  [0x47fa5, 0x48000],
  [0x4ffc1, 0x50000],
  [0x77f3b, 0x78000],
  [0xa7f75, 0xa8000],
  [0xbffab, 0xc0000],
  [0xc7fc1, 0xc8000],
  [0xd7f72, 0xd8000],
  [0xeffcf, 0xf0000],
];

/**
 * ISS charset for the 8x16 font (table $82:8AF4) — same codes as the player names.
 * 0x52 is drawn as "!!" and 0x55 as a low dot. 0x59-0x5A = "1ST", 0x60-0x61 = "2ND".
 */
export const ISS_FONT16_CHARS = (() => {
  const map = { 0x00: ' ', 0x52: '!', 0x53: '-', 0x54: '.', 0x55: ',', 0x56: '"', 0x57: '=' };
  Object.assign(map, { 0x58: '+', 0x5b: '%', 0x5c: "'", 0x5d: '~', 0x5e: ':', 0x5f: '/' });
  for (let i = 0; i < 10; i++) map[0x62 + i] = String(i);
  for (let i = 0; i < 26; i++) {
    map[0x6c + i] = String.fromCharCode(65 + i);
    map[0x86 + i] = String.fromCharCode(97 + i);
  }
  return map;
})();

// ============================================================
// SCREEN TEXTS (Europe ROM)
//   Texts drawn by code with a fixed length/position (bank $02), outside the
//   menu tilemaps:
//   - fixed: 8x16 font, ISS charset, drawn by $80:E1C3 (1 line) / $80:E1FF
//            (lines x columns). Written in place. FE xx (palette) takes no cell.
//   - label: fixed text padded with low dots (0x55), written at `at` and
//            `at + mirror` (1P / 2P columns of the joypad screen).
//   - box:   8x8 ASCII box text ($80:E2AC; FD = new line, FF = end). In place
//            (`room` bytes) or re-packed with the other texts of a `pack`.
//   - repeat: one 2-cell entry written to `count` consecutive slots.
//   See research/game-texts.md ("Textos desenhados pelo código").
// ============================================================

/** Box texts re-packed together: word table + area [start, end) + bank file base */
export const SCREEN_TEXT_PACKS = {
  joypadHelp: { table: 0x11a57, area: [0x11a6d, 0x11f67], bank: 0x10000 },
  // Main menu items: sprite lists in bank $88, pointers at $87:9E1F
  mainMenu: { table: 0x39e1f, area: [0x43c4f, 0x43e3f], bank: 0x40000 },
};

// ============================================================
// MAIN MENU SPRITE FONT
//   The main menu items are sprite lists (bank $88): count, then count x
//   [dy, dx, tile, attr] relative to the screen centre (128, 112). attr bit 4 =
//   16x16 sprite, bit 0 = tile bit 8, palette 6 (the game swaps the palette of
//   the selected item). Letters are built from the OBJ tiles 0x100-0x13F:
//   16x16 glyphs for A D E K M N O P R S W, pieces for the others (C and G
//   reuse the left half of O, L the foot of D, ...). There is no H, B, F, J, Q,
//   V, X, Z. pieces: [dx, dy, tile, big]; ink: first and last column drawn.
// ============================================================

const bigGlyph = (tile, left, right) => ({ pieces: [[0, 0, tile, 1]], ink: [left, right] });

export const MENU_SPRITE_FONT = {
  A: bigGlyph(0x100, 0, 15),
  D: bigGlyph(0x102, 2, 15),
  E: bigGlyph(0x104, 4, 13),
  K: bigGlyph(0x106, 1, 15),
  M: bigGlyph(0x108, 1, 14),
  N: bigGlyph(0x10a, 1, 14),
  O: bigGlyph(0x10c, 0, 15),
  P: bigGlyph(0x10e, 4, 14),
  R: bigGlyph(0x120, 1, 15),
  S: bigGlyph(0x122, 2, 12),
  W: bigGlyph(0x124, 0, 15),
  I: {
    pieces: [
      [0, 0, 0x127, 0],
      [0, 8, 0x128, 0],
    ],
    ink: [2, 6],
  },
  T: {
    pieces: [
      [0, 0, 0x12a, 0],
      [8, 0, 0x12b, 0],
      [4, 8, 0x128, 0],
    ],
    ink: [2, 14],
  },
  L: {
    pieces: [
      [0, 0, 0x127, 0],
      [0, 8, 0x112, 0],
      [8, 8, 0x129, 0],
    ],
    ink: [2, 12],
  },
  C: {
    pieces: [
      [0, 0, 0x10c, 0],
      [0, 8, 0x11c, 0],
      [8, 0, 0x12e, 0],
      [8, 8, 0x12f, 0],
    ],
    ink: [0, 13],
  },
  G: {
    pieces: [
      [0, 0, 0x10c, 0],
      [0, 8, 0x11c, 0],
      [8, 0, 0x12e, 0],
      [8, 8, 0x126, 0],
    ],
    ink: [0, 13],
  },
  U: {
    pieces: [
      [0, 0, 0x127, 0],
      [1, 8, 0x136, 0],
      [8, 0, 0x127, 0],
      [9, 8, 0x137, 0],
    ],
    ink: [2, 14],
  },
  Y: {
    pieces: [
      [0, 0, 0x12c, 0],
      [8, 0, 0x12d, 0],
      [4, 8, 0x128, 0],
    ],
    ink: [2, 13],
  },
  // Built by ISS Forge from pieces of other letters (no new tiles):
  // B = top of P + bottom of D, F = top of E + bottom of P, J = right half of U
  B: {
    pieces: [
      [0, 0, 0x10e, 0],
      [8, 0, 0x10f, 0],
      [2, 8, 0x112, 0],
      [10, 8, 0x113, 0],
    ],
    ink: [4, 17],
  },
  F: {
    pieces: [
      [0, 0, 0x104, 0],
      [8, 0, 0x105, 0],
      [0, 8, 0x11e, 0],
      [8, 8, 0x11f, 0],
    ],
    ink: [4, 13],
  },
  J: {
    pieces: [
      [0, 8, 0x136, 0],
      [7, 0, 0x127, 0],
      [8, 8, 0x137, 0],
    ],
    ink: [1, 13],
  },
};

/** Layout of the main menu sprite texts */
export const MENU_SPRITE_LAYOUT = {
  SPACE: 7, // pixels between two words (ink to ink)
  START: -95, // dx of the first letter (x = 128 + dx)
  MAX_RIGHT: 124, // last ink column allowed (x = 252)
  // 34 sprite slivers per scanline; the cursor takes 1
  MAX_SLIVERS: 33,
  MAX_SPRITES: 31,
};

/**
 * OBJ tiles of the menu font: compressed block (56 tiles, loaded to VRAM 0x7000 =
 * tiles 0x100-0x137 by the main menu only). It cannot grow (no free area is big
 * enough), so new letters take the tiles of a letter the texts do not use.
 */
export const MENU_FONT_BLOCK = {
  offset: 0x6ccc0,
  pointer: 0x1045e,
  capacity: 1356,
  firstTile: 0x100,
};

/**
 * Letters drawn by ISS Forge for the menu font (16x16, palette 6; pixels = 16 rows
 * of colour indices, "." = transparent), in the style of the other letters. The
 * font block cannot grow, so each drawn letter used by the menu takes the 4 tiles
 * of a 16x16 letter that no item uses (MENU_FONT_SLOTS, in this order).
 */
export const MENU_FONT_SLOTS = ['K', 'W', 'D', 'P', 'M', 'R', 'N', 'S', 'E', 'A', 'O'];

export const MENU_SPRITE_DRAWN = {
  H: {
    ink: [1, 14],
    pixels: [
      '................',
      '.663......663...',
      '.7732.....7732..',
      '.88321....88321.',
      '.99321....99321.',
      '.aa321....aa321.',
      '.bbeeeeeeebb321.',
      '.cc7777777cc321.',
      '.dd3555555dd321.',
      '.dd3244444dd321.',
      '.ee321....ee321.',
      '.ee321....ee321.',
      '.ee321....ee321.',
      '.77321....77321.',
      '..5521.....5521.',
      '...441......441.',
    ],
  },
  V: {
    ink: [1, 14],
    pixels: [
      '................',
      '.663......663...',
      '.7732.....7732..',
      '.88321....88321.',
      '..99321..99321..',
      '..aa321..aa321..',
      '..bb321..bb321..',
      '...cc321cc321...',
      '...dd321dd321...',
      '....dd3dd321....',
      '....ee3ee321....',
      '.....eeee321....',
      '.....eee321.....',
      '......77321.....',
      '.......5521.....',
      '........441.....',
    ],
  },
  Q: {
    ink: [0, 15],
    pixels: [
      '................',
      '....389a9611....',
      '..188754689311..',
      '.18866543279411.',
      '.8866321..18931.',
      '398631.....6a811',
      '8a652......1b921',
      'ab641......1cc21',
      '9c731......3da21',
      '6c931......8d821',
      '29e731....4eb521',
      '.2ce95114eeb6521',
      '.12beeeeeeee641.',
      '..127bcdb977741.',
      '...1247777555521',
      '.....12345441441',
    ],
  },
  X: {
    ink: [1, 14],
    pixels: [
      '................',
      '.663......663...',
      '.7732.....7732..',
      '..88321..88321..',
      '...9932199321...',
      '....aa3aa321....',
      '.....bbb211.....',
      '.....ccc321.....',
      '....dd3dd321....',
      '...dd321dd321...',
      '..ee321..ee321..',
      '.ee321....ee321.',
      '.ee321....ee321.',
      '.77321....77321.',
      '..5521.....5521.',
      '...441......441.',
    ],
  },
  Z: {
    ink: [2, 15],
    pixels: [
      '................',
      '..eeeeeeeeeee3..',
      '..7777777777732.',
      '...5555555885521',
      '.........99321..',
      '........aa321...',
      '.......bb321....',
      '......cc321.....',
      '.....dd321......',
      '....dd321.......',
      '...ee321........',
      '..ee321.........',
      '..eeeeeeeeeee3..',
      '..7777777777732.',
      '...5555555555521',
      '....444444444441',
    ],
  },
};

const joypadName = (index, id, room = 26) => ({
  id,
  kind: 'fixed',
  table: 0x11931,
  index,
  columns: 26,
  room,
});
const joypadHelp = (index, id) => ({
  id,
  kind: 'box',
  pack: 'joypadHelp',
  index,
  lines: 7,
  columns: 26,
});

const mainMenuItem = (index, id) => ({
  id,
  kind: 'sprite',
  pack: 'mainMenu',
  index,
  row: -91 + index * 24, // dy of the item (y = 112 + dy)
});

export const SCREEN_TEXTS = [
  {
    id: 'mainMenu',
    label: 'Main menu',
    fields: [
      mainMenuItem(0, 'openGame'),
      mainMenuItem(1, 'internationalCup'),
      mainMenuItem(2, 'worldSeries'),
      mainMenuItem(3, 'training'),
      mainMenuItem(4, 'scenarios'),
      mainMenuItem(5, 'penaltyKick'),
      mainMenuItem(6, 'password'),
      mainMenuItem(7, 'options'),
    ],
  },
  {
    id: 'joypad',
    label: 'Joypad controls (Options)',
    fields: [
      { id: 'intro', kind: 'fixed', at: 0x11f67, lines: 3, columns: 23 },
      { id: 'lob', kind: 'label', at: 0x11fac, columns: 9, mirror: 14 },
      { id: 'pass', kind: 'label', at: 0x11fc3, columns: 9, mirror: 14 },
      { id: 'shoot', kind: 'label', at: 0x11fda, columns: 9, mirror: 14 },
      { id: 'dash', kind: 'label', at: 0x11ff1, columns: 9, mirror: 14 },
      { id: 'playerChange', kind: 'box', at: 0x12008, room: 22, lines: 2, columns: 10 },
      joypadName(1, 'nameLob'),
      joypadHelp(1, 'helpLob'),
      joypadName(2, 'namePass'),
      joypadHelp(2, 'helpPass'),
      joypadName(3, 'nameShoot'),
      joypadHelp(3, 'helpShoot'),
      joypadName(4, 'nameDash'),
      joypadHelp(4, 'helpDash'),
      joypadName(5, 'nameTypeA', 30),
      joypadHelp(5, 'helpTypeA'),
      joypadName(6, 'nameTypeB', 30),
      joypadHelp(6, 'helpTypeB'),
      joypadName(7, 'nameTypeB2', 30),
      joypadHelp(7, 'helpTypeB2'),
      joypadName(8, 'nameStrategy'),
      joypadHelp(8, 'helpStrategy'),
      joypadName(9, 'nameSkills'),
      joypadHelp(9, 'helpSkills'),
      joypadName(10, 'nameFlick'),
      joypadHelp(10, 'helpFlick'),
    ],
  },
  {
    id: 'scenario',
    label: 'Scenario (before / after the match)',
    fields: [
      { id: 'vs', kind: 'fixed', at: 0x11911, columns: 2 },
      // "SCORE" + 2 cells kept by the game + "-": the digits are drawn after it
      { id: 'score', kind: 'fixed', at: 0x11913, columns: 5 },
      // "TIME" + " 00:00" (digits drawn by the game)
      { id: 'time', kind: 'fixed', at: 0x1191b, columns: 4 },
      { id: 'extraTime', kind: 'fixed', at: 0x11927, columns: 10 },
      { id: 'congrats', kind: 'fixed', at: 0x12aa7, columns: 16 },
      { id: 'qualify', kind: 'box', at: 0x12ab7, room: 35, lines: 2, columns: 18 },
      { id: 'unlucky', kind: 'box', at: 0x12ada, room: 33, lines: 2, columns: 18 },
    ],
  },
  {
    id: 'cupGroup',
    label: 'International Cup group (bottom line)',
    fields: [
      { id: 'nextGame', kind: 'fixed', at: 0x1201e, columns: 8 },
      { id: 'vs', kind: 'fixed', at: 0x1202a, columns: 2 },
    ],
  },
  {
    id: 'worldSeries',
    label: 'World Series (season and stage ordinals)',
    fields: [
      { id: 'season1', kind: 'fixed', at: 0x175ed, columns: 3 },
      { id: 'season2', kind: 'fixed', at: 0x175f0, columns: 3 },
      { id: 'stage1', kind: 'fixed', at: 0x175f3, columns: 2 },
      { id: 'stage2', kind: 'fixed', at: 0x175f5, columns: 2 },
      { id: 'stage3', kind: 'fixed', at: 0x175f7, columns: 2 },
      { id: 'stageN', kind: 'repeat', at: 0x175f9, columns: 2, count: 20 },
    ],
  },
  {
    id: 'training',
    label: 'Training (before each drill)',
    fields: [{ id: 'level', kind: 'fixed', at: 0x11403, columns: 7 }],
  },
  {
    id: 'titles',
    label: 'Mode titles (big letters)',
    fields: [
      { id: 'cup', kind: 'title', offset: 0xd4b15 },
      { id: 'cupFinal', kind: 'title', offset: 0xd4c4e },
      { id: 'cupTournament', kind: 'title', offset: 0x97e5e },
      { id: 'championship', kind: 'title', offset: 0xd4d97 },
      { id: 'worldSeries1', kind: 'title', offset: 0xd4eac },
      { id: 'worldSeries2', kind: 'title', offset: 0xf367a },
      { id: 'special', kind: 'title', offset: 0xa6187 },
    ],
  },
];

/** [start, end) byte ranges touched by the screen texts (undo snapshots) */
export const SCREEN_TEXT_RANGES = [
  [0x11403, 0x1140a],
  [0x11911, 0x1202c],
  [0x12aa5, 0x12afb],
  [0x175ed, 0x17621],
  [0x39e1f, 0x39e2f],
  [0x43c4f, 0x43e3f],
  [0x6ccc0, 0x6ccc0 + 1356], // menu font tiles (MENU_FONT_BLOCK)
  [0x97b09, 0x97b09 + 839], // title font tiles (TITLE_FONT_BLOCK)
];

// ============================================================
// MATCH PALETTES (pitch, ball, referee)
//
// Palettes are uploaded by a palette-script system ($80:AB2B / $80:ACF0):
// descriptors in bank $81 point to blobs in bank $85 (file 0x28000 +).
// The pitch list is chosen at $00:CD32 from $81:94BC[$81:9530[$1FA0] + $1F92]:
//   $1FA0 = pitch type (0 = A, 1 = B, 2 = C) → base 6 / 0 / 6 (A and C share colours)
//   $1F92 = weather (0 = sunny, 1 = rain, 2 = snow)
// Offsets below point to colour 1 of the CGRAM row (colour 0 is transparent
// and skipped by the loader). Verified in-game with snes9x and test ROMs.
// ============================================================

export const MATCH_PALETTES = [
  // Grass — BG rows 2-3 (30 colours, includes pitch lines)
  { id: 'grassB_sunny', group: 'pitch', type: 'B', weather: 'sunny', offset: 0x2dc3f, count: 30 },
  { id: 'grassB_rain', group: 'pitch', type: 'B', weather: 'rain', offset: 0x2e08b, count: 30 },
  { id: 'grassB_snow', group: 'pitch', type: 'B', weather: 'snow', offset: 0x2e04d, count: 30 },
  { id: 'grassAC_sunny', group: 'pitch', type: 'AC', weather: 'sunny', offset: 0x2dd33, count: 30 },
  { id: 'grassAC_rain', group: 'pitch', type: 'AC', weather: 'rain', offset: 0x2fd0f, count: 30 },
  { id: 'grassAC_snow', group: 'pitch', type: 'AC', weather: 'snow', offset: 0x2fcb1, count: 30 },
  // Pitch detail — BG row 7 (15 colours). The sunny one is shared by type B (all weathers) and A/C sunny
  { id: 'detail_shared', group: 'pitchDetail', offset: 0x2dcd5, count: 15 },
  {
    id: 'detailAC_rain',
    group: 'pitchDetail',
    type: 'AC',
    weather: 'rain',
    offset: 0x2fd4d,
    count: 15,
  },
  {
    id: 'detailAC_snow',
    group: 'pitchDetail',
    type: 'AC',
    weather: 'snow',
    offset: 0x2fcef,
    count: 15,
  },
  // Ball — OBJ row 15, colours 2-10 (colour 1 and 11-15 are other HUD sprites)
  { id: 'ball', group: 'ball', offset: 0x2dedf, count: 9 },
  // Referee and linesmen — OBJ row 14, same layout as the team kits
  { id: 'referee', group: 'referee', offset: 0x2e959, count: 15 },
  // Stadium — shared by every pitch type and weather (blob $85:DC1F, BG rows 1-7)
  { id: 'stadium_wall', group: 'stadium', offset: 0x2dc7b, count: 15 }, // BG row 4: perimeter wall + goal net
  { id: 'stadium_people', group: 'stadium', offset: 0x2dc21, count: 15 }, // BG row 1: photographers by the pitch
];

/**
 * Crowd (BG rows 5-6). Each team points to one of 20 crowd palettes through a
 * per-team table indexed by ROM ordinal ($81:9362[$1720], loaded at $07:DB63):
 * the crowd follows the HOME team (team 1). Several teams share palettes.
 * Descriptors are 3 bytes at $81:88AB + n*3 → blob in bank $85 (31 colours,
 * only the first 30 are visible: row 5 colours 1-15 and row 6 colours 1-15).
 */
export const CROWD_DATA = {
  TEAM_TABLE: 0x9362,
  DESCRIPTOR_START: 0x88ab,
  DESCRIPTOR_STEP: 3,
  COUNT: 20,
  COLORS: 30,
  BLOB_BANK_FILE_BASE: 0x28000, // bank $85
};

/** Colour slots in each crowd row (15 colours); offsets 0 and 15 give the two rows */
export const CROWD_PARTS = [
  { key: 'outline', from: 0, count: 1 },
  { key: 'skin', from: 1, count: 4 },
  { key: 'shirtA', from: 5, count: 3 },
  { key: 'neutral', from: 8, count: 3 },
  { key: 'shirtB', from: 11, count: 3 },
  { key: 'shadow', from: 14, count: 1 },
];

/** Colour slots of the referee palette (indexes into the 15 colours) */
export const REFEREE_PARTS = [
  { key: 'hair', from: 0, count: 1 },
  { key: 'skin', from: 1, count: 5 },
  { key: 'shirt', from: 6, count: 3 },
  { key: 'shorts', from: 9, count: 3 },
  { key: 'socks', from: 12, count: 2 },
  { key: 'extra', from: 14, count: 1 },
];

// ============================================================
// TITLE SCREEN ("INTERNATIONAL SUPERSTAR SOCCER" + PRESS START)
//
// Set up at $80:8CD5: VRAM load lists $82:804C / $82:8178, palette list
// $81:8A44 (descriptors $81:8800-$8830, used only by this screen). The logo
// flashes through $81:811C = lists 8A5C, 8A60, 8A64 (flash steps), 8A76 (logo
// hidden in the sky colour) and 8A68 (grass + normal logo).
// Layers: BG1 4bpp (map $1000, tiles $2000: brush stroke + grass), BG3 2bpp
// (map $5C00, tiles $5000: copyright + PRESS START), OBJ (base $6000: logo,
// players, ball). See research/title-screen.md.
// ============================================================

export const TITLE_SCREEN = {
  /**
   * Editable colour groups. `offset` = file offset of the first colour, `row` /
   * `first` = where it lands in CGRAM (for the preview).
   * logoTop / logoBottom colour 15 (outline) is stored as a "1 x black" command
   * word ($8001); writing a colour there replaces it with a plain colour.
   */
  COLORS: [
    { id: 'sky', offset: 0x2d49e, count: 1, row: 0, first: 0 }, // backdrop
    { id: 'copyright', offset: 0x2d4a0, count: 3, row: 0, first: 1 }, // BG3 palette 0
    { id: 'pressStart', offset: 0x2d4a8, count: 3, row: 0, first: 5 }, // BG3 palette 1
    { id: 'grass', offset: 0x2dcf5, count: 30, row: 2, first: 1 }, // BG rows 2-3
    { id: 'stroke', offset: 0x2d4fe, count: 15, row: 7, first: 1 }, // red brush stroke
    { id: 'logoTop', offset: 0x2d4c0, count: 15, row: 10, first: 1 }, // "INTERNATIONAL"
    { id: 'logoBottom', offset: 0x2d4de, count: 15, row: 11, first: 1 }, // "SUPERSTAR SOCCER"
    { id: 'tm', offset: 0x2d520, count: 12, row: 15, first: 4 }, // "TM" (colours 1-3 = command)
  ],
  /** Flash steps of the logo (logoTop 15 colours + logoBottom 15 colours each) */
  LOGO_FLASH: [0x2d53a, 0x2d578, 0x2d5b6],
  /** 15 x sky colour: hides the grass, players and logo while they fade in */
  SKY_FILL: { offset: 0x2d5f4, count: 15 },
  /** Teams of the two players: immediate of LDA #$xx / STA $1720 and STA $1770 (ordinal x 2) */
  TEAM_LEFT: 0x0d19,
  TEAM_RIGHT: 0x0d1f,
  /** "PRESS START": VRAM word address + letters (A = 1 ... Z = 26, 0 = space), 0xFF ends */
  PRESS_START: { offset: 0x8645, attr: 0x2400 },
  /** VRAM load lists of the screen (bank $82): [word dest, 24-bit pointer] entries */
  LOAD_LISTS: [0x1004c, 0x10178],
  /** Palettes the preview reads from elsewhere: ball (OBJ row 14) */
  BALL_PALETTE: { offset: 0x2dedd, count: 15, row: 14, first: 1 },
  /**
   * Texts (BG3, 2bpp). Tiles 0x00-0x1F = the shaded title font (block shared
   * with other screens, never changed): space, A-Z = 1-26, "." "1" "5" "9" "©".
   * Tiles 0x20-0x5F = plain font in ASCII order (block TEXT.FONT, loaded only by
   * the title screen and the wrong-region warning): extra characters of the
   * copyright are redrawn there in the shaded style (rows coloured
   * GLYPH_ROW_COLORS, the same rule the Konami letters follow).
   */
  TEXT: {
    MAP: 0xd43c8, // compressed 32x32 BG3 map (MENU_SCREENS entry, can move)
    FONT: 0x7f81b, // compressed plain font, BG3 tiles 0x00-0x5F (MENU_SCREENS entry)
    MAP_ROWS: [24, 25, 26], // copyright lines, centred
    COLUMNS: 32,
    ATTR: 0x2000, // palette 0, priority
    PRESS_ROW: 14,
    /** LDX #$8645 at $80:84B5 and $80:8F2E (bank $81) */
    PRESS_POINTERS: [0x04b6, 0x0f2f],
    PRESS_HOME: 0x8645,
    PRESS_HOME_LENGTH: 11,
    /** Reserved end of bank $81 for a longer PRESS START (2 + 32 + 1 bytes) */
    PRESS_SPARE: 0xffdd,
    GLYPH_ROW_COLORS: [2, 1, 3, 3, 3, 1, 2, 2],
  },
  /**
   * Logo: OBJ sprites. The sprite list (block LIST, loaded by the $82:8038 list
   * entry "FE ptr D000" and expanded to $7E:5000) is [1, n (word), n] and then
   * 4 arrays of n bytes: dx, dy (relative to ORIGIN), tile, attr (bit 4 =
   * 16x16, bits 1-3 = palette, ORed with palette 2 by the logo object, bit 0 =
   * tile bit 8, bit 7 = vertical flip). Tiles: block TILES, loaded to
   * TILE_DEST_ENTRY's VRAM word address ($6700 = OBJ tile 0x70 originally).
   */
  LOGO: {
    TILES: 0xf71c8,
    LIST: 0xf7b25,
    /** Both blocks live in this area (only this screen uses them): [start, end) */
    AREA: [0xf71c8, 0xf7caa],
    /** 24-bit pointers: tiles (VRAM list $82:8178) and sprite list ($82:8038) */
    TILES_POINTER: 0x1018b,
    LIST_POINTER: 0x10039,
    TILE_DEST_ENTRY: 0x10189,
    ORIGINAL_DEST: 0x6700,
    /** Imported logos: OBJ tiles 0x60-0x17F (free on this screen), loaded to $6600 */
    FIRST_TILE: 0x60,
    LAST_TILE: 0x17f,
    MAX_SPRITES: 107,
    ORIGIN: [128, 112],
    /** Room for an imported logo (keeps clear of PRESS START on row 14) */
    MAX_WIDTH: 240,
    MAX_HEIGHT: 88,
    CENTER: [128, 60],
    /** "TM" sprites of the original logo (OBJ palette 7) */
    TM_TILES: [0xe9, 0xea],
  },
  /**
   * Background (BG1 4bpp, map $1000, tiles $2000). Rows 0-13: brush stroke
   * (tiles 1-0x54, BG palette 7, revealed by a window wipe). Rows 14-27: grass,
   * an 8x4 pattern of tiles 0xDC-0xEA (palettes 2-3) from a block that other
   * screens also load (loaded after TILES, so imported images never use those
   * tile numbers). Tile 0 is blank. MAP and TILES are MENU_SCREENS entries.
   */
  BACKGROUND: {
    MAP: 0x67e6e,
    TILES: 0xbe106,
    TOP_ROWS: [0, 14],
    GRASS_ROWS: [14, 28],
    RESERVED_TILES: [0xdc, 0xeb],
    LAST_TILE: 0x2ff,
    TOP_PALETTE: 7,
    GRASS_PALETTES: [2, 3],
    /** Where an imported top image is centred (8-pixel grid) */
    TOP_CENTER: [128, 56],
    /** Largest repeated grass texture (pixels) */
    PATTERN_MAX: 64,
  },
  /**
   * Players: LDY #frame before JSL $83:D536 (frame records in bank $82: sprite
   * list word in bank $88 + 2 pointers to raw tile rows, DMA'd to the object's
   * OBJ tiles). Left = object $0E80 (x 0x72, tiles 0x40, palette 0), right =
   * object $0DE0 (x 0x90, tiles 0x20, palette 1, mirrored). Feet at y 0xB0.
   */
  PLAYERS: {
    LEFT: { pose: 0x0d9b, x: 0x72, tile: 0x40, palette: 0, flip: false },
    RIGHT: { pose: 0x0d5b, x: 0x90, tile: 0x20, palette: 1, flip: true },
    Y: 0xb0,
    /** Frame records live in $82:BC00-$82:F2E0 (file 0x13C00-0x172E0) */
    FRAMES: [0x13c00, 0x172e0],
  },
  /**
   * Objects set up by the title screen code ($80:8D24-$8DDA): each value below is
   * the 16-bit operand of an LDA #imm. An object with handler 0 is never run, so
   * it is not drawn (the handlers are the original ones, restored to show it).
   * Ball: object $0480 (x, ground y, height z < 0 = above the ground) + its
   * shadow, object $1620, at the same x / y. Player shadows: objects $16A0
   * (left) and $1660 (right). Players: x of $0E80 / $0DE0 and their shared
   * feet y ($80:8DE4).
   */
  OBJECTS: {
    BALL: {
      x: 0x0da8,
      y: 0x0db0,
      z: 0x0db8,
      handlers: [
        [0x0dca, 0x805d],
        [0x0dcf, 0x806c],
      ],
    },
    SHADOW_LEFT: { x: 0x0d68, y: 0x0d6d, handlers: [[0x0d72, 0x80e2]] },
    SHADOW_RIGHT: { x: 0x0d28, y: 0x0d2d, handlers: [[0x0d32, 0x80e2]] },
    PLAYER_LEFT_X: 0x0d84,
    PLAYER_RIGHT_X: 0x0d44,
    PLAYERS_Y: 0x0de5,
  },
  /** Byte ranges written by this editor (undo snapshots) */
  RANGES: [
    // title screen set-up code: teams, poses, ball / shadows / player positions (immediates)
    [0x0d19, 0x0de7],
    [0x2d49e, 0x2d4ae],
    [0x2d4c0, 0x2d4fc],
    [0x2d4fe, 0x2d51c],
    [0x2d520, 0x2d538],
    [0x2d53a, 0x2d5f2],
    [0x2d5f4, 0x2d612],
    [0x2dcf5, 0x2dd31],
    // PRESS START: home, reserved spare and the two pointers
    [0x8645, 0x8653],
    [0xffdd, 0x10000],
    [0x04b6, 0x04b8],
    [0x0f2f, 0x0f31],
    // logo: VRAM address and pointers of the tiles, sprite list pointer, both blocks
    [0x10189, 0x1018e],
    [0x10039, 0x1003c],
    [0xf71c8, 0xf7caa],
  ],
};

// ============================================================
// ROM OFFSETS - Player Names
// ============================================================

export const PLAYER_NAMES = {
  OFFSET: 0x3b62c,
  NAME_LENGTH: 8, // chars per name
  TEAM_LENGTH: 15 * 8, // 120 bytes per team (15 players * 8 chars)
  TOTAL_LENGTH: 27 * 15 * 8, // 3240 bytes total
};

// ============================================================
// ROM OFFSETS - Player Data (6 bytes per player)
// ============================================================

export const PLAYER_DATA = {
  BASE_OFFSET: 0x387ec,
  PLAYER_LENGTH: 6, // 6 bytes per player
  TEAM_LENGTH: 90, // 15 players * 6 bytes = 90 bytes per team
  // The blocks are in ROM ordinal order (Scotland = 5): the game reads them through the
  // pointer table $01:DED7 indexed by the team id. Use playerDataOffset() below.
  POINTERS: 0x0ded7,

  // Within each 6-byte player block (decoded by the game at $05:A8EB, see
  // research/hidden-player-attributes.md):
  // Byte 0: High nibble = top speed without the ball, Low nibble = start speed (acceleration)
  // Byte 1: Bits 6-4 = Shooting index, Low nibble = goalkeeper kick power (0-7, GK only)
  // Byte 2: High nibble = Stamina, Bits 2-0 = Technique index
  // Byte 3: High nibble = top speed with the ball, Low nibble = shirt number - 1
  // Byte 4: High nibble = attack duel (opponent half), Low nibble = defence duel (own half)
  // Byte 5: Upper 2 bits = Color type (NORMAL/SPECIAL), Lower 4 bits = Hair Style
};

// Player Number offset (byte 3 of each 6-byte block)
export const PLAYER_NUMBER_OFFSET = 0x387ef;
// Hair Style + Color offset (byte 5 of each 6-byte block)
export const PLAYER_HAIRSTYLE_OFFSET = 0x387f1;

// ============================================================
// ROM OFFSETS - Team Visual Data
// ============================================================

export const TEAM_NAMES_TEXT = {
  OFFSET_START: 0x43ed5,
  OFFSET_END: 0x44486,
};

export const FLAG_TILES = {
  OFFSET_START: 0x48000,
  OFFSET_END: 0x48a7f,
};

export const TEAM_NAME_TILES = {
  OFFSET_START: 0x17680,
  OFFSET_END: 0x17fff,
};

// ============================================================
// ROM OFFSETS - Uniform Colors
// Based on rodmguerra/issparser UniformColorRomHandler.java
// Teams are split into 2 ranges with different orders!
// ============================================================

// Each main kit: Shirt(3 colors) + Shorts(3 colors) + Socks(2 colors) = 16 bytes used, 32 byte step
// Each goalkeeper kit: ShirtAndSocks(5 colors) + Shorts(1 color) = 12 bytes used, 24 byte step
// Colors are SNES 15-bit: 0bbbbbgggggrrrrr (2 bytes each, little-endian)

export const UNIFORM_COLORS = {
  FIRST_KIT_RANGE1_OFFSET: 0x2ea3b,
  SECOND_KIT_RANGE1_OFFSET: 0x2ecbb,
  FIRST_KIT_RANGE2_OFFSET: 0x2f0eb,
  SECOND_KIT_RANGE2_OFFSET: 0x2f1eb,
  KEEPER_KIT_RANGE1_OFFSET: 0x2ef37,
  KEEPER_KIT_RANGE2_OFFSET: 0x2f2e7,
  PREDOMINANT_COLOR_OFFSET: 0x8db2,
  TEAM_KIT_STEP: 32,
  KEEPER_KIT_STEP: 24,
  SHIRT_COLORS: 3,
  SHORTS_COLORS: 3,
  SOCKS_COLORS: 2,
  KEEPER_SHIRT_COLORS: 5,
  KEEPER_SHORTS_COLORS: 1,
};

// Order of teams in Range 1 (for first/second kits)
export const UNIFORM_RANGE1_TEAMS = [
  'GERMANY',
  'ITALY',
  'HOLLAND',
  'SPAIN',
  'ENGLAND',
  'FRANCE',
  'SWEDEN',
  'IRELAND',
  'BELGIUM',
  'ROMANIA',
  'BULGARIA',
  'ARGENTINA',
  'BRAZIL',
  'COLOMBIA',
  'MEXICO',
  'USA',
  'NIGERIA',
  'CAMEROON',
  'SUPERSTAR',
];

// Order of teams in Range 1 for goalkeeper kits (no Superstar)
export const UNIFORM_KEEPER_RANGE1_TEAMS = [
  'GERMANY',
  'ITALY',
  'HOLLAND',
  'SPAIN',
  'ENGLAND',
  'FRANCE',
  'SWEDEN',
  'IRELAND',
  'BELGIUM',
  'ROMANIA',
  'BULGARIA',
  'ARGENTINA',
  'BRAZIL',
  'COLOMBIA',
  'MEXICO',
  'USA',
  'NIGERIA',
  'CAMEROON',
];

// Order of teams in Range 2
export const UNIFORM_RANGE2_TEAMS = [
  'RUSSIA',
  'SCOTLAND',
  'SKOREA',
  'WALES',
  'NORWAY',
  'SWISS',
  'DENMARK',
  'AUSTRIA',
];

// ============================================================
// ROM OFFSETS - Hair and Skin Colors
// Hair/Skin data is stored BEFORE uniform data in same blocks
// Outfield: 12 bytes before uniform (1 hair color + 5 skin colors)
// Keeper: 8 bytes before uniform (1 hair color + 3 skin colors)
// Based on rodmguerra/issparser HairAndSkinRomHandler.java
// ============================================================

export const HAIR_SKIN_COLORS = {
  // Offsets are uniform offsets - 12 for outfield, - 8 for keeper
  FIRST_RANGE1_OFFSET: 0x2ea3b - 12, // 0x2EA2F
  SECOND_RANGE1_OFFSET: 0x2ecbb - 12, // 0x2ECAF
  FIRST_RANGE2_OFFSET: 0x2f0eb - 12, // 0x2F0DF
  SECOND_RANGE2_OFFSET: 0x2f1eb - 12, // 0x2F1DF
  KEEPER_RANGE1_OFFSET: 0x2ef37 - 8, // 0x2EF2F
  KEEPER_RANGE2_OFFSET: 0x2f2e7 - 8, // 0x2F2DF
  OUTFIELD_STEP: 32,
  KEEPER_STEP: 24,
  HAIR_COLORS: 1,
  OUTFIELD_SKIN_COLORS: 5,
  KEEPER_SKIN_COLORS: 3,
};

// ============================================================
// ROM OFFSETS - Flag Colors
// 4 colors per flag, 10 bytes step (8 used + 2 padding)
// Based on rodmguerra/issparser FlagColorRomHandler.java
// ============================================================

export const FLAG_COLORS = {
  RANGE1_OFFSET: 0x2dd91,
  RANGE2_OFFSET: 0x2de4f,
  STEP: 10,
  COLOR_COUNT: 4,
};

// Flag color teams have a DIFFERENT order from uniform teams!
export const FLAG_RANGE1_TEAMS = [
  'GERMANY',
  'ENGLAND',
  'ITALY',
  'HOLLAND',
  'FRANCE',
  'SPAIN',
  'BELGIUM',
  'IRELAND',
  'COLOMBIA',
  'BRAZIL',
  'ARGENTINA',
  'MEXICO',
  'NIGERIA',
  'CAMEROON',
  'USA',
  'BULGARIA',
  'ROMANIA',
  'SWEDEN',
];

export const FLAG_RANGE2_TEAMS = [
  'SCOTLAND',
  'SKOREA',
  'SUPERSTAR',
  'RUSSIA',
  'SWISS',
  'DENMARK',
  'AUSTRIA',
  'WALES',
  'NORWAY',
];

// ============================================================
// FLAG DESIGN POINTER TABLE ORDINALS
// The flag pointer table at 0x941A uses a different team ordering
// than our TEAMS array. It uses the "ordinal" order from ISS Studio:
// Germany, Italy, Holland, Spain, England, SCOTLAND, Wales, France, ...
// Our TEAMS array has Scotland at position 24 instead of 5.
// This maps our teamIndex -> flag pointer table index.
// ============================================================

export const FLAG_DESIGN_ORDINALS = [
  0, // 0: Germany
  1, // 1: Italy
  2, // 2: Holland
  3, // 3: Spain
  4, // 4: England
  6, // 5: Wales → ordinal 6 (Scotland is 5 in ROM)
  7, // 6: France → ordinal 7
  8, // 7: Denmark → ordinal 8
  9, // 8: Sweden → ordinal 9
  10, // 9: Norway → ordinal 10
  11, // 10: Ireland → ordinal 11
  12, // 11: Belgium → ordinal 12
  13, // 12: Austria → ordinal 13
  14, // 13: Swiss → ordinal 14
  15, // 14: Romania → ordinal 15
  16, // 15: Bulgaria → ordinal 16
  17, // 16: Russia → ordinal 17
  18, // 17: Argentina → ordinal 18
  19, // 18: Brazil → ordinal 19
  20, // 19: Colombia → ordinal 20
  21, // 20: Mexico → ordinal 21
  22, // 21: USA → ordinal 22
  23, // 22: Nigeria → ordinal 23
  24, // 23: Cameroon → ordinal 24
  5, // 24: Scotland → ordinal 5
  25, // 25: S.Korea → ordinal 25
  26, // 26: Super Star → ordinal 26
];

// ============================================================
// SPECIAL HAIR & SKIN (per-team, for "Special" type players)
// Players marked as "Special" use these team-wide presets
// instead of the Normal hair/skin colors.
// Based on rodmguerra/issparser SpecialHairRomHandler.java
// and SpecialSkinRomHandler.java
// ============================================================

export const SPECIAL_HAIR = {
  OFFSET: 0x8d74,
  STEP: 2,
  TYPES: [
    { id: 0, key: 'regular', bytes: [0x00, 0x00] },
    { id: 1, key: 'blond', bytes: [0x1d, 0xea] },
    { id: 2, key: 'lightBrown', bytes: [0x11, 0xea] },
    { id: 3, key: 'darkBrown', bytes: [0x15, 0xea] },
    { id: 4, key: 'black', bytes: [0x19, 0xea] },
  ],
};

export const SPECIAL_SKIN = {
  OFFSET: 0x8d3c,
  STEP: 2,
  TYPES: [
    { id: 0, key: 'regular', bytes: [0x00, 0x00] },
    { id: 1, key: 'white', bytes: [0xe1, 0xe9] },
    { id: 2, key: 'brown', bytes: [0xf9, 0xe9] },
    { id: 3, key: 'black', bytes: [0x05, 0xea] },
  ],
};

// ============================================================
// HAIR STYLES
// ============================================================

export const HAIR_STYLES = [
  { id: 0, name: 'Cabelo Curto', nameEn: 'Short hair' },
  { id: 1, name: 'Cabelo Cacheado', nameEn: 'Curly hair' },
  { id: 2, name: 'Cacheado Longo', nameEn: 'Long curly' },
  { id: 3, name: 'Longo com Barba', nameEn: 'Long with beard' },
  { id: 4, name: 'Longo Liso', nameEn: 'Long straight' },
  { id: 5, name: 'Dreadlocks', nameEn: 'Dreadlocks' },
  { id: 6, name: 'Afro', nameEn: 'Afro' },
  { id: 7, name: 'Rabo de Cavalo', nameEn: 'Ponytail' },
  { id: 8, name: 'Careca', nameEn: 'Bald' },
  { id: 9, name: 'Comprimento Medio', nameEn: 'Mid length' },
  { id: 10, name: 'Longo com Fita', nameEn: 'Long with ribbon' },
];

// ============================================================
// PLAYER COLOR TYPES
// ============================================================

export const PLAYER_COLORS = [
  { id: 0, name: 'Normal', description: 'Pele/cabelo padrao' },
  { id: 1, name: 'Especial', description: 'Pele/cabelo alternativo (mais escuro)' },
];

// ============================================================
// SHOOTING/TECHNIQUE VALUE MAP
// The game uses 3 bits (0-7) mapping to odd values 1-15
// ============================================================

export const SHOOTING_VALUES = [1, 3, 5, 7, 9, 11, 13, 15];

// ============================================================
// ISS TEXT CHARACTER MAP
// The game uses a custom character encoding (from ISS Studio source)
// Reference: EstebanFuentealba/web-iss-studio ParsingUtils.issChar
// ============================================================

// Build the character table programmatically based on the actual ROM encoding:
// 0x00 = space
// 0x54 = '.'
// 0x56 = '"'
// 0x5C = '\''
// 0x5F = '/'
// 0x62-0x6B = '0'-'9'
// 0x6C-0x85 = 'A'-'Z'
// 0x86-0x9F = 'a'-'z'

export const ISS_CHAR_TABLE = {};

// Space
ISS_CHAR_TABLE[0x00] = ' ';

// Special characters
ISS_CHAR_TABLE[0x54] = '.';
ISS_CHAR_TABLE[0x56] = '"';
ISS_CHAR_TABLE[0x5c] = "'";
ISS_CHAR_TABLE[0x5f] = '/';

// Digits: 0x62 = '0', 0x63 = '1', ... 0x6B = '9'
for (let i = 0; i <= 9; i++) {
  ISS_CHAR_TABLE[0x62 + i] = String.fromCharCode('0'.charCodeAt(0) + i);
}

// Uppercase: 0x6C = 'A', 0x6D = 'B', ... 0x85 = 'Z'
for (let i = 0; i < 26; i++) {
  ISS_CHAR_TABLE[0x6c + i] = String.fromCharCode('A'.charCodeAt(0) + i);
}

// Lowercase: 0x86 = 'a', 0x87 = 'b', ... 0x9F = 'z'
for (let i = 0; i < 26; i++) {
  ISS_CHAR_TABLE[0x86 + i] = String.fromCharCode('a'.charCodeAt(0) + i);
}

// Reverse lookup: char -> byte
export const ISS_CHAR_REVERSE = {};
for (const [byte, char] of Object.entries(ISS_CHAR_TABLE)) {
  ISS_CHAR_REVERSE[char] = parseInt(byte);
}
