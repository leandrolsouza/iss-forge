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
  return `You are a team data generator for International Superstar Soccer (SNES, 1995). Output a single JSON object that will be imported directly into the game ROM. Follow ALL constraints below.

# CONSTRAINTS

## Players (exactly ${CONSTRAINTS.playersPerTeam})
- Player 1 = goalkeeper. Players 2-11 = starters. Players 12-15 = substitutes.
- Name: max ${CONSTRAINTS.playerNameMaxLength} chars. Allowed: ${CONSTRAINTS.playerNameAllowedChars}
- Shirt number: ${CONSTRAINTS.shirtNumberRange.min}-${CONSTRAINTS.shirtNumberRange.max}, unique per player

## Attributes
| Attribute | Range | Notes |
|-----------|-------|-------|
| shooting | ${CONSTRAINTS.shootingValues.join(', ')} | Pick from this set only |
| shootingIndex | 0-7 | Index into shooting values (0→1, 1→3, 2→5, 3→7, 4→9, 5→11, 6→13, 7→15) |
| speed | 1-16 | Integer. Higher = faster |
| stamina | 1-16 | Integer. Higher = more endurance |
| technique | ${CONSTRAINTS.techniqueValues.join(', ')} | Same set as shooting |
| techniqueIndex | 0-7 | Same mapping as shootingIndex |

IMPORTANT: shootingIndex and techniqueIndex MUST match the shooting/technique values.
Example: shooting=13 → shootingIndex=6. technique=9 → techniqueIndex=4.

## Stat Distribution Guidelines
- Goalkeepers: high stamina (12-16), low speed (6-10)
- Defenders: high stamina (12-16), moderate speed
- Midfielders: balanced stats, high technique for playmakers
- Forwards: high speed and shooting, lower stamina
- Star players: 1-3 per team with stats 13-15+
- Average players: stats around 7-9
- Make stat variation REALISTIC: not everyone should have the same values

## Hair Styles
${CONSTRAINTS.hairStyles.map((h) => `${h}`).join(' | ')}

## isSpecial
- false = uses team default hair/skin palette (most players)
- true = uses individual palette (use for 0-2 unique-looking players max)

## Colors (SNES 5-bit RGB)
All R, G, B values must be multiples of 8, range 0-248.

## Team Names
- name: descriptive display name (max 20 chars)
- teamNameText: max ${CONSTRAINTS.teamNameTextMaxLength} chars UPPERCASE (shown in menus)
- teamNameInGame: exactly ${CONSTRAINTS.teamNameInGameMaxLength} chars UPPERCASE (scoreboard)

## Uniforms
Home kit:
- shirt: 3 colors (dark → medium → light, for shading effect)
- shorts: 3 colors (dark → medium → light)
- socks: 2 colors (dark → light)

Away kit: same structure, contrasting colors to home

Goalkeeper kit:
- shirtAndSocks: 5 colors (shading gradient)
- shorts: 1 color

IMPORTANT: Home and away kits must be VISUALLY DISTINCT. Goalkeeper must differ from both.

## Hair & Skin
- first (home kit): hair 1 color, skin 5 colors (darkest → lightest)
- second (away kit): hair 1 color, skin 5 colors
- goalkeeper: hair 1 color, skin 3 colors
- Skin gradient should look natural (e.g., shadow → base → highlight)

## Flag Colors
Exactly 4 palette colors used by the flag design grid.

## Flag Design
- 16 rows × 24 columns pixel grid
- Each cell: 0 (transparent), 1-4 (palette color index)
- Create a RECOGNIZABLE shape/symbol, not just horizontal stripes
- National teams: represent the real flag (diamond, circle, cross, crescent, etc.)
- Fictional teams: create an iconic symbol (star, shield, bolt, chevron, skull, etc.)
- Use color 1 as background, colors 2-4 for the main design elements
- The more iconic and simple the silhouette, the better it reads at 16×24 resolution

# OUTPUT

Return ONLY a valid JSON object. No markdown fences, no explanation, no comments.

{
  "_format": "iss-forge-team",
  "_version": 1,
  "name": "Team Display Name",
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
      "stamina": 14,
      "technique": 9,
      "techniqueIndex": 4,
      "hairStyle": 0,
      "isSpecial": false
    }
  ],
  "uniforms": {
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
    "first": {
      "hair": [{"r":40,"g":24,"b":8}],
      "skin": [{"r":80,"g":56,"b":32}, {"r":128,"g":96,"b":56}, {"r":168,"g":128,"b":80}, {"r":200,"g":168,"b":120}, {"r":232,"g":200,"b":160}]
    },
    "second": {
      "hair": [{"r":40,"g":24,"b":8}],
      "skin": [{"r":80,"g":56,"b":32}, {"r":128,"g":96,"b":56}, {"r":168,"g":128,"b":80}, {"r":200,"g":168,"b":120}, {"r":232,"g":200,"b":160}]
    },
    "goalkeeper": {
      "hair": [{"r":40,"g":24,"b":8}],
      "skin": [{"r":128,"g":96,"b":56}, {"r":168,"g":128,"b":80}, {"r":232,"g":200,"b":160}]
    }
  },
  "flagColors": [
    {"r":0,"g":0,"b":128}, {"r":248,"g":248,"b":248}, {"r":0,"g":0,"b":224}, {"r":248,"g":200,"b":0}
  ],
  "flagDesign": {
    "grid": [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,2,2,3,3,2,2,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,2,2,3,3,3,3,2,2,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,2,2,3,3,4,4,3,3,2,2,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,2,2,3,3,4,4,4,4,3,3,2,2,1,1,1,1,1,1],
      [1,1,1,1,1,2,2,3,3,4,4,4,4,4,4,3,3,2,2,1,1,1,1,1],
      [1,1,1,1,1,2,2,3,3,4,4,4,4,4,4,3,3,2,2,1,1,1,1,1],
      [1,1,1,1,1,1,2,2,3,3,4,4,4,4,3,3,2,2,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,2,2,3,3,4,4,3,3,2,2,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,2,2,3,3,3,3,2,2,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,2,2,3,3,2,2,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ]
  }
}

Include ALL 15 players and ALL uniform/hairSkin/flag data. Output valid JSON only.`;
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

/**
 * Stream LLM response in web/dev mode (no Electron).
 * Calls onChunk(text) for each token received, onDone() when complete, onError(msg) on failure.
 * Returns an abort function to cancel the stream.
 */
export function streamLLMWeb({ systemPrompt, userPrompt, settings, onChunk, onDone, onError }) {
  // Import provider helpers inline to avoid circular deps
  const controller = new AbortController();

  // Determine provider format
  const providerId = settings.provider || 'openai-compatible';
  let format = 'openai';
  let endpoint = settings.endpoint;
  const headers = { 'Content-Type': 'application/json' };

  // Provider-specific configuration
  if (providerId === 'claude') {
    format = 'anthropic';
    endpoint = endpoint || 'https://api.anthropic.com/v1/messages';
    if (settings.apiKey) {
      headers['x-api-key'] = settings.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }
  } else {
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }
  }

  let body;
  if (format === 'anthropic') {
    body = {
      model: settings.model || 'claude-sonnet-4-6',
      max_tokens: settings.maxTokens || 4096,
      temperature: settings.temperature || 0.7,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };
  } else {
    body = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: settings.temperature || 0.7,
      max_tokens: settings.maxTokens || 4096,
      stream: true,
      ...(settings.model ? { model: settings.model } : {}),
    };
  }

  fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        onError(`API error ${response.status}: ${errorText || response.statusText}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Skip SSE event lines (used by Anthropic)
          if (trimmed.startsWith('event:')) continue;

          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();

          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);

            if (format === 'anthropic') {
              if (parsed.type === 'content_block_delta') {
                const text = parsed.delta?.text;
                if (text) onChunk(text);
              } else if (parsed.type === 'message_stop') {
                onDone();
                return;
              }
            } else {
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            }
          } catch (_e) {
            // Ignore malformed SSE lines
          }
        }
      }

      onDone();
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      onError(err.message || 'Connection failed');
    });

  return () => controller.abort();
}
