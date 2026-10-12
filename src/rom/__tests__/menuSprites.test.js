import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import {
  MENU_SPRITE_ALL,
  MENU_SPRITE_CHARS,
  menuSpriteFont,
  findInvalidSpriteChars,
  assignMenuFont,
  layoutSpriteText,
  spriteLineUsage,
  encodeSpriteEntries,
  readSpriteEntries,
  decodeSpriteEntries,
  readMenuFontTiles,
  glyphTileBytes,
  installedMenuGlyphs,
  sameMenuFont,
  writeMenuFont,
} from '../menuSprites';
import {
  MENU_SPRITE_FONT,
  MENU_SPRITE_DRAWN,
  MENU_SPRITE_LAYOUT,
  MENU_FONT_SLOTS,
  MENU_FONT_BLOCK,
  SCREEN_TEXT_PACKS,
} from '../constants';
import { konamiCompress } from '../KonamiCodec';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

const ENGLISH_ITEMS = [
  'OPEN GAME',
  'INTERNATIONAL CUP',
  'WORLD SERIES',
  'TRAINING',
  'SCENARIOS',
  'PENALTY KICK',
  'PASSWORD',
  'OPTIONS',
];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DRAWN = ['H', 'Q', 'V', 'X', 'Z'];

/** The 4 tiles of the 16x16 glyph of a slot letter */
const slotTiles = (slot) => {
  const t = MENU_SPRITE_FONT[slot].pieces[0][2];
  return [t, t + 1, t + 16, t + 17];
};
const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const big = (dx, dy, tile) => ({ dx, dy, tile, big: true });
const small = (dx, dy, tile) => ({ dx, dy, tile, big: false });

describe('menu sprite alphabet', () => {
  it('has the 26 letters (original, built from pieces and drawn by the editor)', () => {
    expect(MENU_SPRITE_CHARS).toBe(ALPHABET);
    expect(Object.keys(MENU_SPRITE_ALL).sort().join('')).toBe(ALPHABET);
    expect(Object.keys(MENU_SPRITE_DRAWN).sort()).toEqual(DRAWN);
    for (const ch of DRAWN) expect(MENU_SPRITE_FONT[ch], ch).toBeUndefined();
  });

  it('keeps the original glyphs and puts the drawn ones at the first slot', () => {
    for (const [ch, g] of Object.entries(MENU_SPRITE_FONT)) expect(MENU_SPRITE_ALL[ch]).toBe(g);
    const placeholder = MENU_SPRITE_FONT[MENU_FONT_SLOTS[0]].pieces[0][2];
    for (const ch of DRAWN) {
      expect(MENU_SPRITE_ALL[ch], ch).toEqual({
        pieces: [[0, 0, placeholder, 1]],
        ink: MENU_SPRITE_DRAWN[ch].ink,
      });
    }
  });
});

describe('menuSpriteFont', () => {
  it('is the original font when nothing is installed', () => {
    expect(menuSpriteFont()).toEqual(MENU_SPRITE_FONT);
    expect(menuSpriteFont({})).toEqual(MENU_SPRITE_FONT);
  });

  it('drops the slot letter and adds the drawn letter on its tiles', () => {
    const font = menuSpriteFont({ H: 'K' });
    expect(font.K).toBeUndefined();
    expect(font.H).toEqual({ pieces: [[0, 0, 0x106, 1]], ink: MENU_SPRITE_DRAWN.H.ink });
    expect(Object.keys(font).sort()).toEqual(
      [...Object.keys(MENU_SPRITE_FONT).filter((c) => c !== 'K'), 'H'].sort(),
    );
  });

  it('also drops the letters that draw any tile of an occupied slot', () => {
    const gone = (installed) =>
      Object.keys(MENU_SPRITE_FONT)
        .filter((c) => !menuSpriteFont(installed)[c])
        .sort();
    expect(gone({ V: 'O' })).toEqual(['C', 'G', 'O']); // left half of O
    expect(gone({ V: 'D' })).toEqual(['B', 'D', 'L']); // foot of D, bottom of B
    expect(gone({ V: 'P' })).toEqual(['B', 'F', 'P']); // top of B, bottom of F
    expect(gone({ V: 'E' })).toEqual(['E', 'F']); // top of F
    expect(gone({ H: 'K', V: 'W' })).toEqual(['K', 'W']);
  });
});

describe('findInvalidSpriteChars', () => {
  it('accepts every letter in either case and spaces', () => {
    expect(findInvalidSpriteChars(ALPHABET)).toEqual([]);
    expect(findInvalidSpriteChars(ALPHABET.toLowerCase())).toEqual([]);
    expect(findInvalidSpriteChars('open game')).toEqual([]);
    expect(findInvalidSpriteChars('')).toEqual([]);
  });

  it('reports each character without a glyph once', () => {
    expect(findInvalidSpriteChars('Caça 1-1!')).toEqual(['Ç', '1', '-', '!']);
    expect(findInvalidSpriteChars(12)).toEqual(['1', '2']);
  });
});

describe('assignMenuFont', () => {
  it('needs nothing for texts made only of original letters', () => {
    expect(assignMenuFont(ENGLISH_ITEMS)).toEqual({ installed: {}, missing: [] });
    expect(assignMenuFont(['BOLA FIJO'])).toEqual({ installed: {}, missing: [] });
  });

  it('gives the drawn letters the free slots in MENU_FONT_SLOTS order', () => {
    expect(assignMenuFont(['hoje'])).toEqual({ installed: { H: 'K' }, missing: [] });
    // drawn letters are handled in MENU_SPRITE_DRAWN order (H V Q X Z)
    expect(assignMenuFont(['ZXQVH'])).toEqual({
      installed: { H: 'K', V: 'W', Q: 'D', X: 'P', Z: 'M' },
      missing: [],
    });
  });

  it('skips the slots whose tiles a used letter draws', () => {
    // K and W used; L uses the foot of D; B uses P and D; F uses E and P
    expect(assignMenuFont(['KIWI', 'LUA', 'BIFE', 'HV']).installed).toEqual({ H: 'M', V: 'R' });
  });

  it('keeps a drawn letter in its current slot when that slot is still free', () => {
    expect(assignMenuFont(['HV'], { H: 'S' })).toEqual({
      installed: { H: 'S', V: 'K' },
      missing: [],
    });
    // S is used now: H moves to the first free slot
    expect(assignMenuFont(['HS'], { H: 'S' }).installed).toEqual({ H: 'K' });
    // letters no longer used are dropped
    expect(assignMenuFont(['TIA'], { H: 'K', V: 'W' }).installed).toEqual({});
  });

  it('reports the drawn letters that find no free slot', () => {
    // the English items use every 16x16 letter
    expect(assignMenuFont([...ENGLISH_ITEMS, 'HQ'])).toEqual({
      installed: {},
      missing: ['H', 'Q'],
    });
    // only O is free
    expect(assignMenuFont(['AKWDPMRNSE', 'HV'])).toEqual({
      installed: { H: 'O' },
      missing: ['V'],
    });
  });
});

describe('layoutSpriteText', () => {
  const opts = { row: 0 };

  it('places the first letter at START, one sprite per piece', () => {
    expect(layoutSpriteText('A', opts)).toEqual({
      entries: [big(MENU_SPRITE_LAYOUT.START, 0, 0x100)],
      right: MENU_SPRITE_LAYOUT.START + 15,
      invalid: [],
    });
    expect(layoutSpriteText('i', { row: 10, start: 0 }).entries).toEqual([
      small(0, 10, 0x127),
      small(0, 18, 0x128),
    ]);
  });

  it('touches the letters ink to ink, right-most letter first', () => {
    // A ink 0-15, D ink 2-15: D origin = 15 + 1 - 2
    const res = layoutSpriteText('AD', { row: 5, start: 0 });
    expect(res.entries).toEqual([big(14, 5, 0x102), big(0, 5, 0x100)]);
    expect(res.right).toBe(29);
  });

  it('adds SPACE pixels per space and trims the text', () => {
    const one = layoutSpriteText('  A A  ', { row: 0, start: 0 });
    expect(one.entries.map((e) => e.dx)).toEqual([16 + MENU_SPRITE_LAYOUT.SPACE, 0]);
    const two = layoutSpriteText('A  A', { row: 0, start: 0 });
    expect(two.entries.map((e) => e.dx)).toEqual([16 + 2 * MENU_SPRITE_LAYOUT.SPACE, 0]);
  });

  it('skips and reports characters without a glyph', () => {
    const res = layoutSpriteText('A1a', { row: 0, start: 0 });
    expect(res.invalid).toEqual(['1']);
    expect(res.error).toBeUndefined();
    expect(res.entries).toEqual(layoutSpriteText('AA', { row: 0, start: 0 }).entries);
  });

  it('lays out an empty text as no sprites', () => {
    expect(layoutSpriteText('', opts)).toEqual({
      entries: [],
      right: MENU_SPRITE_LAYOUT.START,
      invalid: [],
    });
    expect(layoutSpriteText(null, { row: 0, start: 3 }).right).toBe(3);
  });

  it('tightens by 1-2 pixels before reporting tooWide', () => {
    const at = (maxRight) => layoutSpriteText('AAAA', { row: 0, start: 0, maxRight });
    expect(at(63).entries.map((e) => e.dx)).toEqual([48, 32, 16, 0]);
    expect(at(62).entries.map((e) => e.dx)).toEqual([45, 30, 15, 0]);
    expect(at(62).right).toBe(60);
    expect(at(57).right).toBe(57);
    expect(at(57).error).toBeUndefined();
    expect(at(56).error).toBe('tooWide');
    expect(at(56).right).toBe(57);
  });

  it('reports tooManySprites past the PPU limits of a scanline', () => {
    const wide = { row: 0, start: 0, maxRight: 10000 };
    // 16x16 letters: 2 slivers per band (33 max)
    expect(layoutSpriteText('A'.repeat(16), wide).error).toBeUndefined();
    expect(layoutSpriteText('A'.repeat(17), wide).error).toBe('tooManySprites');
    // I: one 8x8 sprite per band (31 max)
    expect(layoutSpriteText('I'.repeat(31), wide).error).toBeUndefined();
    expect(layoutSpriteText('I'.repeat(32), wide).error).toBe('tooManySprites');
  });

  it('uses the given font (drawn letters at their slot)', () => {
    const font = menuSpriteFont({ H: 'W' });
    expect(layoutSpriteText('H', { row: 0, start: 0 }, font).entries).toEqual([big(0, 0, 0x124)]);
    // a letter missing from the font is skipped
    expect(layoutSpriteText('WA', { row: 0, start: 0 }, font).entries).toEqual([big(0, 0, 0x100)]);
  });
});

describe('spriteLineUsage', () => {
  it('counts sprites and 8-pixel slivers on the worst band', () => {
    expect(spriteLineUsage([], 0)).toEqual({ sprites: 0, slivers: 0 });
    const entries = [big(0, 4, 1), small(0, 4, 2), small(8, 4, 3), small(0, 12, 4)];
    // band 0: big + 2 small = 3 sprites, 4 slivers; band 8: big + small = 2 sprites, 3 slivers
    expect(spriteLineUsage(entries, 4)).toEqual({ sprites: 3, slivers: 4 });
  });

  it('counts a 16x16 sprite on every band it covers', () => {
    expect(spriteLineUsage([big(0, 8, 1)], 0)).toEqual({ sprites: 1, slivers: 2 });
    expect(spriteLineUsage([big(0, -8, 1)], 0)).toEqual({ sprites: 1, slivers: 2 });
    expect(spriteLineUsage([big(0, 16, 1)], 0)).toEqual({ sprites: 0, slivers: 0 });
  });

  it('matches the layout of a text', () => {
    const { entries } = layoutSpriteText('TIA', { row: -19 });
    // band 0: T bar (2) + I + A; band 8: T stem + I + A
    expect(spriteLineUsage(entries, -19)).toEqual({ sprites: 4, slivers: 5 });
  });
});

describe('sprite list bytes', () => {
  it('encodes count + [dy, dx, tile, attr] with palette 6', () => {
    expect(encodeSpriteEntries([])).toEqual([0]);
    expect(
      encodeSpriteEntries([big(-95, -91, 0x100), small(0x10, 0x7f, 0x12e), small(-1, 0, 0x2e)]),
    ).toEqual([3, 0xa5, 0xa1, 0x00, 0x1d, 0x7f, 0x10, 0x2e, 0x0d, 0x00, 0xff, 0x2e, 0x0c]);
  });

  it('reads back what it encodes (signed dx / dy, tile bit 8, size)', () => {
    const entries = layoutSpriteText('INTERNATIONAL CUP', { row: -67 }).entries;
    const rom = new RomParser(new Uint8Array(1024));
    rom.writeBytes(0x20, encodeSpriteEntries(entries));
    expect(readSpriteEntries(rom, 0x20)).toEqual(entries);
    expect(readSpriteEntries(rom, 0x10)).toEqual([]);
  });
});

describe('decodeSpriteEntries', () => {
  it('decodes every original letter laid out alone', () => {
    for (const ch of Object.keys(MENU_SPRITE_FONT))
      expect(decodeSpriteEntries(layoutSpriteText(ch, { row: -43 }).entries), ch).toBe(ch);
  });

  it('decodes the English items laid out by the editor', () => {
    ENGLISH_ITEMS.forEach((text, i) => {
      const { entries } = layoutSpriteText(text, { row: -91 + i * 24 });
      expect(decodeSpriteEntries(entries)).toBe(text);
    });
  });

  it('decodes drawn letters with the font they were laid out with', () => {
    const font = menuSpriteFont({ H: 'K', V: 'W', Q: 'D', X: 'P', Z: 'M' });
    const text = 'ZONA QUIZ VEXA HUGO';
    expect(decodeSpriteEntries(layoutSpriteText(text, { row: 0 }, font).entries, font)).toBe(text);
    // with the original font the slot tiles read as the original letters
    expect(decodeSpriteEntries(layoutSpriteText('HA', { row: 0 }, font).entries)).toBe('KA');
  });

  it('turns gaps of 4+ pixels into one space, whatever the entry order', () => {
    expect(decodeSpriteEntries([])).toBe('');
    // A ink 0-15: next A at 19 leaves a 3-pixel gap, at 20 a 4-pixel gap
    expect(decodeSpriteEntries([big(19, 0, 0x100), big(0, 0, 0x100)])).toBe('AA');
    expect(decodeSpriteEntries([big(20, 0, 0x100), big(0, 0, 0x100)])).toBe('A A');
    expect(decodeSpriteEntries([big(0, 0, 0x100), big(60, 0, 0x100)])).toBe('A A');
  });

  it('turns unknown pieces into "?"', () => {
    expect(decodeSpriteEntries([small(0, 0, 0x1ff)])).toBe('?');
    expect(decodeSpriteEntries([big(0, 0, 0x100), small(16, 0, 0x1ff), big(24, 0, 0x100)])).toBe(
      'A?A',
    );
    // a 16x16 tile used as 8x8 is not the letter
    expect(decodeSpriteEntries([small(0, 0, 0x100)])).toBe('?');
  });
});

describe('glyphTileBytes', () => {
  const blank = () => Array.from({ length: 16 }, () => '.'.repeat(16));
  const put = (rows, x, y, ch) => {
    rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
    return rows;
  };

  it('makes 4 blank 32-byte tiles from a transparent glyph', () => {
    const tiles = glyphTileBytes(blank());
    expect(tiles).toHaveLength(4);
    for (const t of tiles) expect(Array.from(t)).toEqual(new Array(32).fill(0));
  });

  it('writes the 4 bitplanes (SNES 4bpp) of each pixel', () => {
    const [tl] = glyphTileBytes(put(blank(), 0, 0, 'f'));
    const expected = new Array(32).fill(0);
    for (const k of [0, 1, 16, 17]) expected[k] = 0x80;
    expect(Array.from(tl)).toEqual(expected);
    const one = glyphTileBytes(put(blank(), 3, 5, '5'))[0]; // planes 0 and 2
    expect([one[10], one[11], one[26], one[27]]).toEqual([0x10, 0, 0x10, 0]);
  });

  it('orders the tiles top-left, top-right, bottom-left, bottom-right', () => {
    const tiles = glyphTileBytes(put(blank(), 9, 10, '2'));
    expect(tiles.slice(0, 3).every((t) => t.every((b) => b === 0))).toBe(true);
    // x = 1, y = 2 of the bottom-right tile, plane 1
    expect(Array.from(tiles[3]).findIndex((b) => b)).toBe(5);
    expect(tiles[3][5]).toBe(0x40);
  });

  it('draws every pixel of the drawn letters', () => {
    for (const [ch, { pixels }] of Object.entries(MENU_SPRITE_DRAWN)) {
      const tiles = glyphTileBytes(pixels);
      const inked = pixels.join('').replace(/\./g, '').length;
      let count = 0;
      for (let q = 0; q < 4; q++)
        for (let y = 0; y < 8; y++) {
          const t = tiles[q];
          const any = t[y * 2] | t[y * 2 + 1] | t[16 + y * 2] | t[17 + y * 2];
          for (let x = 0; x < 8; x++) if (any & (0x80 >> x)) count++;
        }
      expect(count, ch).toBe(inked);
    }
  });
});

describe('sameMenuFont', () => {
  it('compares font states regardless of key order', () => {
    expect(sameMenuFont({}, {})).toBe(true);
    expect(sameMenuFont({ H: 'K', V: 'W' }, { V: 'W', H: 'K' })).toBe(true);
    expect(sameMenuFont({ H: 'K' }, { H: 'W' })).toBe(false);
    expect(sameMenuFont({ H: 'K' }, {})).toBe(false);
    expect(sameMenuFont({ H: 'K' }, { V: 'K' })).toBe(false);
  });
});

describe.skipIf(!existsSync(REAL_ROM))('menu sprites (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const pack = SCREEN_TEXT_PACKS.mainMenu;
  const itemAddress = (rom, i) => pack.bank + word(rom, pack.table + i * 2) - 0x8000;
  const blockAt = (rom) =>
    (rom.readByte(MENU_FONT_BLOCK.pointer + 2) & 0x7f) * 0x8000 +
    word(rom, MENU_FONT_BLOCK.pointer) -
    0x8000;
  const changedTiles = (a, b) => {
    const out = [];
    for (let t = 0; t < a.length / 32; t++)
      if (a.slice(t * 32, t * 32 + 32).some((v, k) => b[t * 32 + k] !== v))
        out.push(MENU_FONT_BLOCK.firstTile + t);
    return out;
  };

  it('reads the original main menu items', () => {
    const rom = load();
    const texts = [];
    let sprites = 0;
    ENGLISH_ITEMS.forEach((_, i) => {
      const addr = itemAddress(rom, i);
      expect(addr).toBeGreaterThanOrEqual(pack.area[0]);
      expect(addr).toBeLessThan(pack.area[1]);
      const entries = readSpriteEntries(rom, addr);
      sprites += entries.length;
      expect(Math.min(...entries.map((e) => e.dy)), ENGLISH_ITEMS[i]).toBe(-91 + i * 24);
      // the original lists are re-encoded byte for byte
      expect(encodeSpriteEntries(entries)).toEqual(
        Array.from(rom.readBytes(addr, 1 + entries.length * 4)),
      );
      texts.push(decodeSpriteEntries(entries));
    });
    expect(texts).toEqual(ENGLISH_ITEMS);
    expect(sprites).toBe(122);
  });

  it('keeps the original items inside the PPU limits', () => {
    const rom = load();
    ENGLISH_ITEMS.forEach((text, i) => {
      const u = spriteLineUsage(readSpriteEntries(rom, itemAddress(rom, i)), -91 + i * 24);
      expect(u.sprites, text).toBeLessThanOrEqual(MENU_SPRITE_LAYOUT.MAX_SPRITES);
      expect(u.slivers, text).toBeLessThanOrEqual(MENU_SPRITE_LAYOUT.MAX_SLIVERS);
    });
  });

  it('reads the 56 font tiles from the block the load list points to', () => {
    const rom = load();
    expect(blockAt(rom)).toBe(MENU_FONT_BLOCK.offset);
    const tiles = readMenuFontTiles(rom);
    expect(tiles.length).toBe(56 * 32);
    // every 16x16 slot letter has ink
    for (const slot of MENU_FONT_SLOTS)
      for (const t of slotTiles(slot)) {
        const at = (t - MENU_FONT_BLOCK.firstTile) * 32;
        expect(
          tiles.slice(at, at + 32).some((b) => b),
          `${slot} ${t.toString(16)}`,
        ).toBe(true);
      }
  });

  it('finds no drawn letter in the original font', () => {
    expect(installedMenuGlyphs(load())).toEqual({});
  });

  it('writes the drawn letters over their slots only and reads them back', () => {
    const rom = load();
    const orig = rom.getOriginalData();
    const origTiles = readMenuFontTiles(rom);
    const installed = { H: 'K', V: 'W', Q: 'D', X: 'P', Z: 'M' };
    const res = writeMenuFont(rom, installed);
    expect(res.ok).toBe(true);
    expect(res.capacity).toBe(MENU_FONT_BLOCK.capacity);
    expect(res.size).toBeLessThanOrEqual(MENU_FONT_BLOCK.capacity);
    expect(sameMenuFont(installedMenuGlyphs(rom), installed)).toBe(true);
    expect(installedMenuGlyphs(rom)).toEqual(installed);
    // only the 20 tiles of the 5 slots change
    expect(changedTiles(origTiles, readMenuFontTiles(rom))).toEqual(
      ['K', 'W', 'D', 'P', 'M'].flatMap(slotTiles).sort((a, b) => a - b),
    );
    // and only bytes of the font block area
    const now = rom.getRomData();
    const start = MENU_FONT_BLOCK.offset + rom.headerOffset;
    const end = start + MENU_FONT_BLOCK.capacity;
    let outside = 0;
    for (let i = 0; i < now.length; i++)
      if ((i < start || i >= end) && now[i] !== orig[i]) outside++;
    expect(outside).toBe(0);
    // the pointer still points to the block
    expect(blockAt(rom)).toBe(MENU_FONT_BLOCK.offset);
  });

  it('moves a drawn letter to another slot and gives the old slot its letter back', () => {
    const rom = load();
    const origTiles = readMenuFontTiles(rom);
    expect(writeMenuFont(rom, { H: 'K' }).ok).toBe(true);
    expect(changedTiles(origTiles, readMenuFontTiles(rom))).toEqual(slotTiles('K'));
    expect(writeMenuFont(rom, { H: 'W' }).ok).toBe(true);
    expect(installedMenuGlyphs(rom)).toEqual({ H: 'W' });
    expect(changedTiles(origTiles, readMenuFontTiles(rom))).toEqual(slotTiles('W'));
    expect(writeMenuFont(rom, {}).ok).toBe(true);
    expect(installedMenuGlyphs(rom)).toEqual({});
    expect(Array.from(readMenuFontTiles(rom))).toEqual(Array.from(origTiles));
  });

  it('writes nothing when the font does not compress into the block', () => {
    const rom = load();
    // replace the block with noise that cannot be compressed (deterministic LCG)
    let seed = 12345;
    const noise = new Uint8Array(56 * 32).map(() => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed >>> 24;
    });
    rom.writeBytes(MENU_FONT_BLOCK.offset, konamiCompress(noise));
    expect(Array.from(readMenuFontTiles(rom))).toEqual(Array.from(noise));
    const before = Array.from(rom.getRomData());
    const res = writeMenuFont(rom, { H: 'K' });
    expect(res.ok).toBe(false);
    expect(res.size).toBeGreaterThan(MENU_FONT_BLOCK.capacity);
    expect(res.capacity).toBe(MENU_FONT_BLOCK.capacity);
    expect(Array.from(rom.getRomData())).toEqual(before);
  });
});
