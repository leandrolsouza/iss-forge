/**
 * AI Service — Prompt builder and LLM interaction for team generation
 *
 * Builds a system prompt with ROM constraints and validates LLM output
 * against the existing iss-forge-team JSON schema.
 */

/**
 * SNES color values must be multiples of 8 (5-bit RGB: 0-248 in steps of 8)
 * We'll allow any 0-255 value and the import logic handles clamping.
 */
const CONSTRAINTS = {
  playerNameMaxLength: 8,
  playerNameAllowedChars: "A-Z, a-z, 0-9, '.', '\"', \"'\", '/', space",
  playersPerTeam: 15,
  shirtNumberRange: { min: 1, max: 16 },
  shootingValues: [1, 3, 5, 7, 9, 11, 13, 15],
  shootingIndexRange: { min: 0, max: 7 },
  speedRange: { min: 1, max: 16 },
  staminaRange: { min: 1, max: 16 },
  techniqueValues: [1, 3, 5, 7, 9, 11, 13, 15],
  techniqueIndexRange: { min: 0, max: 7 },
  hairStyleRange: { min: 0, max: 10 },
  hairStyles: [
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
  ],
  colorRange: { min: 0, max: 248, step: 8 },
  flagColorCount: 4,
  teamNameTextMaxLength: 8,
  teamNameInGameMaxLength: 3,
  uniformStructure: {
    home: { shirt: 3, shorts: 3, socks: 2 },
    away: { shirt: 3, shorts: 3, socks: 2 },
    goalkeeper: { shirtAndSocks: 5, shorts: 1 },
  },
  hairSkinStructure: {
    first: { hair: 1, skin: 5 },
    second: { hair: 1, skin: 5 },
    goalkeeper: { hair: 1, skin: 3 },
  },
};

/**
 * Build the system prompt with all ROM constraints
 */
export function buildSystemPrompt() {
  return `You are a team generator for International Superstar Soccer (SNES 1995). You generate team data in a specific JSON format that will be imported into the game ROM.

## STRICT RULES — Follow these EXACTLY:

### Player Names
- Maximum ${CONSTRAINTS.playerNameMaxLength} characters per name
- Allowed characters: ${CONSTRAINTS.playerNameAllowedChars}
- Names are typically UPPERCASE or surname format (e.g., "ROBERTO", "Ronaldo", "TChalla")

### Team
- Exactly ${CONSTRAINTS.playersPerTeam} players per team
- Player 1 is always the goalkeeper
- Players 2-11 are starters (defenders, midfielders, forwards)
- Players 12-15 are substitutes
- teamNameText: max ${CONSTRAINTS.teamNameTextMaxLength} characters (shown in menus)
- teamNameInGame: exactly ${CONSTRAINTS.teamNameInGameMaxLength} characters (shown on scoreboard)

### Shirt Numbers
- Range: ${CONSTRAINTS.shirtNumberRange.min} to ${CONSTRAINTS.shirtNumberRange.max}
- Each player must have a unique number within the team

### Attributes
- shooting: one of [${CONSTRAINTS.shootingValues.join(', ')}] (odd values, higher = better)
- shootingIndex: index into the values array (0-7), where shootingIndex N gives shooting value at position N
- speed: ${CONSTRAINTS.speedRange.min} to ${CONSTRAINTS.speedRange.max} (integer, higher = faster)
- stamina: ${CONSTRAINTS.staminaRange.min} to ${CONSTRAINTS.staminaRange.max} (integer, higher = more endurance)
- technique: one of [${CONSTRAINTS.techniqueValues.join(', ')}] (same scale as shooting)
- techniqueIndex: index into the values array (0-7)

### Hair Styles
${CONSTRAINTS.hairStyles.map((h) => `- ${h}`).join('\n')}

### isSpecial
- false = player uses team's default hair/skin palette
- true = player uses special individual palette

### Colors (RGB)
- All color values must be multiples of 8, range 0-248
- Valid examples: 0, 8, 16, 24, ..., 240, 248

### Uniforms Structure
- home: shirt (3 colors, dark to light gradient), shorts (3 colors), socks (2 colors)
- away: shirt (3 colors), shorts (3 colors), socks (2 colors)
- goalkeeper: shirtAndSocks (5 colors), shorts (1 color)

### Hair & Skin Structure
- first kit: hair (1 color), skin (5 colors, darkest to lightest)
- second kit: hair (1 color), skin (5 colors)
- goalkeeper: hair (1 color), skin (3 colors)

### Flag Colors
- Exactly 4 colors for the flag palette

### Flag Design
- A pixel grid representing the team's flag/emblem (shown on the selection screen)
- Grid size: 16 rows × 24 columns
- Each pixel is a number 0-4:
  - 0 = transparent (background)
  - 1 = flag color 1
  - 2 = flag color 2
  - 3 = flag color 3
  - 4 = flag color 4
- IMPORTANT: The flag should visually represent the team's IDENTITY and THEME, not just boring stripes!
- For national teams: use the real flag pattern (e.g., Brazil's diamond, Japan's circle, UK's cross)
- For fictional/themed teams: create a symbolic design that represents the theme
  - Superhero theme → shield shape, star, lightning bolt, diamond symbol
  - Cyberpunk → angular geometric patterns, asymmetric shapes
  - Historical → crosses, coats-of-arms inspired shapes
  - Animal-themed → silhouette or abstract representation
- Think of it as a team LOGO/EMBLEM, not just colored bands
- Use contrast: put shapes (color 2, 3, 4) on a solid background (color 1)
- The more recognizable and iconic the shape, the better
- Examples of good designs:
  - Diamond/rhombus centered on solid background (like Brazil)
  - Circle centered on solid background (like Japan)
  - A bold "V" or chevron shape
  - A star or lightning bolt silhouette
  - Cross or X pattern
  - Shield shape with internal detail

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation, no code fences) in this exact format:

{
  "_format": "iss-forge-team",
  "_version": 1,
  "name": "TeamName",
  "id": "TEAMID",
  "teamNameText": "TEAMNAME",
  "teamNameInGame": "TEA",
  "players": [
    {
      "name": "PLAYER1",
      "number": 1,
      "shooting": 7,
      "shootingIndex": 3,
      "speed": 8,
      "stamina": 12,
      "technique": 9,
      "techniqueIndex": 4,
      "hairStyle": 0,
      "isSpecial": false
    }
  ],
  "uniforms": {
    "home": {
      "shirt": [{"r": 0, "g": 0, "b": 128}, {"r": 0, "g": 0, "b": 176}, {"r": 0, "g": 0, "b": 224}],
      "shorts": [{"r": 248, "g": 248, "b": 248}, {"r": 200, "g": 200, "b": 200}, {"r": 160, "g": 160, "b": 160}],
      "socks": [{"r": 0, "g": 0, "b": 128}, {"r": 0, "g": 0, "b": 224}]
    },
    "away": {
      "shirt": [{"r": 248, "g": 248, "b": 248}, {"r": 200, "g": 200, "b": 200}, {"r": 160, "g": 160, "b": 160}],
      "shorts": [{"r": 0, "g": 0, "b": 128}, {"r": 0, "g": 0, "b": 176}, {"r": 0, "g": 0, "b": 224}],
      "socks": [{"r": 248, "g": 248, "b": 248}, {"r": 160, "g": 160, "b": 160}]
    },
    "goalkeeper": {
      "shirtAndSocks": [{"r": 0, "g": 128, "b": 0}, {"r": 0, "g": 176, "b": 0}, {"r": 0, "g": 224, "b": 0}, {"r": 0, "g": 128, "b": 0}, {"r": 0, "g": 224, "b": 0}],
      "shorts": [{"r": 16, "g": 16, "b": 16}]
    }
  },
  "hairSkin": {
    "first": {
      "hair": [{"r": 40, "g": 24, "b": 8}],
      "skin": [{"r": 80, "g": 56, "b": 32}, {"r": 128, "g": 96, "b": 56}, {"r": 168, "g": 128, "b": 80}, {"r": 200, "g": 168, "b": 120}, {"r": 232, "g": 200, "b": 160}]
    },
    "second": {
      "hair": [{"r": 40, "g": 24, "b": 8}],
      "skin": [{"r": 80, "g": 56, "b": 32}, {"r": 128, "g": 96, "b": 56}, {"r": 168, "g": 128, "b": 80}, {"r": 200, "g": 168, "b": 120}, {"r": 232, "g": 200, "b": 160}]
    },
    "goalkeeper": {
      "hair": [{"r": 40, "g": 24, "b": 8}],
      "skin": [{"r": 128, "g": 96, "b": 56}, {"r": 168, "g": 128, "b": 80}, {"r": 232, "g": 200, "b": 160}]
    }
  },
  "flagColors": [
    {"r": 0, "g": 0, "b": 128},
    {"r": 248, "g": 248, "b": 248},
    {"r": 0, "g": 0, "b": 224},
    {"r": 248, "g": 200, "b": 0}
  ],
  "flagDesign": {
    "grid": [
      [1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,2,2,3,3,2,2,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,2,2,3,3,3,3,2,2,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,2,2,3,3,4,4,3,3,2,2,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,2,2,3,3,4,4,4,4,3,3,2,2,1,1,1,1,1,1],
      [1,1,1,1,1,2,2,3,3,4,4,4,4,4,4,3,3,2,2,1,1,1,1,1],
      [1,1,1,1,2,2,3,3,4,4,4,4,4,4,4,4,3,3,2,2,1,1,1,1],
      [1,1,1,1,2,2,3,3,4,4,4,4,4,4,4,4,3,3,2,2,1,1,1,1],
      [1,1,1,1,1,2,2,3,3,4,4,4,4,4,4,3,3,2,2,1,1,1,1,1],
      [1,1,1,1,1,1,2,2,3,3,4,4,4,4,3,3,2,2,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,2,2,3,3,4,4,3,3,2,2,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,2,2,3,3,3,3,2,2,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,2,2,3,3,2,2,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1]
    ]
  }
}

Remember: Return ONLY the JSON. No explanations, no markdown.`;
}

/**
 * Round a color value to nearest valid SNES value (multiple of 8, clamped 0-248)
 */
function snapColor(value) {
  const clamped = Math.max(0, Math.min(248, value));
  return Math.round(clamped / 8) * 8;
}

/**
 * Sanitize a color object to valid SNES values
 */
function sanitizeColor(color) {
  if (!color || typeof color !== 'object') return { r: 0, g: 0, b: 0 };
  return {
    r: snapColor(color.r || 0),
    g: snapColor(color.g || 0),
    b: snapColor(color.b || 0),
  };
}

/**
 * Clamp a shooting/technique value to valid options
 */
function clampToShootingValue(val) {
  const valid = CONSTRAINTS.shootingValues;
  let closest = valid[0];
  let minDiff = Math.abs(val - closest);
  for (const v of valid) {
    const diff = Math.abs(val - v);
    if (diff < minDiff) {
      closest = v;
      minDiff = diff;
    }
  }
  return closest;
}

/**
 * Get the index for a shooting/technique value
 */
function getShootingIndex(val) {
  const idx = CONSTRAINTS.shootingValues.indexOf(val);
  return idx >= 0 ? idx : 3;
}

/**
 * Sanitize and validate a team JSON generated by the LLM
 * Fixes common issues (out-of-range values, missing fields) without rejecting
 */
export function sanitizeGeneratedTeam(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const team = {
    _format: 'iss-forge-team',
    _version: 1,
    name: String(data.name || 'AI Team').substring(0, 20),
    id: String(data.id || 'AITEAM')
      .substring(0, 10)
      .toUpperCase(),
    teamNameText: String(data.teamNameText || data.name || 'AITEAM')
      .substring(0, CONSTRAINTS.teamNameTextMaxLength)
      .toUpperCase(),
    teamNameInGame: String(data.teamNameInGame || (data.name || 'AIT').substring(0, 3))
      .substring(0, CONSTRAINTS.teamNameInGameMaxLength)
      .toUpperCase(),
    players: [],
    uniforms: null,
    hairSkin: null,
    flagColors: [],
  };

  // Sanitize players
  const rawPlayers = Array.isArray(data.players) ? data.players : [];
  const usedNumbers = new Set();

  for (let i = 0; i < CONSTRAINTS.playersPerTeam; i++) {
    const p = rawPlayers[i] || {};
    const shooting = clampToShootingValue(p.shooting || 7);
    const technique = clampToShootingValue(p.technique || 7);

    let number = Math.max(1, Math.min(16, Math.round(p.number || i + 1)));
    while (usedNumbers.has(number)) {
      number = number < 16 ? number + 1 : 1;
    }
    usedNumbers.add(number);

    team.players.push({
      name: String(p.name || `PLAY${i + 1}`)
        .substring(0, CONSTRAINTS.playerNameMaxLength)
        .replace(/[^A-Za-z0-9.'"/\s]/g, ''),
      number,
      shooting,
      shootingIndex:
        p.shootingIndex != null
          ? Math.max(0, Math.min(7, p.shootingIndex))
          : getShootingIndex(shooting),
      speed: Math.max(1, Math.min(16, Math.round(p.speed || 8))),
      stamina: Math.max(1, Math.min(16, Math.round(p.stamina || 8))),
      technique,
      techniqueIndex:
        p.techniqueIndex != null
          ? Math.max(0, Math.min(7, p.techniqueIndex))
          : getShootingIndex(technique),
      hairStyle: Math.max(0, Math.min(10, Math.round(p.hairStyle || 0))),
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

  // Sanitize hair/skin
  const hs = data.hairSkin || {};
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
  const fc = Array.isArray(data.flagColors) ? data.flagColors : [];
  for (let i = 0; i < CONSTRAINTS.flagColorCount; i++) {
    team.flagColors.push(sanitizeColor(fc[i]));
  }

  // Sanitize flag design
  if (data.flagDesign && data.flagDesign.grid && Array.isArray(data.flagDesign.grid)) {
    const grid = [];
    for (let row = 0; row < 16; row++) {
      const srcRow = data.flagDesign.grid[row];
      const newRow = [];
      for (let col = 0; col < 24; col++) {
        const val =
          srcRow && srcRow[col] != null ? Math.max(0, Math.min(4, Math.round(srcRow[col]))) : 0;
        newRow.push(val);
      }
      grid.push(newRow);
    }
    team.flagDesign = { grid };
  } else {
    team.flagDesign = null;
  }

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
 * Parse LLM response text into a team object
 * Handles cases where the LLM wraps JSON in code fences or adds explanations
 */
export function parseLLMResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return { success: false, error: 'Empty response from AI' };
  }

  let text = responseText.trim();

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
    const data = JSON.parse(text);
    const sanitized = sanitizeGeneratedTeam(data);
    if (!sanitized) {
      return { success: false, error: 'Could not parse team data from AI response' };
    }
    return { success: true, team: sanitized };
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e.message}` };
  }
}

/**
 * Default AI settings
 */
export const DEFAULT_AI_SETTINGS = {
  endpoint: 'http://localhost:1234/v1/chat/completions',
  model: '',
  temperature: 0.7,
  maxTokens: 4096,
};
