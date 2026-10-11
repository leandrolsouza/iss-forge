import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  readTrainingTexts,
  writeTrainingTexts,
  measureTrainingTexts,
  validateTrainingTexts,
  decodeIss,
  encodeIss,
  layoutFixed,
  readTrainingTextBytes,
  restoreTrainingTextBytes,
} from '../gameTexts';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

describe('ISS charset (8x16 font)', () => {
  it('round-trips letters, digits, punctuation and tokens', () => {
    const text = "You'll score 2-1 ~ {1S}{T} {a7}";
    const { codes, invalid } = encodeIss(text);
    expect(invalid).toEqual([]);
    expect(decodeIss(codes)).toBe(text);
    expect(encodeIss('A').codes).toEqual([0x6c]);
    expect(encodeIss('a').codes).toEqual([0x86]);
  });

  it('reports characters without a glyph', () => {
    expect(encodeIss('Atenção').invalid.sort()).toEqual(['ã', 'ç']);
  });

  it('lays out fixed texts with word wrap and padding', () => {
    const { codes, overflow } = layoutFixed('Bom esforco. Tente bater o recorde.', 3, 20);
    expect(codes).toHaveLength(60);
    expect(overflow).toBe(false);
    expect(decodeIss(codes.slice(0, 20)).trimEnd()).toBe('Bom esforco. Tente');
    expect(layoutFixed('x '.repeat(40), 3, 20).overflow).toBe(true);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('training texts (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('reads intros, results, record, messages and titles', () => {
    const t = readTrainingTexts(load());
    expect(t.intros[0]).toBe(
      'Use dash well and\ndribble well to\navoid being\ntackled.\nCollect all flags\nas quickly as\npossible.',
    );
    expect(t.results).toHaveLength(5);
    expect(t.results[0][0]).toBe('You need to\nimprove your\ndribbling.');
    expect(t.record.startsWith('You`ve beaten') || t.record.startsWith("You've beaten")).toBe(true);
    expect(t.messages[0]).toBe('You definitely need\nmore practice!');
    expect(t.titles.map((s) => s.trim())).toEqual([
      '~ Dribble ~',
      '~ Pass ~',
      '~ Shoot ~',
      '~ Defence ~',
      '~ Corner Kick ~',
    ]);
    expect(validateTrainingTexts(t)).toEqual([]);
  });

  it('re-packs the same texts without changing what is read', () => {
    const rom = load();
    const before = readTrainingTexts(rom);
    expect(writeTrainingTexts(rom, before).ok).toBe(true);
    expect(readTrainingTexts(rom)).toEqual(before);
  });

  it('writes longer texts while there is room, and refuses when the area is full', () => {
    const rom = load();
    const t = readTrainingTexts(rom);
    t.intros[0] =
      'Use o drible e a corrida para nao perder a bola.\nPegue todas as bandeiras o mais rapido possivel.';
    t.results[2][3] = 'Fantastico!\nNinguem segura voce agora!';
    t.messages[1] = 'Voce vai ter problemas para ser titular.';
    t.titles[3] = '~ Defesa ~';
    expect(writeTrainingTexts(rom, t).ok).toBe(true);
    const back = readTrainingTexts(rom);
    expect(back.intros[0].split('\n')[0]).toBe('Use o drible e a');
    expect(back.results[2][3]).toBe('Fantastico!\nNinguem segura\nvoce agora!');
    expect(back.messages[1]).toBe('Voce vai ter\nproblemas para ser\ntitular.');
    expect(back.titles[3]).toBe('~ Defesa ~');

    const full = { ...t, intros: t.intros.map(() => 'x'.repeat(140)) };
    const m = measureTrainingTexts(full);
    expect(m.intro).toBeGreaterThan(m.introCapacity);
    expect(writeTrainingTexts(rom, full).ok).toBe(false);
  });

  it('restores the raw bytes for undo', () => {
    const rom = load();
    const snap = readTrainingTextBytes(rom);
    const original = readTrainingTexts(rom);
    const t = { ...original, titles: ['A', 'B', 'C', 'D', 'E'] };
    writeTrainingTexts(rom, t);
    restoreTrainingTextBytes(rom, snap);
    expect(readTrainingTexts(rom)).toEqual(original);
  });
});
