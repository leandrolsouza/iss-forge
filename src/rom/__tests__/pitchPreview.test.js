import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import RomParser from '../RomParser';
import { buildPitchVram, renderPitch, GRASS_PATTERN } from '../pitchPreview';

const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);

describe.skipIf(!existsSync(REAL_ROM))('pitch preview (real ROM)', () => {
  const load = () => new RomParser(new Uint8Array(readFileSync(REAL_ROM)));
  const colours = (img) => {
    const s = new Set();
    for (let i = 0; i < img.data.length; i += 4)
      s.add((img.data[i] >> 3) | ((img.data[i + 1] >> 3) << 5) | ((img.data[i + 2] >> 3) << 10));
    return s;
  };

  it('loads the grass tiles of the match (load list 0x1006C)', () => {
    const vram = buildPitchVram(load());
    const tiles = new Set(GRASS_PATTERN.flat().map((c) => c & 0xff));
    for (const t of tiles) {
      const bytes = vram.slice(0x4000 + t * 32, 0x4000 + t * 32 + 32);
      expect(bytes.some(Boolean)).toBe(true);
    }
  });

  it('draws the grass with the given palettes, edits included', () => {
    const rom = load();
    const grass = [...rom.readMatchPalettes().grassB_sunny];
    const img = renderPitch(rom, grass, { width: 64, height: 64, lines: false });
    const used = colours(img);
    expect([...used].every((c) => grass.includes(c))).toBe(true);
    expect(used.size).toBeGreaterThan(6);
    // change the most used colour of row 2: it shows up
    grass[0] = 31; // pure red
    expect(colours(renderPitch(rom, grass, { width: 64, height: 64, lines: false })).has(31)).toBe(
      true,
    );
  });
});
