import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  createIps,
  applyIps,
  createBps,
  applyBps,
  readBpsInfo,
  crc32,
  formatCrc32,
  buildPatch,
  stripCopierHeader,
  countChangedBytes,
  getPatchFilename,
} from '../patches';

// Optional: real ROM (gitignored) — tests using it are skipped when absent
const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);

function seeded(size, seed = 1) {
  const data = new Uint8Array(size);
  let s = seed;
  for (let i = 0; i < size; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (s >> 16) & 0xff;
  }
  return data;
}

/** Apply scattered edits similar to what the editor does (names, colors, tiles) */
function mutate(source, seed = 1) {
  const target = new Uint8Array(source);
  let s = seed;
  const rnd = (n) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s % n;
  };
  for (let k = 0; k < 200; k++) {
    const at = rnd(source.length - 64);
    const len = 1 + rnd(40);
    for (let i = 0; i < len; i++) target[at + i] = rnd(256);
  }
  // A long run of identical bytes (exercise RLE / TargetCopy)
  target.fill(0x00, 0x8000, 0x8000 + 500);
  target.fill(0x77, 0x9000, 0x9000 + 70000); // > 0xFFFF bytes
  return target;
}

function expectEqualBytes(a, b) {
  expect(a.length).toBe(b.length);
  expect(countChangedBytes(a, b)).toBe(0);
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(formatCrc32(0xcbf43926)).toBe('CBF43926');
    expect(formatCrc32(0x1)).toBe('00000001');
  });
});

describe('IPS', () => {
  it('round-trips scattered edits', () => {
    const source = seeded(256 * 1024, 2);
    const target = mutate(source, 3);
    const patch = createIps(source, target);

    expect(String.fromCharCode(...patch.subarray(0, 5))).toBe('PATCH');
    expectEqualBytes(applyIps(source, patch), target);
  });

  it('produces an empty patch for identical files', () => {
    const source = seeded(4096);
    const patch = createIps(source, new Uint8Array(source));
    expect(patch.length).toBe(8); // "PATCH" + "EOF"
  });

  it('uses RLE records for long identical runs', () => {
    const source = seeded(200000, 4);
    const target = new Uint8Array(source);
    target.fill(0x55, 1000, 1000 + 150000);
    const patch = createIps(source, target);
    expect(patch.length).toBeLessThan(100);
    expectEqualBytes(applyIps(source, patch), target);
  });

  it('never starts a record at offset 0x454F46 ("EOF")', () => {
    const size = 0x460000;
    const source = new Uint8Array(size);
    const target = new Uint8Array(size);
    target[0x454f46] = 0x12;
    target[0x454f47] = 0x34;
    const patch = createIps(source, target);
    expectEqualBytes(applyIps(source, patch), target);
  });

  it('handles target larger than source', () => {
    const source = seeded(1000, 5);
    const target = new Uint8Array(1500);
    target.set(source);
    target[1499] = 0x99;
    expectEqualBytes(applyIps(source, createIps(source, target)), target);
  });

  it('handles target smaller than source (truncation extension)', () => {
    const source = seeded(2000, 6);
    const target = source.slice(0, 1024);
    target[10] ^= 0xff;
    expectEqualBytes(applyIps(source, createIps(source, target)), target);
  });
});

describe('BPS', () => {
  it('round-trips scattered edits and validates CRCs', () => {
    const source = seeded(256 * 1024, 7);
    const target = mutate(source, 8);
    const patch = createBps(source, target, { metadata: 'ISS Forge test' });

    const info = readBpsInfo(patch);
    expect(info.sourceSize).toBe(source.length);
    expect(info.targetSize).toBe(target.length);
    expect(info.metadata).toBe('ISS Forge test');
    expect(info.sourceCrc).toBe(crc32(source));
    expect(info.targetCrc).toBe(crc32(target));

    expectEqualBytes(applyBps(source, patch), target);
  });

  it('is smaller than the equivalent IPS for long runs', () => {
    const source = seeded(200000, 9);
    const target = new Uint8Array(source);
    target.fill(0x55, 1000, 1000 + 150000);
    const bps = createBps(source, target);
    expect(bps.length).toBeLessThan(64);
    expectEqualBytes(applyBps(source, bps), target);
  });

  it('rejects the wrong source ROM', () => {
    const source = seeded(4096, 10);
    const target = mutate(seeded(4096, 10), 11).slice(0, 4096);
    const patch = createBps(source, target);
    const wrong = new Uint8Array(source);
    wrong[0] ^= 1;
    expect(() => applyBps(wrong, patch)).toThrow(/source/i);
  });

  it('detects a corrupted patch', () => {
    const source = seeded(4096, 12);
    const target = new Uint8Array(source);
    target[100] ^= 0xff;
    const patch = createBps(source, target);
    patch[6] ^= 0xff;
    expect(() => applyBps(source, patch)).toThrow(/corrupted/i);
  });

  it('handles size changes', () => {
    const source = seeded(3000, 13);
    const bigger = new Uint8Array(5000);
    bigger.set(source);
    bigger.fill(0xee, 3000);
    expectEqualBytes(applyBps(source, createBps(source, bigger)), bigger);

    const smaller = source.slice(0, 1000);
    expectEqualBytes(applyBps(source, createBps(source, smaller)), smaller);
  });

  it('handles edits at the very start and end', () => {
    const source = seeded(1024, 14);
    const target = new Uint8Array(source);
    target[0] ^= 0xff;
    target[1023] ^= 0xff;
    expectEqualBytes(applyBps(source, createBps(source, target)), target);
  });
});

describe('buildPatch', () => {
  it('strips the copier header from both base and modified ROMs', () => {
    const rom = seeded(1024 * 1024, 15);
    const headered = new Uint8Array(512 + rom.length);
    headered.set(rom, 512);
    const modified = new Uint8Array(headered);
    modified[512 + 0x1234] ^= 0xff;

    expect(stripCopierHeader(headered).length).toBe(rom.length);

    const result = buildPatch({ format: 'bps', base: rom, modified });
    expect(result.changedBytes).toBe(1);
    expect(result.baseCrc).toBe(crc32(rom));

    const patched = applyBps(rom, result.patch);
    expectEqualBytes(patched, stripCopierHeader(modified));

    const ips = buildPatch({ format: 'ips', base: headered, modified });
    expectEqualBytes(applyIps(rom, ips.patch), stripCopierHeader(modified));
  });

  it('rejects unknown formats', () => {
    expect(() =>
      buildPatch({ format: 'xdelta', base: new Uint8Array(1), modified: new Uint8Array(1) }),
    ).toThrow();
  });

  it('suggests a patch filename', () => {
    expect(getPatchFilename('ISS (Europe).sfc', 'bps')).toBe('ISS (Europe).bps');
    expect(getPatchFilename('rom', 'ips')).toBe('rom.ips');
    expect(getPatchFilename(null, 'bps')).toBe('ISS_Forge.bps');
  });

  it.skipIf(!hasRealRom)('round-trips an edit on the real ROM in both formats', () => {
    const base = new Uint8Array(readFileSync(REAL_ROM));
    const modified = mutate(base, 21);

    for (const format of ['ips', 'bps']) {
      const { patch } = buildPatch({ format, base, modified });
      const out = format === 'ips' ? applyIps(base, patch) : applyBps(base, patch);
      expectEqualBytes(out, modified);
    }
  });
});
