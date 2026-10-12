/* global Buffer */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../../rom/RomParser';
import { exportTexts, applyTexts, validateTextsFile, stripAccents } from '../textsExport';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

describe.skipIf(!existsSync(REAL_ROM))('texts JSON export/import (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const roundTrip = (data) => JSON.parse(JSON.stringify(data));

  it('exports every part and re-imports an untouched file without changing a byte', () => {
    const rom = load();
    const json = roundTrip(exportTexts(rom));
    expect(validateTextsFile(json).valid).toBe(true);
    expect(json.training.intros).toHaveLength(5);
    expect(json.menus.prematch.map((e) => e.text)).toContain('Substituting');
    expect(json.scenarios).toHaveLength(9);
    expect(json.teamDescriptions).toHaveLength(27);
    expect(json.screens.joypad.find((e) => e.id === 'nameLob').text).toBe('= LOB =');
    expect(json.titleScreen.pressStart).toBe('PRESS START');
    const before = new Uint8Array(rom.getRomData());
    const res = applyTexts(rom, json);
    expect(res.ok).toBe(true);
    expect(res.changed).toEqual({
      training: 0,
      menus: 0,
      screens: 0,
      scenarios: 0,
      teamDescriptions: 0,
      titleScreen: 0,
    });
    expect(Buffer.compare(rom.getRomData(), before)).toBe(0);
  });

  it('imports a translation of every part', () => {
    const rom = load();
    const json = roundTrip(exportTexts(rom));
    json.training.titles[0] = '~ Drible ~';
    json.training.intros[0] = 'Use a corrida e o drible.';
    json.menus.prematch.find((e) => e.original === 'Game Start').text = 'Iniciar Jogo';
    json.scenarios[0].text = 'O Brasil esta com dez homens.';
    json.teamDescriptions.find((d) => d.team === 'BRAZIL').body = 'Time muito tecnico.';
    json.screens.joypad.find((e) => e.id === 'shoot').text = 'CHUTE';
    json.screens.scenario.find((e) => e.id === 'congrats').text = 'PARABENS!';
    json.titleScreen.pressStart = 'Aperte Start';
    json.titleScreen.copyright = '©1995-2026 KONAMI\nTraducao: ISS Forge';
    const res = applyTexts(rom, json);
    expect(res.errors).toEqual([]);
    expect(res.changed).toEqual({
      training: 2,
      menus: 1,
      screens: 2,
      scenarios: 1,
      teamDescriptions: 1,
      titleScreen: 2,
    });
    const again = exportTexts(rom);
    expect(again.titleScreen.pressStart).toBe('APERTE START');
    expect(again.titleScreen.copyright).toBe('©1995-2026 KONAMI\nTRADUCAO: ISS FORGE');
    expect(again.screens.joypad.find((e) => e.id === 'shoot').text).toBe('CHUTE');
    expect(again.training.titles[0]).toBe('~ Drible ~');
    expect(again.menus.prematch[0].text).toBe('Iniciar Jogo');
    expect(again.scenarios[0].text).toBe('O Brasil esta com dez\nhomens.');
    expect(again.teamDescriptions.find((d) => d.team === 'BRAZIL').body).toBe(
      'Time muito\ntecnico.',
    );
  });

  it('accepts partial files and matches menu texts by original when positions are missing', () => {
    const rom = load();
    const res = applyTexts(rom, {
      _format: 'iss-forge-texts',
      menus: { rules: [{ original: 'Yellow Card', text: 'Amarelo' }] },
    });
    expect(res.ok).toBe(true);
    expect(exportTexts(rom).menus.rules.some((e) => e.text === 'Amarelo')).toBe(true);
  });

  it('imports what fits and lists what was skipped, with the reason', () => {
    const rom = load();
    const json = roundTrip(exportTexts(rom));
    json.training.titles[0] = '~ Drible ~';
    const entry = json.menus.prematch[0];
    entry.text = 'x'.repeat(entry.max + 1);
    json.teamDescriptions[0].body =
      'Linha um\nlinha dois\nlinha tres\nlinha quatro\nlinha cinco\nseis\nsete';
    json.screens.cupGroup.find((e) => e.id === 'nextGame').text = 'PROXIMO JOGO';
    const res = applyTexts(rom, json);
    expect(res.ok).toBe(true);
    expect(res.changed.training).toBe(1);
    expect(res.skipped.some((m) => m.startsWith('menus.prematch "Game Start"'))).toBe(true);
    expect(res.skipped.some((m) => /GERMANY: body has 7 lines, max 6/.test(m))).toBe(true);
    expect(res.skipped.some((m) => /screens\.cupGroup\.nextGame .*12 letters, max 8/.test(m))).toBe(
      true,
    );
    const back = exportTexts(rom);
    expect(back.training.titles[0]).toBe('~ Drible ~');
    expect(back.menus.prematch[0].text).toBe('Game Start');
  });

  it('imports the translation in game-translations/PT-BR.json when present', () => {
    const file = fileURLToPath(new URL('../../../game-translations/PT-BR.json', import.meta.url));
    if (!existsSync(file)) return;
    const rom = load();
    const res = applyTexts(rom, JSON.parse(readFileSync(file, 'utf8')));
    expect(res.ok).toBe(true);
    expect(res.changed.menus).toBeGreaterThan(40);
    expect(res.moved.length).toBeGreaterThan(0);
    // every moved screen still decodes with the imported texts (titles are read as screen texts)
    const screens = rom.readMenuScreens();
    for (const id of res.moved.filter((x) => !x.startsWith('title')))
      expect(screens.find((s) => s.id === id).moved).toBe(true);
    const titles = rom.readScreenTexts().titles;
    expect(Object.values(titles).join(' ')).not.toContain('?');
  });

  it('re-imports over an earlier import (matches by the original text, re-packs moved screens)', () => {
    const file = fileURLToPath(new URL('../../../game-translations/PT-BR.json', import.meta.url));
    if (!existsSync(file)) return;
    const pt = JSON.parse(readFileSync(file, 'utf8'));
    const rom = load();
    // First import without the World Series fixtures: other screens take the free space
    const first = structuredClone(pt);
    delete first.menus.wsFixtures;
    applyTexts(rom, first);
    const res = applyTexts(rom, pt);
    expect(res.skipped.filter((m) => m.startsWith('menus.'))).toEqual([]);
    expect(res.warnings.some((w) => w.includes('not found'))).toBe(false);
    const ws = rom.readMenuScreens().find((s) => s.id === 'wsFixtures');
    expect(ws.runs.map((r) => r.text)).toContain('FASE PARTIDAS');
    // no two screens overlap after the re-pack
    const spans = rom
      .readMenuScreens()
      .map((s) => [s.location, s.location + s.size])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++)
      expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
  });
  it('removes accents, warns about characters without a glyph and rejects other formats', () => {
    const rom = load();
    const res = applyTexts(rom, {
      _format: 'iss-forge-texts',
      training: { titles: ['~ Ação ~', 'Gol #1'] },
    });
    expect(res.ok).toBe(true);
    expect(exportTexts(rom).training.titles.slice(0, 2)).toEqual(['~ Acao ~', 'Gol  1']);
    expect(res.warnings.some((w) => w.includes('accents removed'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('#'))).toBe(true);
    expect(stripAccents('técnico “ótimo” – já')).toBe('tecnico "otimo" - ja');
    expect(validateTextsFile({ _format: 'iss-forge-team' }).valid).toBe(false);
  });
});
