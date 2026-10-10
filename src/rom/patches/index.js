/**
 * Patch export facade — builds IPS/BPS patches from two ROM images.
 *
 * Patches are always generated against HEADERLESS data (512-byte copier
 * header stripped). That is the convention used by ROMhacking.net and by most
 * patchers (Flips, beat, RomPatcher.js); the copier header is meaningless to
 * the game and only causes "wrong ROM" problems when distributing patches.
 */
import { createIps } from './ips';
import { createBps } from './bps';
import { crc32 } from './crc32';

export { createIps, applyIps } from './ips';
export { createBps, applyBps, readBpsInfo } from './bps';
export { crc32, formatCrc32 } from './crc32';

export const PATCH_FORMATS = ['bps', 'ips'];

/**
 * @param {Uint8Array} data - ROM file bytes
 * @returns {Uint8Array} view without the copier header
 */
export function stripCopierHeader(data) {
  return data.length % 1024 === 512 ? data.subarray(512) : data;
}

/**
 * Count bytes that differ between two buffers (extra/missing bytes count as changed).
 */
export function countChangedBytes(a, b) {
  const common = Math.min(a.length, b.length);
  let changed = Math.abs(a.length - b.length);
  for (let i = 0; i < common; i++) {
    if (a[i] !== b[i]) changed++;
  }
  return changed;
}

/**
 * Build a patch.
 * @param {object} params
 * @param {'bps'|'ips'} params.format
 * @param {Uint8Array} params.base - clean ROM (copier header allowed, will be stripped)
 * @param {Uint8Array} params.modified - edited ROM (copier header allowed, will be stripped)
 * @param {string} [params.metadata] - BPS only, free text (author, description…)
 * @returns {{ patch: Uint8Array, format: string, changedBytes: number, baseCrc: number, targetCrc: number }}
 */
export function buildPatch({ format, base, modified, metadata = '' }) {
  const source = stripCopierHeader(base);
  const target = stripCopierHeader(modified);

  let patch;
  if (format === 'ips') patch = createIps(source, target);
  else if (format === 'bps') patch = createBps(source, target, { metadata });
  else throw new Error(`Unknown patch format: ${format}`);

  return {
    patch,
    format,
    changedBytes: countChangedBytes(source, target),
    baseCrc: crc32(source),
    targetCrc: crc32(target),
  };
}

/**
 * Suggest a patch filename from the ROM filename ("ISS (Europe).sfc" -> "ISS (Europe).bps")
 */
export function getPatchFilename(romFileName, format) {
  const name = romFileName || 'ISS_Forge';
  const lastDot = name.lastIndexOf('.');
  const stem = lastDot > 0 ? name.substring(0, lastDot) : name;
  return `${stem}.${format}`;
}
