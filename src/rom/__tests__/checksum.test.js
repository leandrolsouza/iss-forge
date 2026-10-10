import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  calculateSnesChecksum,
  fixChecksum,
  inspectChecksum,
  LOROM_HEADER_ADDR,
} from '../checksum';
import RomParser from '../RomParser';

// Optional: real ROM (gitignored) — tests using it are skipped when absent
const REAL_ROM = fileURLToPath(
  new URL('../../../rom/original/International Superstar Soccer (Europe).sfc', import.meta.url),
);
const hasRealRom = existsSync(REAL_ROM);

function seededRom(size, seed = 1) {
  const data = new Uint8Array(size);
  let s = seed;
  for (let i = 0; i < size; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = s & 0xff;
  }
  // Valid-looking title so RomParser/validator accept it
  const title = 'INTERNATIONAL SS     ';
  for (let i = 0; i < 21; i++) data[LOROM_HEADER_ADDR + i] = title.charCodeAt(i);
  return data;
}

function naiveSum(rom) {
  let sum = 0;
  for (let i = 0; i < rom.length; i++) sum = (sum + rom[i]) & 0xffff;
  return sum;
}

describe('SNES checksum', () => {
  it('produces a self-consistent checksum after fixChecksum', () => {
    const rom = seededRom(1024 * 1024);
    const result = fixChecksum(rom);

    expect(result.checksum ^ result.complement).toBe(0xffff);
    // With a valid pair stored, the plain byte sum must equal the checksum
    expect(naiveSum(rom)).toBe(result.checksum);
    expect(inspectChecksum(rom).valid).toBe(true);
  });

  it('is independent of the values currently stored in the checksum fields', () => {
    const rom = seededRom(1024 * 1024, 7);
    const a = calculateSnesChecksum(rom);
    rom.fill(0x12, LOROM_HEADER_ADDR + 0x1c, LOROM_HEADER_ADDR + 0x20);
    const b = calculateSnesChecksum(rom);
    expect(a).toBe(b);
  });

  it('reports changed=false when the checksum is already valid', () => {
    const rom = seededRom(1024 * 1024, 3);
    fixChecksum(rom);
    expect(fixChecksum(rom).changed).toBe(false);
  });

  it('ignores the 512-byte copier header', () => {
    const rom = seededRom(1024 * 1024, 5);
    const headered = new Uint8Array(512 + rom.length);
    headered.fill(0xab, 0, 512);
    headered.set(rom, 512);

    const plain = fixChecksum(rom);
    const withHeader = fixChecksum(headered, 512);
    expect(withHeader.checksum).toBe(plain.checksum);
  });

  it('mirrors non power-of-two ROMs (12 Mbit = 8 Mbit + 4 Mbit x2)', () => {
    const rom = seededRom(1536 * 1024, 9);
    const first = rom.subarray(0, 1024 * 1024);
    const rest = rom.subarray(1024 * 1024);

    // Expected: first block once (with canonical checksum fields) + rest twice
    const firstCopy = new Uint8Array(first);
    firstCopy[LOROM_HEADER_ADDR + 0x1c] = 0xff;
    firstCopy[LOROM_HEADER_ADDR + 0x1d] = 0xff;
    firstCopy[LOROM_HEADER_ADDR + 0x1e] = 0x00;
    firstCopy[LOROM_HEADER_ADDR + 0x1f] = 0x00;
    const expected = (naiveSum(firstCopy) + 2 * naiveSum(rest)) & 0xffff;

    expect(calculateSnesChecksum(rom)).toBe(expected);
  });

  it('RomParser.fixChecksum keeps the buffer valid after edits', () => {
    const rom = seededRom(1024 * 1024, 11);
    fixChecksum(rom);
    const parser = new RomParser(rom);
    parser.writeByte(0x20000, parser.readByte(0x20000) ^ 0xff);

    expect(parser.getChecksumInfo().valid).toBe(false);
    parser.fixChecksum();
    expect(parser.getChecksumInfo().valid).toBe(true);
    // Original snapshot stays untouched
    expect(parser.getOriginalData()[0x20000]).toBe(rom[0x20000]);
  });

  it.skipIf(!hasRealRom)('matches the checksum stored in the original ISS (Europe) ROM', () => {
    const rom = new Uint8Array(readFileSync(REAL_ROM));
    const info = inspectChecksum(rom);
    expect(info.calculated).toBe(info.stored);
    expect(info.valid).toBe(true);
  });
});
