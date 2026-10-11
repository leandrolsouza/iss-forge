import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  encodeScreenField,
  screenTextCells,
  validateScreenTexts,
  measureScreenPacks,
  screenFieldAddress,
} from '../screenTexts';
import {
  layoutSpriteText,
  readSpriteEntries,
  decodeSpriteEntries,
  installedMenuGlyphs,
  readMenuFontTiles,
} from '../menuSprites';
import { buildTitleWords } from '../titleScreens';
import { readScreenWords } from '../menuScreens';
import { SCREEN_TEXTS } from '../constants';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

const field = (screen, id) =>
  SCREEN_TEXTS.find((s) => s.id === screen).fields.find((f) => f.id === id);

describe('screen text encoding', () => {
  it('counts palette codes as no cell and pads to the drawn length', () => {
    expect(screenTextCells('= A {fe}{28}TYPE A{fe}{20} =')).toBe(12);
    const f = { kind: 'fixed', columns: 5, room: 7 };
    const res = encodeScreenField(f, '{fe}{28}AB');
    expect(res.error).toBeUndefined();
    expect(res.bytes).toEqual([0xfe, 0x28, 0x6c, 0x6d, 0, 0, 0]);
    expect(encodeScreenField(f, 'ABCDEF').error).toBe('tooLong');
  });

  it('pads labels with low dots', () => {
    const res = encodeScreenField({ kind: 'label', columns: 6 }, 'LOB');
    expect(res.bytes).toEqual([0x77, 0x7a, 0x6d, 0x55, 0x55, 0x55]);
  });

  it('limits in-place boxes to their room', () => {
    const f = { kind: 'box', room: 8, lines: 2, columns: 10 };
    expect(encodeScreenField(f, 'ABC\nDEF').error).toBeUndefined();
    expect(encodeScreenField(f, 'ABCDE\nFGHIJ').error).toBe('noRoom');
    expect(encodeScreenField(f, 'A\nB\nC').error).toBe('tooManyLines');
  });
});

describe.skipIf(!existsSync(REAL_ROM))('screen texts (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads the texts drawn by code', () => {
    const t = load().readScreenTexts();
    expect(t.joypad.intro).toBe('Press"L"or"R"button to\nsee what functions each\nkey performs.');
    expect(t.joypad.lob).toBe('LOB');
    expect(t.joypad.dash).toBe('DASH');
    expect(t.joypad.nameLob).toBe('= LOB =');
    expect(t.joypad.nameTypeA).toBe('= PLAYER CHANGE {fe}{28}TYPE A{fe}{20} =');
    expect(t.joypad.helpPass).toBe('The pass along the ground\nis used mainly for a short\npass.');
    expect(t.joypad.playerChange).toBe('PLAYER\n    CHANGE');
    expect(t.scenario.score).toBe('SCORE');
    expect(t.scenario.time).toBe('TIME');
    expect(t.scenario.extraTime).toBe('EXTRA TIME');
    expect(t.scenario.congrats).toBe('CONGRATULATIONS!');
    expect(t.scenario.unlucky).toBe('UNLUCKY THIS TIME.\n    TRY AGAIN.');
    expect(t.cupGroup.nextGame).toBe('NEXTGAME');
    expect(t.worldSeries.season1).toBe('1ST');
    expect(t.worldSeries.stage2).toBe('ND');
    expect(t.worldSeries.stageN).toBe('TH');
    expect(t.training.level).toBe(' LEVEL');
  });

  it('rewrites the original texts without changing what the game draws', () => {
    const rom = load();
    const before = rom.readScreenTexts();
    expect(validateScreenTexts(before)).toEqual([]);
    expect(rom.writeScreenTexts(before).ok).toBe(true);
    expect(rom.readScreenTexts()).toEqual(before);
    // in-place texts keep their exact bytes (only the packed help area changes layout)
    const orig = rom.getOriginalData();
    for (const s of SCREEN_TEXTS)
      for (const f of s.fields) {
        if (f.pack || f.kind === 'box') continue;
        const at = f.at ?? null;
        if (at === null) continue;
        const n = f.kind === 'repeat' ? f.count * f.columns : (f.lines || 1) * f.columns;
        expect(Array.from(rom.readBytes(at, n)), `${s.id}.${f.id}`).toEqual(
          Array.from(orig.slice(at, at + n)),
        );
      }
  });

  it('writes translations and re-packs the joypad help texts', () => {
    const rom = load();
    const t = rom.readScreenTexts();
    t.joypad.lob = 'LOB';
    t.joypad.shoot = 'CHUTE';
    t.joypad.nameTypeA = '= TROCA JOGADOR {fe}{28}TIPO A{fe}{20} =';
    t.joypad.helpLob = 'A distancia do lob depende\nde quanto tempo o botao\nfica apertado.';
    t.scenario.unlucky = 'NAO FOI DESTA VEZ.\nTENTE DE NOVO.';
    t.worldSeries.stageN = 'a.';
    expect(rom.writeScreenTexts(t).ok).toBe(true);
    const back = rom.readScreenTexts();
    expect(back).toEqual(t);
    // both 1P and 2P columns
    expect(Array.from(rom.readBytes(0x11fda + 14, 9))).toEqual(
      Array.from(rom.readBytes(0x11fda, 9)),
    );
    expect(measureScreenPacks(back).joypadHelp.used).toBeLessThanOrEqual(1274);
  });

  it('refuses texts that do not fit', () => {
    const rom = load();
    const t = rom.readScreenTexts();
    t.cupGroup.nextGame = 'PROXIMO JOGO';
    t.joypad.helpDash = 'x '.repeat(400);
    const issues = validateScreenTexts(t);
    expect(issues.map((i) => i.field ?? i.error)).toEqual(
      expect.arrayContaining(['nextGame', 'helpDash']),
    );
    expect(rom.writeScreenTexts(t).ok).toBe(false);
    expect(field('cupGroup', 'nextGame').columns).toBe(8);
  });

  it('reads the main menu sprite lists as text', () => {
    const t = load().readScreenTexts();
    expect(Object.values(t.mainMenu)).toEqual([
      'OPEN GAME',
      'INTERNATIONAL CUP',
      'WORLD SERIES',
      'TRAINING',
      'SCENARIOS',
      'PENALTY KICK',
      'PASSWORD',
      'OPTIONS',
    ]);
  });

  it('lays out new main menu items like the original ones', () => {
    const f = field('mainMenu', 'openGame');
    const res = encodeScreenField(f, 'OPEN GAME');
    expect(res.error).toBeUndefined();
    expect(res.sprites).toBe(11); // same pieces as the original list
    // letters touch ink to ink, as Konami placed them (within a pixel or two)
    const rom = load();
    const orig = readSpriteEntries(rom, screenFieldAddress(rom, f));
    const mine = layoutSpriteText('OPEN GAME', f).entries;
    const xs = (list, tile) =>
      list
        .filter((e) => e.tile === tile && e.big)
        .map((e) => e.dx)
        .sort((a, b) => a - b);
    expect(xs(mine, 0x10e)).toEqual(xs(orig, 0x10e)); // P
    expect(Math.abs(xs(mine, 0x108)[0] - xs(orig, 0x108)[0])).toBeLessThanOrEqual(2); // M
    expect(decodeSpriteEntries(mine)).toBe('OPEN GAME');
    expect(encodeScreenField(f, 'BOLA').error).toBe('noGlyph');
    expect(encodeScreenField(f, 'COPA INTERNACIONAL COPA').error).toBe('tooWide');
  });

  it('writes translated main menu items and keeps the unchanged ones byte for byte', () => {
    const rom = load();
    const t = rom.readScreenTexts();
    const before = Array.from(rom.readBytes(0x43c4f, 0x43e3f - 0x43c4f));
    expect(rom.writeScreenTexts(t).ok).toBe(true);
    expect(Array.from(rom.readBytes(0x43c4f, 0x43e3f - 0x43c4f))).toEqual(before);
    t.mainMenu.openGame = 'AMISTOSO';
    t.mainMenu.internationalCup = 'COPA INTERNACIONAL';
    t.mainMenu.training = 'treino';
    expect(validateScreenTexts(t)).toEqual([]);
    expect(rom.writeScreenTexts(t).ok).toBe(true);
    const back = rom.readScreenTexts().mainMenu;
    expect(back.openGame).toBe('AMISTOSO');
    expect(back.internationalCup).toBe('COPA INTERNACIONAL');
    expect(back.training).toBe('TREINO');
    expect(back.options).toBe('OPTIONS');
    // the table points into bank $88 and the lists stay inside the area
    const ptr = rom.readByte(0x39e1f + 7 * 2) | (rom.readByte(0x39e20 + 7 * 2) << 8);
    expect(0x40000 + ptr - 0x8000).toBeLessThan(0x43e3f);
  });

  it('reads the mode titles from their tilemaps and writes new ones', () => {
    const rom = load();
    const t = rom.readScreenTexts();
    expect(t.titles).toEqual({
      cup: 'INTERNATIONAL\nCUP',
      cupFinal: 'INTERNATIONAL\nCUP\nFINAL',
      cupTournament: 'INTERNATIONAL\nCUP\nTOURNAMENT',
      championship: 'CHAMPION  SHIP',
      worldSeries1: 'WORLD SERIES\n1ST  SEASON',
      worldSeries2: 'WORLD SERIES\n2ND  SEASON',
      special: 'SPECIAL GAME',
    });
    // the original layout is rebuilt exactly from the text
    for (const f of SCREEN_TEXTS.find((s) => s.id === 'titles').fields) {
      const words = buildTitleWords(rom, f.offset, t.titles[f.id]);
      expect(Array.from(words), f.id).toEqual(Array.from(readScreenWords(rom, f.offset)));
    }
    expect(encodeScreenField(field('titles', 'cup'), 'COPA\nJOGO').error).toBe('noGlyph');
    expect(encodeScreenField(field('titles', 'cup'), 'COPA INTERNACIONAL').error).toBe('tooWide');
    t.titles.cup = 'COPA\nINTERNACIONAL';
    t.titles.worldSeries1 = 'SERIE MUNDIAL\nTEMPORADA 1';
    t.titles.special = 'PARTIDA ESPECIAL';
    const res = rom.writeScreenTexts(t);
    expect(res.ok).toBe(true);
    const back = rom.readScreenTexts().titles;
    expect(back.cup).toBe('COPA\nINTERNACIONAL');
    expect(back.worldSeries1).toBe('SERIE MUNDIAL\nTEMPORADA 1');
    expect(back.special).toBe('PARTIDA ESPECIAL');
    expect(back.championship).toBe('CHAMPION  SHIP');
  });

  it('draws H over the K tiles when the menu needs it, and puts K back', () => {
    const rom = load();
    const t = rom.readScreenTexts();
    t.mainMenu.password = 'SENHA';
    // PENALTY KICK still uses K
    expect(validateScreenTexts(t).map((i) => i.error)).toContain('fontConflict');
    t.mainMenu.penaltyKick = 'PENALTIS';
    expect(validateScreenTexts(t)).toEqual([]);
    expect(rom.writeScreenTexts(t).ok).toBe(true);
    expect(installedMenuGlyphs(rom)).toEqual(['H']);
    expect(rom.readScreenTexts().mainMenu.password).toBe('SENHA');
    const orig = readMenuFontTiles(new RomParser(rom.getOriginalData()));
    const now = readMenuFontTiles(rom);
    // only the 4 tiles of K changed
    const changed = [];
    for (let tile = 0; tile < orig.length / 32; tile++)
      if (orig.slice(tile * 32, tile * 32 + 32).some((b, k) => now[tile * 32 + k] !== b))
        changed.push(0x100 + tile);
    expect(changed).toEqual([0x106, 0x107, 0x116, 0x117]);
    t.mainMenu.password = 'PASSWORD';
    t.mainMenu.penaltyKick = 'PENALTY KICK';
    expect(rom.writeScreenTexts(t).ok).toBe(true);
    expect(installedMenuGlyphs(rom)).toEqual([]);
    expect(Array.from(readMenuFontTiles(rom))).toEqual(Array.from(orig));
    expect(rom.readScreenTexts().mainMenu.penaltyKick).toBe('PENALTY KICK');
  });

  it('restores the raw bytes for undo', () => {
    const rom = load();
    const snap = rom.readScreenTextBytes();
    const before = rom.readScreenTexts();
    const t = structuredClone(before);
    t.joypad.helpFlick = 'Teste';
    t.scenario.congrats = 'PARABENS!';
    rom.writeScreenTexts(t);
    rom.restoreScreenTextBytes(snap);
    expect(rom.readScreenTexts()).toEqual(before);
  });
});
