/**
 * Title screen objects: the ball (+ its shadow), the shadows of the two players
 * and the position of the players. Every value is the operand of an LDA #imm in
 * the set-up code ($80:8D24-$8DDA); an object is hidden by giving it handler 0
 * (the object loop skips it), shown again with its original handler.
 *
 * See TITLE_SCREEN.OBJECTS in constants.js and research/title-screen.md.
 */
import { TITLE_SCREEN } from './constants';

const O = TITLE_SCREEN.OBJECTS;
const word = (rom, a) => rom.readByte(a) | (rom.readByte(a + 1) << 8);
const s16 = (v) => (v & 0x8000 ? v - 0x10000 : v);
function writeWord(rom, a, v) {
  rom.writeByte(a, v & 0xff);
  rom.writeByte(a + 1, (v >> 8) & 0xff);
}

/** Limits of the editable values (screen pixels) */
export const OBJECT_LIMITS = {
  x: [0, 255],
  y: [0, 223],
  z: [-160, 0],
};

const visible = (rom, def) => def.handlers.every(([a]) => word(rom, a) !== 0);
const shadow = (rom, def) => ({
  visible: visible(rom, def),
  x: word(rom, def.x),
  y: word(rom, def.y),
});

/**
 * @returns {{ ball: { visible: boolean, x: number, y: number, z: number },
 *   shadowLeft: { visible: boolean, x: number, y: number },
 *   shadowRight: { visible: boolean, x: number, y: number },
 *   players: { leftX: number, rightX: number, y: number } }}
 *   ball y = the ground (where its shadow is), z = height (negative = up)
 */
export function readTitleObjects(rom) {
  return {
    ball: {
      visible: visible(rom, O.BALL),
      x: word(rom, O.BALL.x),
      y: word(rom, O.BALL.y),
      z: s16(word(rom, O.BALL.z)),
    },
    shadowLeft: shadow(rom, O.SHADOW_LEFT),
    shadowRight: shadow(rom, O.SHADOW_RIGHT),
    players: {
      leftX: word(rom, O.PLAYER_LEFT_X),
      rightX: word(rom, O.PLAYER_RIGHT_X),
      y: word(rom, O.PLAYERS_Y),
    },
  };
}

function checked(value, [min, max], name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Title screen ${name} must be ${min}-${max}`);
  }
  return value;
}

function setVisible(rom, def, on) {
  def.handlers.forEach(([a, handler]) => writeWord(rom, a, on ? handler : 0));
}

function writeShadow(rom, def, s) {
  if (s.x !== undefined) writeWord(rom, def.x, checked(s.x, OBJECT_LIMITS.x, 'x'));
  if (s.y !== undefined) writeWord(rom, def.y, checked(s.y, OBJECT_LIMITS.y, 'y'));
  if (s.visible !== undefined) setVisible(rom, def, s.visible);
}

/** Write any part of readTitleObjects' result (missing fields stay as they are) */
export function writeTitleObjects(rom, objects) {
  const { ball, shadowLeft, shadowRight, players } = objects || {};
  if (ball) {
    writeShadow(rom, O.BALL, ball);
    if (ball.z !== undefined)
      writeWord(rom, O.BALL.z, checked(ball.z, OBJECT_LIMITS.z, 'z') & 0xffff);
  }
  if (shadowLeft) writeShadow(rom, O.SHADOW_LEFT, shadowLeft);
  if (shadowRight) writeShadow(rom, O.SHADOW_RIGHT, shadowRight);
  if (players) {
    const { leftX, rightX, y } = players;
    if (leftX !== undefined) writeWord(rom, O.PLAYER_LEFT_X, checked(leftX, OBJECT_LIMITS.x, 'x'));
    if (rightX !== undefined)
      writeWord(rom, O.PLAYER_RIGHT_X, checked(rightX, OBJECT_LIMITS.x, 'x'));
    if (y !== undefined) writeWord(rom, O.PLAYERS_Y, checked(y, OBJECT_LIMITS.y, 'y'));
  }
}

// --- Sprites (as the game puts them in the OAM, checked in the emulator) ---

/** Shadows drawn under everything: the two player shadows and the ball shadow */
export function shadowSprites(objects) {
  const out = [];
  const { shadowLeft: l, shadowRight: r, ball: b } = objects;
  if (l.visible) out.push([l.x - 8, l.y, 0x187, 0, 0, 0, 0], [l.x, l.y, 0x188, 0, 0, 0, 0]);
  if (r.visible) out.push([r.x, r.y, 0x187, 0, 1, 1, 0], [r.x - 8, r.y, 0x188, 0, 1, 1, 0]);
  if (b.visible) out.push([b.x - 4, b.y - 3, 0x1b0, 0, 0, 0, 0]);
  return out;
}

/**
 * The ball shadow shrinks with the height: 3 tiles in the ROM (0xBED2B + 32 x
 * size), size = (height - 1) / 48 (0 = on the ground .. 48, 1 = up to 96, 2 above).
 * Measured in the emulator; the tile is loaded to OBJ 0x1B0.
 */
export const BALL_SHADOW_TILES = 0xbed2b;
export function ballShadowTile(z) {
  const h = Math.max(0, -z);
  return BALL_SHADOW_TILES + 32 * Math.min(2, Math.max(0, Math.floor((h - 1) / 48)));
}

/** The ball, drawn on top of everything */
export function ballSprites(objects) {
  const b = objects.ball;
  return b.visible ? [[b.x - 4, b.y + b.z - 7, 0x1a0, 0, 6, 0, 0]] : [];
}
