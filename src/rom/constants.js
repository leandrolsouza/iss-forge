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

/** Characters with a glyph in the scenario text font ($82:8C80) */
export const SCENARIO_TEXT_CHARSET =
  ' !"\',-.0123456789:?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

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

  // Within each 6-byte player block:
  // Byte 0: Abilities byte 0 (unknown/general)
  // Byte 1: High nibble = Shooting index, Low nibble = Speed?
  // Byte 2: High nibble = Stamina, Low nibble = Technique index
  // Byte 3: Player Number (lower nibble % 16 + 1)
  // Byte 4: Unknown
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
