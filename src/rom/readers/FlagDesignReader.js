/**
 * Flag design reader — compressed tile data
 */
import { FLAG_DESIGN_ORDINALS } from '../constants';
import { konamiDecompress, decodeSnes4bppTiles } from '../KonamiCodec';

const FLAG_POINTER_OFFSET = 0x941a;
const FLAG_POINTER_STEP = 4;

export function readFlagDesign(rom, teamIndex) {
  try {
    const ordinal = FLAG_DESIGN_ORDINALS[teamIndex];
    const ptrOffset = FLAG_POINTER_OFFSET + ordinal * FLAG_POINTER_STEP;
    const topAddr = readFlagPointer(rom, ptrOffset);
    const bottomAddr = readFlagPointer(rom, ptrOffset + 2);

    const topData = konamiDecompress(rom.getRawData(), rom.offset(topAddr), 1);
    const bottomData = konamiDecompress(rom.getRawData(), rom.offset(bottomAddr), 1);

    const topGrid = decodeSnes4bppTiles(topData);
    const bottomGrid = decodeSnes4bppTiles(bottomData);
    const grid = [...topGrid, ...bottomGrid];

    const INDEX_MAP = { 0: 0, 12: 1, 13: 2, 14: 3, 15: 4 };
    const mappedGrid = grid.map((row) =>
      row.map((pixel) => (INDEX_MAP[pixel] !== undefined ? INDEX_MAP[pixel] : 0)),
    );

    return { grid: mappedGrid, topAddr, bottomAddr };
  } catch (e) {
    console.warn('Failed to read flag design for team', teamIndex, e);
    return {
      grid: Array.from({ length: 16 }, () => new Array(24).fill(0)),
      topAddr: 0,
      bottomAddr: 0,
    };
  }
}

export function readFlagPointer(rom, pointerOffset) {
  const b1 = rom.readByte(pointerOffset);
  const b2 = rom.readByte(pointerOffset + 1);
  return 0x40000 + ((b2 << 8) | b1);
}
