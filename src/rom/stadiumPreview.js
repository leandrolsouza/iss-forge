/**
 * Stadium and crowd previews: scenes of the match (main stand, goal and
 * photographers) drawn with the real match characters and the edited palettes.
 *
 * Match screen (mode 1): BG2 = pitch and stands, BG1 = front rows of the crowd,
 * goal net and photographers; 4bpp chars at VRAM word $2000 for both. The chars
 * come from the load list 0x1006C (buildPitchVram) plus the raw chars each scene
 * lists; the tilemaps are captured from the game (matchScenes.js), because the
 * game builds them while the camera scrolls.
 *
 * BG palette rows of the match (see research/match-palettes.md):
 *   1 photographers (stadium_people), 2-3 grass, 4 wall and goal net (stadium_wall),
 *   5-6 crowd of the home team (30 colours), 7 pitch details.
 */
import { buildPitchVram } from './pitchPreview';
import { createImage, fillImage, setPixel, tilePixel } from './snesRender';
import { GOAL_SCENE, MATCH_BACKDROP, STAND_SCENE } from './matchScenes';

export { GOAL_SCENE, STAND_SCENE };

const CHARS = 0x2000 * 2;

const parsed = new WeakMap();

/** Map words of a scene layer: rows of "word" / "word*n" tokens, missing rows = 0 */
export function parseSceneRows(rows, width, height) {
  const out = new Uint16Array(width * height);
  rows.slice(0, height).forEach((row, y) => {
    let x = 0;
    row
      .split(/\s+/)
      .filter(Boolean)
      .forEach((token) => {
        const [w, n = '1'] = token.split('*');
        const value = parseInt(w, 16);
        for (let k = 0; k < Number(n) && x < width; k++) out[y * width + x++] = value;
      });
  });
  return out;
}

function layersOf(scene) {
  if (!parsed.has(scene)) {
    const { width, height } = scene;
    parsed.set(scene, [
      parseSceneRows(scene.back, width, height),
      parseSceneRows(scene.front, width, height),
    ]);
  }
  return parsed.get(scene);
}

/** VRAM of a scene: the match chars plus the raw chars the scene uses */
export function buildSceneVram(rom, scene) {
  const vram = Uint8Array.from(buildPitchVram(rom));
  scene.rawTiles.forEach(([tile, file, count]) => {
    vram.set(rom.readBytes(file, count * 32), (CHARS + tile * 32) & 0xffff);
  });
  return vram;
}

/**
 * BG palettes 0-7 of the match from the editor colours (each list = colours 1-15 of
 * its rows; colour 0 of every row is transparent).
 * @param {{ people?: number[], grass?: number[], wall?: number[], crowd?: number[],
 *   detail?: number[] }} colors - raw BGR555 lists (MATCH_PALETTES ids / a crowd palette)
 */
export function matchSceneCgram({ people, grass, wall, crowd, detail } = {}) {
  const cg = new Uint16Array(128);
  const put = (colors, row, rows = 1) =>
    (colors || []).slice(0, rows * 15).forEach((c, i) => {
      cg[(row + Math.floor(i / 15)) * 16 + 1 + (i % 15)] = c;
    });
  put(people, 1);
  put(grass, 2, 2);
  put(wall, 4);
  put(crowd, 5, 2);
  put(detail, 7);
  return cg;
}

/**
 * Draw a match scene.
 * @param {object} rom - RomParser
 * @param {object} scene - STAND_SCENE / GOAL_SCENE
 * @param {object} colors - see matchSceneCgram
 * @param {{ backdrop?: number, highlight?: number[] }} [options] - `highlight`: BG rows
 *   to keep in colour; every other pixel is dimmed (to show what a palette paints)
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function renderMatchScene(
  rom,
  scene,
  colors,
  { backdrop = MATCH_BACKDROP, highlight } = {},
) {
  const vram = buildSceneVram(rom, scene);
  const cg = matchSceneCgram(colors);
  const { width, height } = scene;
  const img = createImage(width * 8, height * 8);
  const keep = highlight ? new Set(highlight) : null;
  // the backdrop belongs to no palette row: dimmed whenever something is highlighted
  fillImage(img, keep ? dimColor(backdrop) : backdrop);
  const layers = layersOf(scene);
  // mode 1, back to front: BG2 low, BG1 low, BG2 high, BG1 high
  for (const priority of [0, 1])
    for (const cells of layers)
      for (let cy = 0; cy < height; cy++)
        for (let cx = 0; cx < width; cx++) {
          const e = cells[cy * width + cx];
          if (((e >> 13) & 1) !== priority) continue;
          const pal = (e >> 10) & 7;
          const base = (CHARS + (e & 0x3ff) * 32) & 0xffff;
          const hf = e & 0x4000;
          const vf = e & 0x8000;
          for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++) {
              const c = tilePixel(vram, base, 4, hf ? 7 - x : x, vf ? 7 - y : y);
              if (!c) continue;
              const raw = cg[pal * 16 + c];
              setPixel(img, cx * 8 + x, cy * 8 + y, keep && !keep.has(pal) ? dimColor(raw) : raw);
            }
        }
  return img;
}

/** A raw colour at a quarter of its brightness */
function dimColor(raw) {
  const ch = (v) => Math.round(v * 0.25);
  return ch(raw & 31) | (ch((raw >> 5) & 31) << 5) | (ch((raw >> 10) & 31) << 10);
}

/**
 * The colours of a match for the scenes, from the editor state.
 * @param {object} matchPalettes - readMatchPalettes() state
 * @param {number} [teamIndex] - home team (picks the crowd palette)
 */
export function matchSceneColors(matchPalettes, teamIndex = 0) {
  const crowd = matchPalettes.crowds?.[matchPalettes.crowdMap?.[teamIndex]];
  return {
    people: matchPalettes.stadium_people,
    grass: matchPalettes.grassB_sunny,
    wall: matchPalettes.stadium_wall,
    crowd,
    detail: matchPalettes.detail_shared,
  };
}
