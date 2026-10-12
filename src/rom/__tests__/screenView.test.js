/* global Buffer */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { konamiDecompress, konamiCompress } from '../KonamiCodec';
import {
  SCREEN_VIEWS,
  readLoadList,
  listFile,
  buildScreenVram,
  buildScreenCgram,
  decompressedSize,
  renderScreenView,
  renderTileSheet,
  inspectScreenPixel,
  mainMenuSprites,
  overlayWords,
  overlayLabel,
} from '../screenView';
import { applyTexts } from '../../utils/textsExport';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const PT_BR = fileURLToPath(new URL('../../../game-translations/PT-BR.json', import.meta.url));
const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
const view = (id) => SCREEN_VIEWS.find((v) => v.id === id);
const pixel = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i] >> 3, img.data[i + 1] >> 3, img.data[i + 2] >> 3];
};
/** FNV-1a of the RGB of an image */
const hash = (img) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < img.data.length; i++) {
    if (i % 4 === 3) continue;
    h ^= img.data[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

describe('screen viewer helpers', () => {
  it('decompressedSize walks the Konami stream to the real output length', () => {
    for (const n of [1, 31, 32, 300, 2048]) {
      const src = Uint8Array.from({ length: n }, (_, i) => (i % 7 === 0 ? 0 : (i * 37) & 0xff));
      const packed = Uint8Array.from(konamiCompress(src));
      expect(decompressedSize(packed, 0)).toBe(n);
      expect(Array.from(konamiDecompress(packed, 0).subarray(0, n))).toEqual(Array.from(src));
    }
  });

  it('every recipe has loads, palettes and a PPU setup (except the title screen)', () => {
    const ids = new Set();
    for (const v of SCREEN_VIEWS) {
      expect(ids.has(v.id)).toBe(false);
      ids.add(v.id);
      if (v.kind === 'title') continue;
      expect(v.loads.length).toBeGreaterThan(0);
      expect(v.palettes.length).toBeGreaterThan(0);
      expect(v.ppu.bg).toHaveLength(3);
    }
  });

  it('renderTileSheet lays tiles in a grid', () => {
    const vram = new Uint8Array(0x10000);
    vram[0x8000] = 0x80; // tile 0 of $4000, 2bpp: top-left pixel = colour 1
    const cg = new Uint16Array(256);
    cg[1] = 0x7fff;
    const img = renderTileSheet(vram, cg, { chars: 0x4000, bpp: 2, palette: 0, count: 20 });
    expect([img.width, img.height]).toEqual([128, 16]);
    expect(pixel(img, 0, 0)).toEqual([31, 31, 31]);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('screen viewer (real ROM)', () => {
  it('reads the bank $82 load lists', () => {
    const rom = load();
    const menu = readLoadList(rom, listFile(0x828455));
    expect(menu.kind).toBe('vram');
    expect(menu.entries.map((e) => e.dest)).toEqual([
      0x5000, 0x7000, 0x3000, 0x1000, 0x1400, 0x1800,
    ]);
    expect(menu.entries[1].file).toBe(0x6ccc0); // main menu font
    const text = readLoadList(rom, listFile(0x8284fe));
    expect(text).toEqual({ kind: 'wram', entries: [{ dest: 0x7e4390, file: 0x3fe82 }] });
  });

  it('builds VRAM and CGRAM like the emulator save states', () => {
    const rom = load();
    const { vram, sources } = buildScreenVram(rom, view('prematch').loads);
    // pre-match text screen in the BG3 map ($1800), from its descriptor
    const words = konamiDecompress(rom.getRomData(), 0x3fe82);
    expect(Buffer.compare(vram.subarray(0x3000, 0x3800), words.subarray(0, 0x800))).toBe(0);
    expect(sources.find((s) => s.start === 0x3000).file).toBe(0x3fe82);
    // main menu palettes: row 0 of $81:890E and the backdrop of the screenshot
    const cg = buildScreenCgram(rom, view('mainMenu').palettes);
    expect(cg[0]).toBe(0x1804);
    expect(Array.from(cg.subarray(17, 20))).toEqual([0x7f5b, 0x7e15, 0x540b]);
    // the blob of $81:890E is 8 rows (size word = bytes - 1): row 8 comes from $81:8911
    expect(cg[129]).toBe(0x0044);
  });

  it('draws every screen (stable output, checked against the emulator when the recipes were made)', () => {
    const rom = load();
    const hashes = {};
    for (const v of SCREEN_VIEWS) {
      if (v.kind) continue;
      const img = renderScreenView(rom, v);
      expect([img.width, img.height]).toEqual([256, 224]);
      const colours = new Set();
      for (let i = 0; i < img.data.length; i += 4 * 97)
        colours.add(img.data.slice(i, i + 3).join());
      expect(colours.size).toBeGreaterThan(8);
      hashes[v.id] = hash(img);
    }
    // all different screens
    expect(new Set(Object.values(hashes)).size).toBe(Object.keys(hashes).length);
  });

  it('colour math: BG2 darkened inside the boxes, main menu streaks subtracted', () => {
    const rom = load();
    const pm = view('prematch');
    const withMath = renderScreenView(rom, pm, { layers: { bg1: false, bg3: false } });
    const noMath = renderScreenView(rom, pm, { layers: { bg1: false, bg3: false, math: false } });
    // (100, 100) is inside the box (lines 31-208, x 71-185); (20, 100) is outside
    const [a, b] = [pixel(withMath, 100, 100), pixel(noMath, 100, 100)];
    expect(a.map((v, k) => Math.max(0, b[k] - [4, 3, 7][k]))).toEqual(a);
    expect(pixel(withMath, 20, 100)).toEqual(pixel(noMath, 20, 100));
  });

  it('inspects a pixel: visible layer, tile and the ROM blocks', () => {
    const rom = load();
    const img = renderScreenView(rom, view('prematch'));
    // a pixel of "Game Start" (BG3 text, cell row 5)
    let hit = null;
    for (let x = 80; x < 180 && !hit; x++) {
      const info = inspectScreenPixel(img, x, 44);
      if (info.top === 'bg3') hit = info;
    }
    expect(hit).not.toBeNull();
    const bg3 = hit.layers[2];
    expect(bg3.mapSource.file).toBe(0x3fe82);
    expect(bg3.tileSource.list).toBe(0x828321); // the 8x16 font
    expect(bg3.bpp).toBe(2);
  });

  it('overlays: texts drawn by code, read from the current ROM', () => {
    const rom = load();
    const v = view('trainingIntro');
    // same words as the emulator's BG3 map (intro.st): "~ Dribble ~" at row 10, col 7
    const title = overlayWords(rom, v.overlays[1]);
    expect(title.columns).toBe(15);
    expect(title.words[0]).toBe(0x20c7); // "~" top tile
    const box = overlayWords(rom, v.overlays[2]);
    expect(Array.from(box.words.subarray(0, 3))).toEqual([0x2084, 0x20ac, 0x209e]); // "Use"
    expect(overlayLabel(v.overlays[2])).toBe('training.intros[0]');

    const before = renderScreenView(rom, v);
    const texts = rom.readTrainingTexts();
    texts.intros[0] = 'Corra e drible.';
    expect(rom.writeTrainingTexts(texts).ok).toBe(true);
    const after = renderScreenView(rom, v);
    expect(hash(after)).not.toBe(hash(before));
    // a pixel of the instructions box points to the overlay
    let src = null;
    for (let x = 56; x < 200 && !src; x++) {
      const s = inspectScreenPixel(after, x, 100).layers[2].mapSource;
      if (s?.overlay) src = s;
    }
    expect(overlayLabel(src.overlay)).toBe('training.intros[0]');
    // without the texts layer the box is empty
    const bare = renderScreenView(rom, v, { layers: { texts: false } });
    expect(inspectScreenPixel(bare, 60, 100).layers[2].mapSource).toBeNull();
  });

  it('overlays: joypad labels and help, team description', () => {
    const rom = load();
    const joy = view('joypad');
    const lob = overlayWords(
      rom,
      joy.overlays.find((o) => o.field === 'lob'),
    );
    expect(lob.columns).toBe(9);
    const desc = overlayWords(rom, view('teamSelect').overlays[0]);
    expect(desc.words[0]).toBe(0x2c7e); // "O" of "Offensive" in palette 3 (teamsel.st)
  });

  it('main menu: the 8 item sprite lists', () => {
    const sprites = mainMenuSprites(load());
    expect(sprites.length).toBe(122); // as counted in menuSprites.test.js
    expect(sprites.every(([x, y]) => x >= 0 && x < 256 && y >= 0 && y < 224)).toBe(true);
  });

  it.skipIf(!existsSync(PT_BR))('shows a translated ROM (moved screens and new menu items)', () => {
    const rom = load();
    const before = {
      prematch: hash(renderScreenView(rom, view('prematch'))),
      mainMenu: hash(renderScreenView(rom, view('mainMenu'))),
    };
    const res = applyTexts(rom, JSON.parse(readFileSync(PT_BR, 'utf8')));
    expect(res.moved).toContain('prematch');
    const img = renderScreenView(rom, view('prematch'));
    expect(hash(img)).not.toBe(before.prematch);
    expect(hash(renderScreenView(rom, view('mainMenu')))).not.toBe(before.mainMenu);
    // the BG3 map now comes from where the pre-match screen was moved to
    const map = img.sources.find((s) => s.start === 0x3000);
    expect(map.file).not.toBe(0x3fe82);
  });
});
