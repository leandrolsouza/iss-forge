/**
 * Ethnicity-based hair & skin color templates.
 * Values extracted from the original ISS (Europe) ROM via ISS Studio 1.6.
 *
 * Each color is stored as SNES 5-bit components (0-31).
 * To convert to 8-bit RGB: value * 8.
 *
 * Outfield (Normal players): 1 hair color + 5 skin colors
 * Goalkeeper: 1 hair color + 3 skin colors
 */

function c(r5, g5, b5) {
  return { r: r5 * 8, g: g5 * 8, b: b5 * 8, r5, g5, b5 };
}

export const HAIR_SKIN_TEMPLATES = [
  {
    id: 'european_light',
    baseTeam: 'Germany',
    outfield: {
      hair: [c(19, 12, 0)],
      skin: [c(13, 5, 3), c(19, 10, 6), c(23, 17, 12), c(25, 21, 17), c(28, 26, 24)],
    },
    goalkeeper: {
      hair: [c(15, 6, 0)],
      skin: [c(17, 14, 10), c(25, 21, 16), c(28, 27, 26)],
    },
  },
  {
    id: 'european_dark',
    baseTeam: 'Italy',
    outfield: {
      hair: [c(10, 3, 0)],
      skin: [c(13, 5, 3), c(23, 10, 7), c(25, 17, 14), c(26, 23, 21), c(28, 28, 27)],
    },
    goalkeeper: {
      hair: [c(15, 6, 0)],
      skin: [c(17, 14, 10), c(25, 21, 16), c(28, 27, 26)],
    },
  },
  {
    id: 'nordic',
    baseTeam: 'Sweden',
    outfield: {
      hair: [c(16, 12, 0)],
      skin: [c(13, 5, 3), c(23, 11, 8), c(25, 17, 14), c(26, 23, 21), c(28, 28, 27)],
    },
    goalkeeper: {
      hair: [c(15, 6, 0)],
      skin: [c(17, 11, 7), c(25, 17, 13), c(31, 24, 19)],
    },
  },
  {
    id: 'latino',
    baseTeam: 'Brazil',
    outfield: {
      hair: [c(7, 4, 0)],
      skin: [c(11, 5, 2), c(14, 7, 3), c(21, 11, 8), c(24, 17, 11), c(28, 26, 22)],
    },
    goalkeeper: {
      hair: [c(11, 2, 0)],
      skin: [c(14, 6, 2), c(25, 13, 7), c(31, 20, 14)],
    },
  },
  {
    id: 'african',
    baseTeam: 'Nigeria',
    outfield: {
      hair: [c(12, 10, 8)],
      skin: [c(5, 2, 0), c(7, 3, 0), c(11, 6, 0), c(18, 10, 0), c(29, 15, 13)],
    },
    goalkeeper: {
      hair: [c(0, 0, 0)],
      skin: [c(10, 4, 1), c(17, 9, 4), c(26, 17, 10)],
    },
  },
  {
    id: 'asian',
    baseTeam: 'S.Korea',
    outfield: {
      hair: [c(0, 0, 0)],
      skin: [c(5, 4, 0), c(12, 7, 0), c(22, 19, 8), c(25, 24, 18), c(29, 27, 23)],
    },
    goalkeeper: {
      hair: [c(0, 0, 0)],
      skin: [c(17, 11, 7), c(25, 17, 13), c(31, 24, 19)],
    },
  },
];
