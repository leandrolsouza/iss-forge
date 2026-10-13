import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../../rom/RomParser';
import { TEAMS } from '../../rom/constants';
import {
  LEAGUE_SLOTS,
  applyLeague,
  buildLeagueTeamContext,
  buildLeagueTeamRequest,
  buildPlanPrompt,
  buildPlanSchema,
  checkLeaguePlan,
  defaultConcurrency,
  generateLeaguePlan,
  generateLeagueTeam,
  leagueBudgets,
  leagueNameFit,
  runQueue,
  sanitizeLeaguePlan,
  settleDraftResults,
  validateLeaguePlan,
} from '../aiLeague';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);

const CLUBS = [
  'Santos',
  'Corinthians',
  'Gremio',
  'Fluminense',
  'Sao Caetano',
  'Juventude',
  'Atletico MG',
  'Coritiba',
  'Atletico PR',
  'Vitoria',
  'Sao Paulo',
  'Goias',
  'Internacional',
  'Cruzeiro',
  'Guarani',
  'Vasco',
  'Parana',
  'Ponte Preta',
  'Figueirense',
  'Flamengo',
  'Bahia',
  'Paysandu',
  'Palmeiras',
  'Botafogo',
  'Portuguesa',
  'Gama',
  'Criciuma',
  'Fortaleza',
];
const menuOf = (name) => {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  return letters.length > 7 ? letters.slice(0, 4) + letters.slice(-3) : letters;
};

/** A plan answer: `main` clubs of the competition, then clubs of the division below */
function planAnswer(main = 24, lower = 2) {
  const club = (name, division, position) => ({
    name,
    menuName: menuOf(name),
    inGameName: menuOf(name).slice(0, 4),
    division,
    position,
    strength: 5,
    formation: '442-flat',
    style: 'offensive',
    homeShirt: '#F8F8F8',
    awayShirt: '#101010',
    stars: ['Robinho'],
    brief: `${name} brief`,
  });
  return {
    competition: { name: 'Brasileirao', season: '2002', lowerDivision: 'Serie B' },
    teams: [
      ...CLUBS.slice(0, main).map((n, i) => club(n, 'main', i + 1)),
      ...CLUBS.slice(main, main + lower).map((n, i) => club(n, 'lower', i + 1)),
    ],
  };
}

describe('league plan', () => {
  it('fills the 26 selectable slots and leaves Super Star alone', () => {
    expect(LEAGUE_SLOTS).toHaveLength(26);
    expect(LEAGUE_SLOTS.map((i) => TEAMS[i].id)).not.toContain('SUPERSTAR');
    const schema = buildPlanSchema().schema;
    expect(schema.properties.teams.minItems).toBe(26);
    const prompt = buildPlanPrompt();
    expect(prompt).toContain('exactly 26 clubs');
    expect(prompt).toContain('Premier League → Championship');
    expect(prompt).toContain('Serie B');
  });

  it('asks to complete short leagues with the division below', () => {
    const short = planAnswer(20, 0);
    const { errors } = validateLeaguePlan(short);
    expect(errors.join()).toContain('20 clubs (must be exactly 26: complete with the best-placed');
    expect(validateLeaguePlan(planAnswer(20, 6))).toEqual({ errors: [], warnings: [] });
  });

  it('finds duplicates and names that do not fit', () => {
    const plan = planAnswer();
    plan.teams[3].name = 'Santos';
    plan.teams[4].menuName = plan.teams[5].menuName;
    plan.teams[6].menuName = 'ATLETICOMG';
    plan.teams[7].inGameName = 'WWWWWWW';
    delete plan.teams[8].brief;
    const text = validateLeaguePlan(plan).errors.join('\n');
    expect(text).toContain('"Santos" is already in the list');
    expect(text).toContain('is also used by teams[4]');
    expect(text).toContain('"ATLETICOMG" has 10 characters');
    expect(text).toContain('too wide for the scoreboard');
    expect(text).toContain('teams[8].brief is missing');
  });

  it('sorts the main division first, in final position order', () => {
    const plan = planAnswer(24, 2);
    plan.teams.reverse();
    const { warnings } = validateLeaguePlan(plan);
    expect(warnings.join()).toContain('the list was sorted');
    const clean = sanitizeLeaguePlan(plan);
    expect(clean.teams[0]).toMatchObject({ name: 'Santos', division: 'main', position: 1 });
    expect(clean.teams[24]).toMatchObject({ name: 'Portuguesa', division: 'lower', position: 1 });
    expect(clean.teams[0].homeShirt).toEqual({ r: 248, g: 248, b: 248 });
  });

  it('reports menu names that do not fit together', () => {
    const fitNames = (teams) =>
      teams.map((t, i) => ({
        menu: i > 20 ? t.menuName.slice(0, 3) : t.menuName,
        inGameOk: i < 25,
      }));
    const { errors } = validateLeaguePlan(planAnswer(), { fitNames });
    expect(errors.join('\n')).toMatch(/menu names do not fit together .* about \d+ letter/);
    expect(errors.join('\n')).toContain('scoreboard names do not fit together');
  });

  it('asks again with the problems', async () => {
    const answers = [planAnswer(20, 0), planAnswer(20, 6)];
    const stream = vi.fn(async () => ({ text: JSON.stringify(answers.shift()), truncated: false }));
    const result = await generateLeaguePlan({
      userPrompt: 'Brasileirao 2002',
      settings: { provider: 'openai-compatible', endpoint: 'http://x', model: 'league-test' },
      stream,
    });
    expect(result.attempts).toBe(2);
    expect(result.plan.teams).toHaveLength(26);
    expect(stream.mock.calls[0][0].schema.name).toBe('iss_league_plan');
    expect(stream.mock.calls[1][0].userPrompt).toContain('20 clubs');
  });
});

describe('league teams', () => {
  it('builds the request of a club from its line of the plan', () => {
    const plan = sanitizeLeaguePlan(planAnswer());
    const first = buildLeagueTeamRequest(plan, 0, 'Brasileirao 2002');
    expect(first).toContain('Championship: Brasileirao 2002');
    expect(first).toContain('Club: Santos — Brasileirao 2002, final position 1');
    expect(first).toContain('Strength 5/10');
    expect(first).toContain('home shirt #F8F8F8');
    expect(first).toContain('teamNameText "SANTOS"');
    expect(buildLeagueTeamRequest(plan, 25)).toContain('Serie B 2002 (completes the league)');
  });

  it('runs a queue a few at a time and stops when asked', async () => {
    let running = 0;
    let peak = 0;
    const done = [];
    await runQueue(
      [1, 2, 3, 4, 5],
      async (n) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        done.push(n);
        running--;
      },
      { concurrency: 2 },
    );
    expect(peak).toBe(2);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
    const some = [];
    await runQueue([1, 2, 3], async (n) => some.push(n), { shouldStop: () => some.length >= 1 });
    expect(some).toEqual([1]);
    expect(defaultConcurrency('openai-compatible')).toBe(1);
    expect(defaultConcurrency('claude')).toBe(3);
  });

  it('puts interrupted clubs back in the queue', () => {
    expect(
      settleDraftResults({
        0: { status: 'running' },
        1: { status: 'running', team: {} },
        2: { status: 'done' },
      }),
    ).toEqual({ 0: { status: 'pending' }, 1: { status: 'done', team: {} }, 2: { status: 'done' } });
  });
});

describe.skipIf(!hasRealRom)('league on the real ROM', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('checks the names of all clubs together on a copy', () => {
    const rom = load();
    const before = rom.getRomData().slice();
    const plan = sanitizeLeaguePlan(planAnswer());
    const fit = leagueNameFit(rom, LEAGUE_SLOTS, plan.teams);
    expect(fit.every((f, i) => f.menu === plan.teams[i].menuName && f.inGameOk)).toBe(true);
    expect(rom.getRomData()).toEqual(before);
    expect(checkLeaguePlan(rom, LEAGUE_SLOTS, plan).errors).toEqual([]);
    // far too long names for the shared area
    plan.teams.forEach((t, i) => {
      t.menuName = `WWWWWW${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`;
    });
    const errors = checkLeaguePlan(rom, LEAGUE_SLOTS, plan).errors.join();
    expect(errors).toMatch(/menu names do not fit together|has \d+ characters/);
  });

  it('shares the ROM areas and writes every club in one go', async () => {
    const rom = load();
    const plan = sanitizeLeaguePlan(planAnswer());
    const budgets = leagueBudgets(rom, LEAGUE_SLOTS);
    expect(budgets.description).toBeGreaterThan(60);
    expect(Object.keys(budgets.flag)).toHaveLength(26);
    const ctx = buildLeagueTeamContext(rom, plan, LEAGUE_SLOTS, 0, budgets);
    expect(ctx.otherKits.map((k) => k.name)).toContain('CORIANS');
    expect(ctx.otherKits).toHaveLength(26); // 25 clubs + Super Star

    // a fake model that answers every step with a valid team
    const team = (i) => validClubTeam(i);
    const items = [];
    for (let i = 0; i < 26; i++) {
      const stream = vi.fn(async () => ({ text: JSON.stringify(team(i)), truncated: false }));
      const result = await generateLeagueTeam({
        romParser: rom,
        plan,
        slots: LEAGUE_SLOTS,
        index: i,
        userRequest: 'Brasileirao 2002',
        budgets,
        results: {},
        settings: { provider: 'openai-compatible', endpoint: 'http://x', model: 'league-test' },
        stream,
      });
      expect(result.team.teamNameText).toBe(plan.teams[i].menuName);
      items.push({ slot: LEAGUE_SLOTS[i], team: result.team });
    }
    const { warnings } = applyLeague(rom, items);
    expect(warnings.filter((w) => w !== 'toastKeeperShared')).toEqual([]);
    const written = rom.readAllTeams();
    items.forEach(({ slot }, i) => {
      expect(written[slot].teamNameText).toBe(plan.teams[i].menuName);
      expect(written[slot].description.title).toMatch(/^Offensive/);
      expect(written[slot].players[0].name).toBe(`GK${i}`.slice(0, 8));
    });
  });
});

/** A complete team answer for club i (both generation steps take what they need) */
function validClubTeam(i) {
  const c = (r, g, b) => ({ r, g, b });
  const shades = (n, base) =>
    Array.from({ length: n }, (_, k) => c(base, base, Math.min(248, k * 40)));
  return {
    name: `Club ${i}`,
    teamNameText: 'CLUB',
    teamNameInGame: 'CLB',
    formation: '442-flat',
    players: Array.from({ length: 15 }, (_, k) => ({
      name: k === 0 ? `GK${i}` : `P${i}N${k}`,
      number: k + 1,
      acceleration: 8,
      topSpeed: 8,
      dribbleSpeed: 8,
      stamina: 10,
      shooting: 7,
      technique: 7,
      attack: 7,
      defense: 7,
      gkKick: 9,
      hairStyle: k % 11,
      isSpecial: false,
    })),
    description: {
      style: 'offensive',
      title: 'Offensive 4-4-2',
      body: 'A strong squad with fast wingers and a solid defence.',
    },
    specialHair: 'regular',
    specialSkin: 'regular',
    uniforms: {
      home: { shirt: shades(3, (i * 9) % 248), shorts: shades(3, 248), socks: shades(2, 0) },
      away: { shirt: shades(3, 248), shorts: shades(3, 0), socks: shades(2, 248) },
      goalkeeper: { shirtAndSocks: shades(5, 64), shorts: [c(16, 16, 16)] },
    },
    hairSkin: {
      template: 'latino',
      first: { hair: [], skin: [] },
      second: { hair: [], skin: [] },
      goalkeeper: { hair: [], skin: [] },
    },
    flagColors: [c(0, 0, 128), c(248, 248, 248), c(248, 0, 0), c(248, 200, 0)],
    flagDesign: { template: i % 2 ? 'horizontal-3' : 'diamond', grid: [] },
  };
}

describe.skipIf(!hasRealRom)('league keepers on the real ROM', () => {
  it('writes every goalkeeper with hair style 0, also from older drafts', () => {
    const rom = new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
    const team = validClubTeam(0);
    team.players[0].hairStyle = 5;
    // a draft made before the fix: the team as it was stored, unsanitized
    applyLeague(rom, [
      { slot: 3, team: { ...team, players: team.players.map((p) => ({ ...p })) } },
    ]);
    expect(rom.readPlayers(3)[0].hairStyle).toBe(0);
    expect(rom.readPlayers(3)[5].hairStyle).toBe(5);
  });
});
