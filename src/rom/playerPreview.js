/**
 * Previews of a team's players as the game draws them: a real animation frame
 * (see titlePlayers.js) coloured with the team's kit, hair and skin.
 *
 * Player OBJ palette (16 colours, the game's CGRAM rows 8-11):
 *   0 transparent, 1 hair, 2-6 skin, 7-9 shirt, 10-12 shorts, 13-14 socks, 15 shadow.
 * Goalkeeper palette (rows 12-13):
 *   0 transparent, 1 hair, 2-4 skin, 5-9 shirt and socks, 10 shorts, 11 shadow,
 *   12-15 the flag colours (the crest on the shirts; see teamPalettes).
 * The colours come from the editor's team state, so the preview follows every edit
 * (the ROM only supplies the drawings). See research/title-screen.md.
 */
import { FLAG_DESIGN_ORDINALS } from './constants';
import { playerSprites } from './titlePlayers';
import { OBJ_BASE, createImage, drawSprites, fillImage, colorToRaw } from './snesRender';

/** Frames (bank $82 records) used by the previews */
export const PREVIEW_POSES = {
  front: 0xc203, // standing, facing the camera
  back: 0xc22a, // standing, from behind
  keeperFront: 0xe41a,
  keeperBack: 0xe3ea,
};

/** Shadow under the players (the same dark green in every team's palette) */
export const SHADOW_COLOR = 0x0120;
/** Grass behind the previews */
export const PREVIEW_GRASS = 11 | (19 << 5) | (8 << 10);
/** Title screen fill of keeper palette entries 12-15 (when the team has no flag colours) */
const KEEPER_FILL = 0x739c;

const raws = (colors, count) => Array.from({ length: count }, (_, i) => colorToRaw(colors?.[i]));

/** 16-colour outfield palette from a kit ({ shirt, shorts, socks }) and hair/skin ({ hair, skin }) */
export function outfieldPalette(kit, hairSkin) {
  return Uint16Array.from([
    0,
    ...raws(hairSkin?.hair, 1),
    ...raws(hairSkin?.skin, 5),
    ...raws(kit?.shirt, 3),
    ...raws(kit?.shorts, 3),
    ...raws(kit?.socks, 2),
    SHADOW_COLOR,
  ]);
}

/**
 * 16-colour goalkeeper palette from the keeper kit ({ shirtAndSocks, shorts }), hair/skin
 * and the 4 crest colours (entries 12-15; the title screen fill when unknown)
 */
export function keeperPalette(kit, hairSkin, crest = null) {
  return Uint16Array.from([
    0,
    ...raws(hairSkin?.hair, 1),
    ...raws(hairSkin?.skin, 3),
    ...raws(kit?.shirtAndSocks, 5),
    ...raws(kit?.shorts, 1),
    SHADOW_COLOR,
    ...(crest && crest.length === 4 ? crest : Array(4).fill(KEEPER_FILL)),
  ]);
}

/**
 * Palettes of a team for one kit.
 *
 * The crest on the chest (the per-team detail tile of the front frames: Germany's
 * eagle, Brazil's badge...) is drawn with entries 12-15 of the goalkeeper rows, which
 * in a match hold the team's 4 **flag colours** (CGRAM of match dumps = the flag
 * colour entries at 0x2DD91, pointer table 0x9486). The title screen fills them with
 * 0x739C instead.
 * @param {object} team - editor team ({ uniforms, hairSkin, flagColors })
 * @param {'home'|'away'|'goalkeeper'} kit
 * @returns {{ palette: Uint16Array, keeper: Uint16Array, isKeeper: boolean }}
 */
export function teamPalettes(team, kit) {
  const u = team?.uniforms || {};
  const hs = team?.hairSkin || {};
  const crest = team?.flagColors?.length === 4 ? team.flagColors.map(colorToRaw) : null;
  const keeper = keeperPalette(u.goalkeeper, hs.goalkeeper, crest);
  if (kit === 'goalkeeper') return { palette: keeper, keeper, isKeeper: true };
  const outfield =
    kit === 'away' ? outfieldPalette(u.away, hs.second) : outfieldPalette(u.home, hs.first);
  return { palette: outfield, keeper, isKeeper: false };
}

/**
 * Draw one animation frame.
 * @param {object} rom - RomParser
 * @param {object} options
 * @param {number} options.pose - frame record (PREVIEW_POSES or any listPoseFrames entry)
 * @param {Uint16Array} options.palette - 16 colours for the frame (OBJ palette 0)
 * @param {Uint16Array} [options.extraPalette] - palette of the pieces that add 4 (per-team details)
 * @param {number} [options.teamIndex] - picks the per-team detail tile
 * @param {[number, number]} [options.cell] - image size; the feet go at the bottom centre
 * @param {number|null} [options.background] - raw colour, null = transparent
 * @returns {{ width: number, height: number, data: Uint8ClampedArray } | null}
 */
export function renderPlayer(
  rom,
  { pose, palette, extraPalette = palette, teamIndex = 0, cell = [40, 64], background = null },
) {
  const [w, h] = cell;
  const ordinal = FLAG_DESIGN_ORDINALS[teamIndex] ?? 0;
  const p = playerSprites(rom, 'left', pose, [w / 2, h - 6], ordinal);
  if (!p) return null;
  const vram = new Uint8Array(0x10000);
  p.tiles.forEach(([tile, bytes]) => vram.set(bytes, (OBJ_BASE + tile * 32) & 0xffff));
  const cg = new Uint16Array(256);
  cg.set(palette.subarray(0, 16), 128);
  cg.set(extraPalette.subarray(0, 16), 192);
  const img = createImage(w, h);
  if (background !== null) fillImage(img, background);
  drawSprites(img, cg, vram, p.sprites);
  return { width: w, height: h, data: img.data };
}

/**
 * Front and back of a team's player (or goalkeeper) in one kit.
 * @returns {{ front, back }} images from renderPlayer
 */
export function renderTeamKit(rom, team, teamIndex, kit, { background = PREVIEW_GRASS } = {}) {
  const { palette, keeper, isKeeper } = teamPalettes(team, kit);
  const draw = (pose) =>
    renderPlayer(rom, { pose, palette, extraPalette: keeper, teamIndex, background });
  return isKeeper
    ? { front: draw(PREVIEW_POSES.keeperFront), back: draw(PREVIEW_POSES.keeperBack) }
    : { front: draw(PREVIEW_POSES.front), back: draw(PREVIEW_POSES.back) };
}
