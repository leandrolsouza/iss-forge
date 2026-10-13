import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../../rom/RomParser';
import { TEAMS } from '../../rom/constants';
import { sharedKeeperTeams } from '../../rom/readers/UniformReader';
import en from '../../i18n/en';
import ptBR from '../../i18n/pt-BR';
import { getPresetSlots } from '../../rom/formation';
import { encodeTeamDescription, TEAM_DESC_CAPACITY } from '../../rom/teamDescription';
import { applyImportedTeam } from '../../utils/teamExport';
import * as webAi from '../aiProviders';
import * as electronAi from '../../../electron/aiProviders.mjs';
import {
  AI_FLAG_TEMPLATES,
  AI_HAIR_SKIN_TEMPLATES,
  TEAM_OUTPUT_SCHEMA,
  buildOutputSchema,
  buildPartSchema,
  pickPart,
  validateGeneratedTeam,
  buildRepairPrompt,
  cleanPlayerName,
  fitDescription,
  predominantColorOf,
  readColor,
} from '../aiTeamSchema';
import {
  extractJson,
  sanitizeGeneratedTeam,
  parseLLMResponse,
  generateTeam,
  buildSystemPrompt,
  buildAiContext,
  buildLookRequest,
  buildOptimizerPrompt,
  cleanOptimizedPrompt,
  optimizePrompt,
} from '../aiService';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);

const c = (r, g, b) => ({ r, g, b });
const shades = (n, base) =>
  Array.from({ length: n }, (_, i) => c(base, base, Math.min(248, i * 40)));

/** A complete answer that follows every rule */
function validTeam() {
  return {
    name: 'Test United',
    teamNameText: 'TESTUTD',
    teamNameInGame: 'TEST',
    formation: '433',
    players: Array.from({ length: 15 }, (_, i) => ({
      name: `PLAYER${i + 1}`.slice(0, 8),
      number: i + 1,
      acceleration: 10,
      topSpeed: 11,
      dribbleSpeed: 9,
      stamina: 12,
      shooting: 9,
      technique: 7,
      attack: 8,
      defense: 8,
      gkKick: 7,
      hairStyle: i % 11,
      isSpecial: false,
    })),
    description: { style: 'offensive', title: 'Offensive 4-3-3', body: 'Fast wingers.' },
    specialHair: 'blond',
    specialSkin: 'regular',
    uniforms: {
      home: { shirt: shades(3, 0), shorts: shades(3, 248), socks: shades(2, 0) },
      away: { shirt: shades(3, 248), shorts: shades(3, 0), socks: shades(2, 248) },
      goalkeeper: {
        shirtAndSocks: [c(0, 200, 0), c(0, 200, 0), c(0, 200, 0), c(0, 200, 0), c(0, 200, 0)],
        shorts: [c(16, 16, 16)],
      },
    },
    hairSkin: {
      first: { hair: [c(40, 24, 8)], skin: shades(5, 160) },
      second: { hair: [c(40, 24, 8)], skin: shades(5, 160) },
      goalkeeper: { hair: [c(40, 24, 8)], skin: shades(3, 160) },
    },
    flagColors: [c(0, 0, 128), c(248, 248, 248), c(248, 0, 0), c(248, 200, 0)],
    flagDesign: {
      grid: Array.from({ length: 16 }, (_, r) =>
        Array.from({ length: 24 }, (_, col) => (col > 8 && col < 16 && r > 4 && r < 12 ? 2 : 1)),
      ),
    },
  };
}

/** A fetch-like body that delivers the given text pieces */
function bodyOf(pieces) {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      pieces.forEach((p) => controller.enqueue(typeof p === 'string' ? enc.encode(p) : p));
      controller.close();
    },
  });
}

describe('AI team schema', () => {
  it('is strict-mode friendly: every object lists all keys as required, no extra keys', () => {
    const walk = (node) => {
      if (node.type === 'object') {
        expect(node.additionalProperties).toBe(false);
        expect([...node.required].sort()).toEqual(Object.keys(node.properties).sort());
        Object.values(node.properties).forEach(walk);
      }
      if (node.type === 'array') walk(node.items);
    };
    walk(TEAM_OUTPUT_SCHEMA.schema);
    expect(TEAM_OUTPUT_SCHEMA.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it('lists the same top-level fields as the prompt example', () => {
    const prompt = buildSystemPrompt();
    for (const key of Object.keys(TEAM_OUTPUT_SCHEMA.schema.properties)) {
      expect(prompt).toContain(`"${key}"`);
    }
    expect(prompt).not.toContain('shootingIndex');
  });
});

describe('validateGeneratedTeam', () => {
  it('accepts a complete team', () => {
    expect(validateGeneratedTeam(validTeam())).toEqual({ errors: [], warnings: [] });
  });

  it('finds what would be lost or cut', () => {
    const team = validTeam();
    team.players.pop();
    team.players[2].name = 'BATISTUTA';
    team.players[3].number = 1;
    delete team.players[4].attack;
    delete team.uniforms.away;
    team.flagDesign.grid.pop();
    team.teamNameText = 'SUPERLONGNAME';
    const { errors } = validateGeneratedTeam(team);
    const text = errors.join('\n');
    expect(text).toContain('14 entries');
    expect(text).toContain('"BATISTUTA" has 9 characters');
    expect(text).toContain('number 1 is already used by players[0]');
    expect(text).toContain('players[4].attack is missing');
    expect(text).toContain('uniforms.away.shirt is missing');
    expect(text).toContain('16 rows of 24');
    expect(text).toContain('teamNameText');
    expect(validateGeneratedTeam([]).errors).toHaveLength(1);
  });

  it('only warns about what the sanitizer fixes without losing meaning', () => {
    const team = validTeam();
    team.players[0].shooting = 14;
    team.players[1].topSpeed = 20;
    team.players[2].name = 'José';
    team.uniforms.home.shirt[0] = '#102030';
    team.uniforms.away.shirt = team.uniforms.home.shirt;
    const { errors, warnings } = validateGeneratedTeam(team);
    expect(errors).toEqual([]);
    expect(warnings.join('\n')).toMatch(/shooting 14 changed to (13|15)/);
    expect(warnings.join('\n')).toContain('topSpeed 20');
    expect(warnings.join('\n')).toContain('almost the same color');
  });

  it('checks formation, description and special presets', () => {
    const team = validTeam();
    team.formation = '4-3-3';
    team.description.title = 'A very long title here';
    team.description.body = 'word '.repeat(30);
    team.specialHair = 'purple';
    const { errors, warnings } = validateGeneratedTeam(team);
    const text = errors.join('\n');
    expect(text).toContain('formation must be one of');
    expect(text).toContain('description.title "A very long title here" has 22 characters');
    expect(text).toMatch(/description\.body takes \d+ lines/);
    expect(warnings.join('\n')).toContain('specialHair must be one of');

    delete team.description;
    expect(validateGeneratedTeam(team).errors.join()).toContain('description is missing');
  });

  it('warns about players out of place in the formation', () => {
    const team = validTeam();
    // "433": players[2] is a centre back, players[10] the striker
    team.players[2] = { ...team.players[2], attack: 15, defense: 3 };
    team.players[10] = { ...team.players[10], attack: 2, defense: 14 };
    const { warnings } = validateGeneratedTeam(team);
    expect(warnings.join('\n')).toContain('has forward stats but plays CB');
    expect(warnings.join('\n')).toContain('has defender stats but plays ST');
  });

  it('uses the limits of the target slot', () => {
    const team = validTeam();
    team.teamNameText = 'TESTUTD';
    const context = {
      menuNameMax: 10,
      fitMenuName: (text) => text.slice(0, 5),
      descriptionBudget: 20,
    };
    const text = validateGeneratedTeam(team, context).errors.join('\n');
    expect(text).toContain('only "TESTU" fits');
    expect(text).toMatch(/only 20 are free in the ROM/);
    expect(validateGeneratedTeam(team, { menuNameMax: 5 }).errors.join()).toContain('(max 5)');
  });

  it('builds a repair prompt with the problems and the previous answer', () => {
    const prompt = buildRepairPrompt('Brazil 1994', '{"a":1}', ['x is missing']);
    expect(prompt).toContain('Brazil 1994');
    expect(prompt).toContain('- x is missing');
    expect(prompt).toContain('{"a":1}');
    expect(buildRepairPrompt('p', null, ['bad'])).toContain('valid JSON object');
  });
});

describe('sanitizeGeneratedTeam', () => {
  it('keeps accented names readable and the shown stats equal to the written ones', () => {
    const raw = validTeam();
    raw.players[0].name = 'Müller José';
    raw.players[1] = {
      ...raw.players[1],
      shooting: 13,
      shootingIndex: 2,
      technique: undefined,
      techniqueIndex: 5,
    };
    raw.flagDesign.grid[0][0] = 'x';
    raw.uniforms.home.shirt[0] = '#FF0000';
    const team = sanitizeGeneratedTeam(raw);
    expect(cleanPlayerName('Müller José')).toBe('Muller Jose');
    expect(team.players[0].name).toBe('Muller J');
    expect(team.players[1]).toMatchObject({
      shooting: 13,
      shootingIndex: 6,
      technique: 11,
      techniqueIndex: 5,
    });
    expect(team.flagDesign.grid[0][0]).toBe(0);
    expect(team.uniforms.home.shirt[0]).toEqual({ r: 248, g: 0, b: 0 });
    expect(readColor([1, 2, 3])).toEqual({ r: 1, g: 2, b: 3 });
  });

  it('turns formation, description and presets into what the ROM takes', () => {
    const raw = validTeam();
    raw.formation = '532';
    raw.description = { style: 'defensive', title: 'Défensive 4-4-2', body: 'Solid “wall”.' };
    raw.uniforms.home.shirt = [c(200, 0, 0), c(224, 0, 0), c(248, 0, 0)];
    raw.players[0].gkKick = 13;
    const team = sanitizeGeneratedTeam(raw);
    expect(team.formation.slots).toEqual(getPresetSlots('532'));
    expect(team.formationName).toBe('5-3-2');
    expect(team.players.map((p) => p.position).slice(0, 4)).toEqual(['GK', 'LB', 'CB', 'SW']);
    expect(team.players[12].position).toBe('SUB');
    // accents and typographic quotes become font characters; the title follows the formation
    expect(team.description).toEqual({
      title: 'Defensive 5-3-2',
      titleColor: 0x24,
      body: 'Solid "wall".',
    });
    expect(team.specialHair).toBe(1); // blond
    expect(team.specialSkin).toBe(0);
    expect(team.predominantColor).toBe(2); // red
    expect(team.players[0]).toMatchObject({ gkKick: 13, gkKickIndex: 6 });

    // only "speed": all three speeds; no description: a title, so the old text goes
    delete raw.description;
    raw.players[3] = { ...raw.players[3], acceleration: undefined, speed: 14 };
    const fallback = sanitizeGeneratedTeam(raw);
    expect(fallback.description).toEqual({ title: 'Offensive 5-3-2', titleColor: 0x2c, body: '' });
    expect(fallback.players[3]).toMatchObject({ acceleration: 14 });
  });

  it('fits the description and the menu name to the slot', () => {
    const raw = validTeam();
    raw.description.body = 'One two three four five six seven eight nine ten';
    const full = encodeTeamDescription(fitDescription(raw.description)).length;
    const team = sanitizeGeneratedTeam(raw, {
      fitMenuName: (text) => text.slice(0, 4),
      descriptionBudget: full - 10,
    });
    expect(team.teamNameText).toBe('TEST');
    expect(encodeTeamDescription(team.description).length).toBeLessThanOrEqual(full - 10);
    expect(team.description.body.startsWith('One two three')).toBe(true);
    expect(sanitizeGeneratedTeam(raw, { descriptionBudget: 3 }).description).toBeNull();
  });

  it('derives the predominant colour from the shirt', () => {
    expect(predominantColorOf(c(248, 248, 248))).toBe(0);
    expect(predominantColorOf(c(16, 16, 16))).toBe(0);
    expect(predominantColorOf(c(0, 0, 160))).toBe(1);
    expect(predominantColorOf(c(248, 120, 0))).toBe(2);
    expect(predominantColorOf(c(248, 224, 0))).toBe(3);
    expect(predominantColorOf(c(0, 160, 64))).toBe(4);
  });
});

describe('extractJson', () => {
  it('skips <think> blocks, fences and the usual slips', () => {
    expect(extractJson('<think>maybe {"no": 1}</think>\n{"a": 1}').data).toEqual({ a: 1 });
    expect(extractJson('Here:\n```json\n{"a": [1, 2,],}\n```').data).toEqual({ a: [1, 2] });
    expect(extractJson('<think>only thinking</think>').error.code).toBe('empty');
    expect(extractJson('{"a": ').error.code).toBe('parse');
  });

  it('parseLLMResponse reports the problems with the team', () => {
    const bad = validTeam();
    bad.players.length = 10;
    const parsed = parseLLMResponse(JSON.stringify(bad));
    expect(parsed.success).toBe(true);
    expect(parsed.team.players).toHaveLength(15);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});

describe('provider requests (renderer and Electron copies)', () => {
  const schema = { name: 'iss_team', description: 'd', schema: { type: 'object' } };
  const base = { systemPrompt: 's', userPrompt: 'u', model: 'm', maxTokens: 100, stream: true };

  for (const [label, ai] of [
    ['renderer', webAi],
    ['electron', electronAi],
  ]) {
    it(`${label}: ask for structured output and keep temperature 0`, () => {
      const openai = ai.buildRequestBody({ ...base, format: 'openai', temperature: 0, schema });
      expect(openai.temperature).toBe(0);
      expect(openai.response_format).toEqual({
        type: 'json_schema',
        json_schema: { name: 'iss_team', strict: true, schema: schema.schema },
      });
      const claude = ai.buildRequestBody({ ...base, format: 'anthropic', temperature: 0, schema });
      expect(claude.temperature).toBe(0);
      expect(claude.tool_choice).toEqual({ type: 'tool', name: 'iss_team' });
      expect(claude.tools[0].input_schema).toBe(schema.schema);
      const bedrock = ai.buildRequestBody({ ...base, format: 'bedrock', temperature: 0, schema });
      expect(bedrock.inferenceConfig.temperature).toBe(0);
      expect(bedrock.toolConfig.toolChoice).toEqual({ tool: { name: 'iss_team' } });
      expect(ai.buildRequestBody({ ...base, format: 'openai' }).response_format).toBeUndefined();
      expect(ai.buildRequestBody({ ...base, format: 'anthropic' }).tools).toBeUndefined();
    });

    it(`${label}: keep the content of the last chunk and read stop reasons`, () => {
      const last = ai.parseStreamChunk(
        JSON.stringify({ choices: [{ delta: { content: '}' }, finish_reason: 'stop' }] }),
        'openai',
      );
      expect(last).toMatchObject({ content: '}', done: true, stopReason: 'stop' });
      expect(
        ai.parseStreamChunk(
          JSON.stringify({
            type: 'content_block_delta',
            delta: { type: 'input_json_delta', partial_json: '{"a"' },
          }),
          'anthropic',
        ).content,
      ).toBe('{"a"');
      expect(
        ai.parseStreamChunk(
          JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } }),
          'anthropic',
        ).stopReason,
      ).toBe('max_tokens');
      expect(
        ai.parseStreamChunk(
          JSON.stringify({ contentBlockDelta: { delta: { toolUse: { input: '{"b"' } } } }),
          'bedrock',
        ).content,
      ).toBe('{"b"');
      expect(ai.isTruncatedStop('length')).toBe(true);
      expect(ai.isTruncatedStop('max_tokens')).toBe(true);
      expect(ai.isTruncatedStop('stop')).toBe(false);
    });

    it(`${label}: read an SSE body to the end`, async () => {
      const chunks = [];
      const chunk = (content, finish = null) =>
        `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: finish }] })}\n\n`;
      const result = await ai.readSseStream(
        bodyOf([
          chunk('{"a":'),
          chunk('1', null).slice(0, 10),
          chunk('1').slice(10),
          chunk('}', 'length'),
        ]),
        'openai',
        (t) => chunks.push(t),
      );
      expect(chunks.join('')).toBe('{"a":1}');
      expect(result).toEqual({ stopReason: 'length', error: null });
    });

    it(`${label}: read tool-use answers without streaming`, () => {
      expect(
        ai.parseResponse(
          { content: [{ type: 'tool_use', input: { a: 1 } }], stop_reason: 'tool_use' },
          'anthropic',
        ).content,
      ).toBe('{"a":1}');
      expect(
        ai.parseResponse(
          { output: { message: { content: [{ toolUse: { input: { b: 2 } } }] } } },
          'bedrock',
        ).content,
      ).toBe('{"b":2}');
    });
  }

  it('electron: read the Bedrock binary event stream, tool input included', async () => {
    // [4B total length][4B header length = 0][4B prelude crc][payload][4B crc]
    const frame = (payload) => {
      const body = new TextEncoder().encode(JSON.stringify(payload));
      const buf = new Uint8Array(12 + body.length + 4);
      new DataView(buf.buffer).setUint32(0, buf.length);
      buf.set(body, 12);
      return buf;
    };
    const texts = [];
    const result = await electronAi.readBedrockEventStream(
      bodyOf([
        frame({ role: 'assistant' }),
        frame({ delta: { toolUse: { input: '{"a":' } } }),
        frame({ delta: { text: '1}' } }),
        frame({ stopReason: 'max_tokens' }),
      ]),
      (t) => texts.push(t),
    );
    expect(texts.join('')).toBe('{"a":1}');
    expect(result.stopReason).toBe('max_tokens');
    const failed = await electronAi.readBedrockEventStream(
      bodyOf([frame({ message: 'Throttled' })]),
      () => {},
    );
    expect(failed.error.code).toBe('api');
  });
});

describe('generateTeam', () => {
  const settings = {
    provider: 'openai-compatible',
    endpoint: 'http://x',
    model: 'local',
    maxTokens: 8192,
  };
  /** A fake model: answers from the list, or the valid team */
  const fakeStream = (answers = []) =>
    vi.fn(async ({ onChunk }) => {
      const next = answers.length ? answers.shift() : validTeam();
      const text = typeof next === 'string' ? next : JSON.stringify(next);
      onChunk?.(text);
      return { text, truncated: false };
    });

  it('makes the squad, then the visual identity, each with its own schema', async () => {
    const stream = fakeStream();
    const stages = [];
    const result = await generateTeam({
      userPrompt: 'a test team',
      settings,
      stream,
      onStage: (s) => stages.push(s.part),
    });
    expect(stages).toEqual(['squad', 'look']);
    expect(stream).toHaveBeenCalledTimes(2);
    const [squadCall, lookCall] = stream.mock.calls.map((c) => c[0]);
    expect(squadCall.schema.name).toBe('iss_team_squad');
    expect(Object.keys(squadCall.schema.schema.properties)).toContain('players');
    expect(Object.keys(squadCall.schema.schema.properties)).not.toContain('uniforms');
    expect(lookCall.schema.name).toBe('iss_team_look');
    expect(squadCall.systemPrompt).not.toContain('## Flag');
    expect(lookCall.systemPrompt).not.toContain('## Players');
    // the visual step knows the squad
    expect(lookCall.userPrompt).toContain('a test team');
    expect(lookCall.userPrompt).toContain('"Test United"');
    expect(lookCall.userPrompt).toContain('PLAYER1, PLAYER2');
    expect(Object.keys(result.raw.squad)).not.toContain('uniforms');
    expect(Object.keys(result.raw.look)).toEqual([
      'uniforms',
      'hairSkin',
      'flagColors',
      'flagDesign',
    ]);
    expect(result.team.players).toHaveLength(15);
    expect(result.team.uniforms.home.shirt).toEqual(validTeam().uniforms.home.shirt);
    expect(result.attempts).toBe(2);
  });

  it('asks again with the problems of the step until it is right', async () => {
    const short = validTeam();
    short.players.length = 14;
    const stream = fakeStream([short]);
    const attempts = [];
    const result = await generateTeam({
      userPrompt: 'a test team',
      settings,
      stream,
      onAttempt: (info) => attempts.push(info),
    });
    expect(stream).toHaveBeenCalledTimes(3);
    expect(result.errors).toEqual([]);
    expect(result.parts.squad.attempts).toBe(2);
    expect(result.parts.look.attempts).toBe(1);
    const repair = stream.mock.calls[1][0].userPrompt;
    expect(repair).toContain('a test team');
    expect(repair).toContain('14 entries');
    expect(attempts[1]).toMatchObject({ part: 'squad', attempt: 2 });
    expect(attempts[2]).toMatchObject({ part: 'look', attempt: 1 });
  });

  it('returns the best attempt with what is still wrong', async () => {
    const bad = validTeam();
    bad.players[0].name = 'MARADONAA';
    const stream = fakeStream([bad, bad]);
    const result = await generateTeam({ userPrompt: 'p', settings, stream, maxAttempts: 2 });
    expect(stream).toHaveBeenCalledTimes(3);
    expect(result.errors.join()).toContain('MARADONAA');
    expect(result.team.players[0].name).toBe('MARADONA');
  });

  it('redoes one step and keeps the other', async () => {
    const first = await generateTeam({ userPrompt: 'p', settings, stream: fakeStream() });
    const red = validTeam();
    red.uniforms.home.shirt = [c(200, 0, 0), c(224, 0, 0), c(248, 0, 0)];
    const stream = fakeStream([red]);
    const again = await generateTeam({
      userPrompt: 'p, but red',
      settings,
      stream,
      parts: ['look'],
      previous: first,
    });
    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream.mock.calls[0][0].schema.name).toBe('iss_team_look');
    expect(again.raw.squad).toBe(first.raw.squad);
    expect(again.team.uniforms.home.shirt[2]).toEqual(c(248, 0, 0));
    expect(again.team.predominantColor).toBe(2);
    expect(again.attempts).toBe(1);
  });

  it('keeps the finished steps when a later one fails', async () => {
    const stream = vi.fn(async ({ schema }) => {
      if (schema.name === 'iss_team_look') throw webAi.aiError('timeout', 'slow');
      return { text: JSON.stringify(validTeam()), truncated: false };
    });
    const err = await generateTeam({ userPrompt: 'p', settings, stream }).catch((e) => e);
    expect(err.code).toBe('timeout');
    expect(Object.keys(err.partial.raw)).toEqual(['squad']);
    // continue: only the missing step runs
    const resume = fakeStream();
    const result = await generateTeam({
      userPrompt: 'p',
      settings,
      stream: resume,
      parts: ['look'],
      previous: err.partial,
    });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(result.team.players).toHaveLength(15);
  });

  it('falls back to plain JSON when the server refuses the schema', async () => {
    const stream = vi.fn(async ({ schema }) => {
      if (schema) throw webAi.aiError('api', 'HTTP 400: response_format not supported');
      return { text: JSON.stringify(validTeam()), truncated: false };
    });
    const fallback = { ...settings, model: 'no-schema-model' };
    const result = await generateTeam({ userPrompt: 'p', settings: fallback, stream });
    expect(result).toMatchObject({ attempts: 2, structured: false });
    expect(stream).toHaveBeenCalledTimes(3);
    // remembered for the next generation
    await generateTeam({ userPrompt: 'p', settings: fallback, stream });
    expect(stream).toHaveBeenCalledTimes(5);
    expect(stream.mock.calls[3][0].schema).toBeNull();
  });

  it('stops on cut answers, unreadable answers and other errors', async () => {
    const truncated = vi.fn(async () => ({ text: '{"players": [', truncated: true }));
    await expect(
      generateTeam({ userPrompt: 'p', settings, stream: truncated }),
    ).rejects.toMatchObject({ code: 'truncated' });
    expect(truncated).toHaveBeenCalledTimes(1);

    const garbage = vi.fn(async () => ({ text: 'sorry, I cannot', truncated: false }));
    const parseError = await generateTeam({ userPrompt: 'p', settings, stream: garbage }).catch(
      (e) => e,
    );
    expect(parseError.code).toBe('parse');
    expect(parseError.partial).toBeUndefined();
    expect(garbage).toHaveBeenCalledTimes(3);
    expect(garbage.mock.calls[1][0].userPrompt).toContain('not a valid JSON object');

    const down = vi.fn(async () => {
      throw webAi.aiError('connection', 'ECONNREFUSED');
    });
    await expect(generateTeam({ userPrompt: 'p', settings, stream: down })).rejects.toMatchObject({
      code: 'connection',
    });
    expect(down).toHaveBeenCalledTimes(1);
  });
});

describe('step prompts and schemas', () => {
  it('split the fields between the two steps', () => {
    const squad = buildPartSchema(undefined, 'squad').schema;
    const look = buildPartSchema(undefined, 'look').schema;
    const all = Object.keys(TEAM_OUTPUT_SCHEMA.schema.properties);
    expect([...squad.required, ...look.required].sort()).toEqual([...all].sort());
    expect(squad.required).toEqual(Object.keys(squad.properties));
    expect(validateGeneratedTeam(pickPart(validTeam(), 'look'), undefined, 'look')).toEqual({
      errors: [],
      warnings: [],
    });
    expect(
      validateGeneratedTeam(pickPart(validTeam(), 'squad'), undefined, 'squad').errors,
    ).toEqual([]);
    for (const part of ['squad', 'look']) {
      const prompt = buildSystemPrompt(undefined, part);
      for (const key of Object.keys(buildPartSchema(undefined, part).schema.properties)) {
        expect(prompt).toContain(`"${key}"`);
      }
    }
  });

  it('tells the visual step who the special players are', () => {
    const squad = pickPart(validTeam(), 'squad');
    squad.players[3].isSpecial = true;
    const prompt = buildLookRequest('Holland 1974', squad);
    expect(prompt).toContain('Holland 1974');
    expect(prompt).toContain('Special players (own hair/skin: blond / regular): PLAYER4');
    expect(buildLookRequest('x', null)).toBe('x');
  });
});

describe('slot limits in the prompt and the schema', () => {
  it('passes the menu-name limit and the free description space on', () => {
    const context = { menuNameMax: 6, descriptionBudget: 60 };
    const schema = buildOutputSchema(context).schema;
    expect(schema.properties.teamNameText.pattern).toBe('^[A-Z0-9. ]{1,6}$');
    expect(schema.properties.formation.enum).toContain('433');
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain('teamNameText: max 6 chars');
    expect(prompt).toMatch(/body: .*at most \d+ characters/);
    expect(buildSystemPrompt({ descriptionBudget: 10 })).toContain('EMPTY body');
    expect(prompt).toContain('"433" (4-3-3): GK LB CB CB RB DM LM RM LW RW ST');
  });

  it('description pattern accepts the font characters only', () => {
    const { title, body } = TEAM_OUTPUT_SCHEMA.schema.properties.description.properties;
    expect(new RegExp(title.pattern).test('Offensive 4-3-3')).toBe(true);
    expect(new RegExp(title.pattern).test('Ofensivo à')).toBe(false);
    expect(new RegExp(body.pattern).test('Fast "wingers",\nstrong: yes!')).toBe(true);
  });
});

describe.skipIf(!hasRealRom)('AI team on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the limits of a slot', () => {
    const rom = load();
    const ctx = buildAiContext(rom, 19); // Colombia
    expect(ctx.menuNameMax).toBeGreaterThanOrEqual(6);
    expect(ctx.fitMenuName('BRAZIL')).toBe('BRAZIL');
    expect(ctx.descriptionBudget).toBeGreaterThan(20);
    expect(ctx.descriptionBudget).toBeLessThanOrEqual(TEAM_DESC_CAPACITY);
    expect(buildAiContext(null, null).fitMenuName).toBeNull();
  });

  it('writes formation, description and presets of a generated team', () => {
    const rom = load();
    const ctx = buildAiContext(rom, 19);
    const raw = validTeam();
    raw.formation = '352';
    raw.uniforms.home.shirt = [c(200, 176, 0), c(224, 200, 0), c(248, 224, 0)];
    const team = sanitizeGeneratedTeam(raw, ctx);
    const { warnings } = applyImportedTeam(rom, 19, team);
    expect(warnings).toEqual([]);
    const written = rom.readTeam(19);
    expect(written.formation.name).toBe('3-5-2');
    expect(written.description).toEqual({
      title: 'Offensive 3-5-2',
      titleColor: 0x2c,
      body: 'Fast wingers.',
    });
    expect(written.specialHair).toBe(1);
    expect(written.predominantColor).toBe(3); // yellow
    expect(written.players[0].gkKickIndex).toBe(3);
    expect(written.players[1]).toMatchObject({ acceleration: 10, topSpeed: 11, dribbleSpeed: 9 });
  });
});

describe('templates', () => {
  it('flag templates come with valid grids and text previews', () => {
    expect(AI_FLAG_TEMPLATES.length).toBeGreaterThan(20);
    for (const tpl of AI_FLAG_TEMPLATES) {
      expect(tpl.grid).toHaveLength(16);
      expect(tpl.grid.every((row) => row.length === 24)).toBe(true);
      expect(tpl.thumbnail).toMatch(/^([0-4]{12}\/){7}[0-4]{12}$/);
    }
    // thin lines survive the 2x2 preview
    expect(AI_FLAG_TEMPLATES.find((t) => t.id === 'nordic-cross').thumbnail).toMatch(/2/);
  });

  it('use a flag template instead of a drawn grid', () => {
    const raw = validTeam();
    raw.flagDesign = { template: 'diamond', grid: [] };
    expect(validateGeneratedTeam(raw).errors).toEqual([]);
    const team = sanitizeGeneratedTeam(raw);
    expect(team.flagTemplate).toBe('diamond');
    expect(team.flagDesign.grid).toEqual(AI_FLAG_TEMPLATES.find((t) => t.id === 'diamond').grid);

    raw.flagDesign = { template: 'unicorn', grid: [] };
    expect(validateGeneratedTeam(raw).errors.join()).toContain('"unicorn" does not exist');
    raw.flagDesign = { template: 'custom', grid: [] };
    expect(validateGeneratedTeam(raw).errors.join()).toContain('choose a template');
  });

  it('fill empty hair/skin lists from the template, filled ones override it', () => {
    const raw = validTeam();
    const blond = c(248, 216, 96);
    raw.hairSkin = {
      template: 'latino',
      first: { hair: [blond], skin: [] },
      second: { hair: [], skin: [] },
      goalkeeper: { hair: [], skin: [] },
    };
    expect(validateGeneratedTeam(raw).errors).toEqual([]);
    const latino = AI_HAIR_SKIN_TEMPLATES.find((t) => t.id === 'latino').hairSkin;
    const team = sanitizeGeneratedTeam(raw);
    expect(team.hairSkin.first.hair).toEqual([blond]);
    expect(team.hairSkin.first.skin).toEqual(latino.first.skin);
    expect(team.hairSkin.goalkeeper).toEqual(latino.goalkeeper);
    expect(team.hairSkinTemplate).toBe('latino');

    raw.hairSkin.template = 'custom';
    expect(validateGeneratedTeam(raw).errors.join()).toContain(
      'hairSkin.first.skin is empty: fill it or choose a hairSkin.template',
    );
  });

  it('check the flag space and the other teams kits', () => {
    const raw = validTeam();
    const context = {
      fitsFlag: () => false,
      otherKits: [{ name: 'GERMANY', home: c(0, 0, 40), away: c(0, 160, 0) }],
    };
    const { errors, warnings } = validateGeneratedTeam(raw, context);
    expect(errors.join()).toContain('does not fit in the flag space');
    expect(warnings.join()).toContain('almost the same color as GERMANY');
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain('GERMANY 000028/00A000');
    expect(prompt).toContain('"nordic-cross": ');
    expect(prompt).toContain('"latino" (Brazil)');
  });
});

describe.skipIf(!hasRealRom)('templates and limits on the real ROM', () => {
  it('dry-runs the flag on a copy and lists the other kits', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const before = rom.getRomData().slice();
    const ctx = buildAiContext(rom, 19);
    expect(ctx.fitsFlag(AI_FLAG_TEMPLATES.find((t) => t.id === 'diamond').grid)).toBe(true);
    expect(rom.getRomData()).toEqual(before);
    expect(ctx.otherKits).toHaveLength(26);
    expect(ctx.otherKits.every((k) => k.name && k.home)).toBe(true);
  });
});

describe('provider models', () => {
  it('never keeps a model of another provider', () => {
    const openai = webAi.getProvider('openai');
    const claude = webAi.getProvider('claude');
    const local = webAi.getProvider('openai-compatible');
    expect(webAi.modelForProvider(claude, 'gpt-6-luna', 'openai')).toBe(claude.defaultModel);
    expect(webAi.modelForProvider(claude, 'claude-opus-5-5', 'openai')).toBe('claude-opus-5-5');
    expect(webAi.modelForProvider(local, 'gpt-6-luna', 'openai')).toBe('');
    expect(webAi.modelForProvider(local, 'qwen3-32b')).toBe('qwen3-32b');
    expect(webAi.modelForProvider(openai, 'qwen3-32b', 'openai-compatible')).toBe(
      openai.defaultModel,
    );
    expect(webAi.modelForProvider(openai, '')).toBe(openai.defaultModel);
  });
});

describe('prompt templates', () => {
  for (const [lang, dict] of [
    ['en', en],
    ['pt-BR', ptBR],
  ]) {
    it(`${lang}: ask only for what the game can do`, () => {
      const texts = Object.entries(dict)
        .filter(([key]) => key.startsWith('aiTpl.') || key.startsWith('aiExample'))
        .map(([, text]) => text);
      expect(texts.length).toBeGreaterThan(10);
      for (const text of texts) {
        for (const [, n] of text.matchAll(/#(\d+)/g)) {
          expect(Number(n), text).toBeGreaterThanOrEqual(1);
          expect(Number(n), text).toBeLessThanOrEqual(16);
        }
        const names = /(?:Names|Nomes): ([^.]+)\./.exec(text);
        if (names) {
          for (const name of names[1].split(/,\s*/))
            expect(name.length, name).toBeLessThanOrEqual(8);
        }
        expect(text).not.toMatch(/mohawk|moicano|vertical split|divisao vertical/i);
      }
    });
  }
});

describe.skipIf(!hasRealRom)('shared goalkeeper on the real ROM', () => {
  it('warns and tells the model when the slot shares its goalkeeper', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const superStar = TEAMS.findIndex((tm) => tm.id === 'SUPERSTAR');
    const [partner] = sharedKeeperTeams(superStar);
    expect(TEAMS[partner].id).toBe('BELGIUM');

    const ctx = buildAiContext(rom, superStar);
    expect(ctx.sharedKeeperWith).toHaveLength(1);
    expect(buildSystemPrompt(ctx, 'look')).toContain('SHARED with');
    expect(validateGeneratedTeam(validTeam(), ctx, 'look').warnings.join()).toContain(
      'its goalkeeper changes too',
    );

    const team = sanitizeGeneratedTeam(validTeam(), ctx);
    const { warnings } = applyImportedTeam(rom, superStar, team);
    expect(warnings).toContain('toastKeeperShared');
    expect(rom.readUniformColors(partner).goalkeeper.shirtAndSocks[0]).toMatchObject(
      team.uniforms.goalkeeper.shirtAndSocks[0],
    );
    expect(buildAiContext(rom, 19).sharedKeeperWith).toEqual([]);
  });
});

describe('prompt optimizer', () => {
  const settings = { provider: 'openai-compatible', endpoint: 'http://x', model: 'm' };

  it('cleans the brief out of the answer', () => {
    expect(cleanOptimizedPrompt('<think>hmm</think>\nBrasil 1994, 4-4-2.')).toBe(
      'Brasil 1994, 4-4-2.',
    );
    // an unfinished <think> while streaming shows nothing yet
    expect(cleanOptimizedPrompt('<think>still thinking')).toBe('');
    expect(cleanOptimizedPrompt('Here is the improved prompt:\nTeam X.')).toBe('Team X.');
    expect(cleanOptimizedPrompt('Prompt melhorado:\nTime X.')).toBe('Time X.');
    expect(cleanOptimizedPrompt('```\nTeam X.\n```')).toBe('Team X.');
    expect(cleanOptimizedPrompt('"Team X."')).toBe('Team X.');
    expect(cleanOptimizedPrompt('Team: X\nKits: red')).toBe('Team: X\nKits: red');
  });

  it('asks for a plain-text brief within what the game can do', async () => {
    const stream = vi.fn(async ({ onChunk }) => {
      onChunk?.('Selecao do Brasil 1994...');
      return { text: 'Selecao do Brasil 1994...', truncated: false };
    });
    const text = await optimizePrompt({
      userPrompt: 'brasil 94',
      settings,
      context: { menuNameMax: 6 },
      stream,
    });
    expect(text).toBe('Selecao do Brasil 1994...');
    const call = stream.mock.calls[0][0];
    expect(call.schema).toBeNull();
    expect(call.userPrompt).toBe('brasil 94');
    expect(call.systemPrompt).toContain('menu name of max 6 letters');
    expect(call.systemPrompt).toContain('SAME LANGUAGE');
    expect(call.systemPrompt).toContain('dreadlocks');
    expect(call.systemPrompt).toContain('no stripes');
    expect(buildOptimizerPrompt()).toContain('4-3-3');

    const cut = vi.fn(async () => ({ text: 'Team', truncated: true }));
    await expect(optimizePrompt({ userPrompt: 'x', settings, stream: cut })).rejects.toMatchObject({
      code: 'truncated',
    });
    const empty = vi.fn(async () => ({ text: '<think>...</think>', truncated: false }));
    await expect(
      optimizePrompt({ userPrompt: 'x', settings, stream: empty }),
    ).rejects.toMatchObject({ code: 'empty' });
  });
});
