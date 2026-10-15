import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { TEAMS, FLAG_DESIGN_ORDINALS } from '../constants';
import { colorToRaw, renderIndexed, createImage, drawSprites, OBJ_BASE } from '../snesRender';
import {
  outfieldPalette,
  keeperPalette,
  teamPalettes,
  renderTeamKit,
  renderReferee,
  refereePalette,
  SHADOW_COLOR,
} from '../playerPreview';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const idx = (id) => TEAMS.findIndex((t) => t.id === id);
const c5 = (r5, g5, b5) => ({ r: r5 * 8, g: g5 * 8, b: b5 * 8, r5, g5, b5 });
const rawOf = (r, g, b) => r | (g << 5) | (b << 10);

describe('snesRender', () => {
  it('colorToRaw prefers the 5-bit channels, then raw, then rounds the 8-bit ones', () => {
    expect(colorToRaw(c5(31, 0, 1))).toBe(rawOf(31, 0, 1));
    expect(colorToRaw({ raw: 0x1234 })).toBe(0x1234);
    expect(colorToRaw({ r: 255, g: 8, b: 0 })).toBe(rawOf(31, 1, 0));
    expect(colorToRaw(null)).toBe(0);
  });

  it('renderIndexed draws index 0 transparent', () => {
    const img = renderIndexed(
      [
        [0, 1],
        [2, 0],
      ],
      [0, rawOf(31, 0, 0), rawOf(0, 31, 0)],
    );
    expect([img.width, img.height]).toEqual([2, 2]);
    expect(Array.from(img.data.slice(0, 8))).toEqual([0, 0, 0, 0, 248, 0, 0, 255]);
    expect(Array.from(img.data.slice(8, 12))).toEqual([0, 248, 0, 255]);
  });

  it('drawSprites skips colour 0 and the colours asked to', () => {
    const vram = new Uint8Array(0x10000);
    vram[OBJ_BASE] = 0xff; // tile 0, row 0, plane 0: colour 1 on the whole row
    const cg = new Uint16Array(256);
    cg[129] = rawOf(31, 31, 31);
    const img = createImage(8, 8);
    drawSprites(img, cg, vram, [[0, 0, 0, 0, 0, 0, 0]]);
    expect(img.data[3]).toBe(255);
    const skipped = createImage(8, 8);
    drawSprites(skipped, cg, vram, [[0, 0, 0, 0, 0, 0, 0]], { skip: new Set([1]) });
    expect(skipped.data[3]).toBe(0);
  });
});

describe('player palettes', () => {
  const team = {
    uniforms: {
      home: {
        shirt: [c5(1, 0, 0), c5(2, 0, 0), c5(3, 0, 0)],
        shorts: [c5(4, 0, 0), c5(5, 0, 0), c5(6, 0, 0)],
        socks: [c5(7, 0, 0), c5(8, 0, 0)],
      },
      away: { shirt: [c5(0, 1, 0), c5(0, 2, 0), c5(0, 3, 0)], shorts: [], socks: [] },
      goalkeeper: { shirtAndSocks: [1, 2, 3, 4, 5].map((v) => c5(0, 0, v)), shorts: [c5(0, 0, 9)] },
    },
    hairSkin: {
      first: { hair: [c5(10, 0, 0)], skin: [11, 12, 13, 14, 15].map((v) => c5(v, 0, 0)) },
      second: { hair: [c5(0, 10, 0)], skin: [] },
      goalkeeper: { hair: [c5(0, 0, 10)], skin: [c5(0, 0, 11), c5(0, 0, 12), c5(0, 0, 13)] },
    },
  };

  it('lays out the outfield palette like the game (hair, skin, shirt, shorts, socks, shadow)', () => {
    const p = outfieldPalette(team.uniforms.home, team.hairSkin.first);
    expect(p).toHaveLength(16);
    expect(p[0]).toBe(0);
    expect(p[1]).toBe(rawOf(10, 0, 0));
    expect(Array.from(p.slice(2, 7))).toEqual([11, 12, 13, 14, 15]);
    expect(Array.from(p.slice(7, 15))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(p[15]).toBe(SHADOW_COLOR);
  });

  it('lays out the goalkeeper palette, crest colours in 12-15', () => {
    const p = keeperPalette(team.uniforms.goalkeeper, team.hairSkin.goalkeeper, [1, 2, 3, 4]);
    expect(p[1]).toBe(rawOf(0, 0, 10));
    expect(p[5]).toBe(rawOf(0, 0, 1));
    expect(p[10]).toBe(rawOf(0, 0, 9));
    expect(p[11]).toBe(SHADOW_COLOR);
    expect(Array.from(p.slice(12))).toEqual([1, 2, 3, 4]);
  });

  it('the away kit uses the second hair/skin block', () => {
    const { palette, isKeeper } = teamPalettes(team, 'away');
    expect(isKeeper).toBe(false);
    expect(palette[1]).toBe(rawOf(0, 10, 0));
    expect(palette[7]).toBe(rawOf(0, 1, 0));
    expect(teamPalettes(team, 'goalkeeper').isKeeper).toBe(true);
  });

  it('paints the crest (keeper entries 12-15) with the flag colours', () => {
    const flagColors = [c5(1, 1, 1), c5(2, 2, 2), c5(3, 3, 3), c5(4, 4, 4)];
    const { keeper } = teamPalettes({ ...team, flagColors }, 'home');
    expect(Array.from(keeper.slice(12))).toEqual(flagColors.map(colorToRaw));
    expect(teamPalettes(team, 'home').keeper[12]).toBe(0x739c); // no flag colours: title fill
  });
});

describe.skipIf(!existsSync(REAL_ROM))('player previews (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));

  it('the crest colours of a match are the flag colours (pointer table 0x9486)', () => {
    const rom = load();
    const word = (a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
    // Germany (eagle) and Wales (dragon) crest colours seen in the CGRAM of match dumps
    const seen = {
      GERMANY: [0x1021, 0x001e, 0x0421, 0x02df],
      WALES: [rawOf(4, 18, 4), rawOf(16, 0, 0), rawOf(29, 0, 0), rawOf(31, 31, 31)],
    };
    for (const [id, colors] of Object.entries(seen)) {
      const team = rom.readTeam(idx(id));
      expect(team.flagColors.map(colorToRaw)).toEqual(colors);
      // bank $85 pointer per ROM ordinal -> [0x0007, 4 colours]
      const ptr = word(0x9486 + FLAG_DESIGN_ORDINALS[idx(id)] * 2);
      const at = 0x28000 + (ptr - 0x8000);
      expect(word(at)).toBe(0x0007);
      expect([0, 1, 2, 3].map((i) => word(at + 2 + i * 2))).toEqual(colors);
    }
  });

  it('draws front and back in every kit, with the kit colours', () => {
    const rom = load();
    const ger = idx('GERMANY');
    const team = rom.readTeam(ger);
    const has = (img, raw) => {
      const [r, g, b] = [(raw & 31) << 3, ((raw >> 5) & 31) << 3, ((raw >> 10) & 31) << 3];
      for (let i = 0; i < img.data.length; i += 4)
        if (img.data[i] === r && img.data[i + 1] === g && img.data[i + 2] === b) return true;
      return false;
    };
    for (const kit of ['home', 'away', 'goalkeeper']) {
      const { front, back } = renderTeamKit(rom, team, ger, kit, { background: null });
      expect(front && back).toBeTruthy();
      const part =
        kit === 'goalkeeper' ? team.uniforms.goalkeeper.shirtAndSocks : team.uniforms[kit].shirt;
      expect(has(front, colorToRaw(part[1]))).toBe(true);
    }
    // an edited shirt colour shows up without touching the ROM
    const edited = structuredClone(team);
    edited.uniforms.home.shirt[1] = c5(31, 0, 31);
    expect(has(renderTeamKit(rom, edited, ger, 'home').front, rawOf(31, 0, 31))).toBe(true);
  });

  it('draws the referee with the referee palette and no team crest', () => {
    const rom = load();
    const referee = [...rom.readMatchPalettes().referee];
    const raws = (img) => {
      const s = new Set();
      for (let i = 0; i < img.data.length; i += 4)
        if (img.data[i + 3])
          s.add(
            (img.data[i] >> 3) | ((img.data[i + 1] >> 3) << 5) | ((img.data[i + 2] >> 3) << 10),
          );
      return s;
    };
    const { front, back } = renderReferee(rom, referee, { background: null });
    for (const img of [front, back]) {
      const used = raws(img);
      expect(used.size).toBeGreaterThan(5);
      // every pixel comes from the referee palette (the crest would bring other colours)
      expect([...used].every((c) => referee.includes(c))).toBe(true);
    }
    // an edited shirt shade shows up
    referee[7] = rawOf(31, 31, 0);
    expect(
      raws(renderReferee(rom, referee, { background: null }).front).has(rawOf(31, 31, 0)),
    ).toBe(true);
  });
});

describe('referee palette', () => {
  it('puts the 15 referee colours after the transparent colour', () => {
    const p = refereePalette(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(Array.from(p)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(Array.from(refereePalette(null))).toEqual(Array(16).fill(0));
  });
});
