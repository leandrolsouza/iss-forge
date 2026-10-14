import { describe, it, expect } from 'vitest';
import { renderShapes, textWidth, SHAPE_COMMANDS } from '../flagShapes';

const ascii = (grid) => grid.map((row) => row.join('')).join('\n');

describe('flag shapes', () => {
  it('draws on the 24×16 grid, later shapes on top', () => {
    const { grid, errors } = renderShapes(['bg 1', 'circle 12 8 5 2']);
    expect(errors).toEqual([]);
    expect(grid).toHaveLength(16);
    expect(grid.every((row) => row.length === 24)).toBe(true);
    expect(grid[8][12]).toBe(2);
    expect(grid[0][0]).toBe(1);
    // symmetric around the centre 12,8
    for (const row of grid) expect(row.join('')).toBe([...row].reverse().join(''));
  });

  it('clips to the frame and leaves the outside transparent', () => {
    const { grid } = renderShapes(['frame shield', 'bg 1', 'border 2']);
    expect(grid[0][0]).toBe(0);
    expect(grid[0][3]).toBe(0);
    expect(grid[0][4]).toBe(2); // border on the top-left corner of the shield
    expect(grid[5][12]).toBe(1);
    expect(grid[15][12]).toBe(2); // bottom point
    expect(grid[15][5]).toBe(0);
  });

  it('writes 3×5 letters, centred with ctext', () => {
    expect(textWidth('CAM')).toBe(11);
    const { grid } = renderShapes(['bg 1', 'ctext CAM 6 2']);
    const rows = ascii(grid).split('\n').slice(6, 11);
    // top row of C (.##), A (.#.), M (#.#) at x 7, 11 and 15
    expect(rows[0]).toBe('111111112211211212111111');
    expect(rows.every((r) => r.startsWith('1111111') && r.endsWith('111111'))).toBe(true);
  });

  it('draws stripes over the frame box', () => {
    const { grid } = renderShapes(['frame shield', 'vstripes 1 2']);
    expect(grid[2].slice(4, 12).every((v) => v === 1)).toBe(true);
    expect(grid[2].slice(12, 20).every((v) => v === 2)).toBe(true);
  });

  it('reports commands it cannot read, with the expected form', () => {
    const { errors } = renderShapes([
      'circle 12 8',
      'blob 1',
      'rect 0 0 4 4 7',
      'text TOOLONGNAME 0 0 1',
      'frame hexagon',
    ]);
    expect(errors).toHaveLength(5);
    expect(errors[0]).toContain('the form is "circle CX CY R COLOR"');
    expect(errors[1]).toContain('unknown command "blob"');
    expect(errors[3]).toContain('pixels wide');
    expect(SHAPE_COMMANDS.length).toBeGreaterThan(10);
  });

  it('tells which layers are hidden, cut or on which colour they sit', () => {
    const { layers } = renderShapes([
      'bg 1',
      'circle 12 8 3 2',
      'rect 0 0 24 16 3',
      'text AB 22 0 1',
    ]);
    const [, circle, , text] = layers;
    expect(circle.visible).toBe(0);
    expect(text.clipped).toBeGreaterThan(0);
    expect(new Set(text.under)).toEqual(new Set([3]));
  });
});
