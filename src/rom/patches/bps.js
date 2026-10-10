/**
 * BPS patch creation / application (byuu's beat format, v1)
 *
 * Format:
 *   "BPS1"
 *   varint sourceSize, varint targetSize, varint metadataSize, metadata
 *   actions: varint ((length - 1) << 2 | command) [+ payload]
 *       0 SourceRead  — copy `length` bytes from source at outputOffset
 *       1 TargetRead  — `length` literal bytes follow
 *       2 SourceCopy  — signed relative offset into source follows
 *       3 TargetCopy  — signed relative offset into already-written target follows
 *   uint32 LE sourceCRC32, targetCRC32, patchCRC32 (of everything before it)
 *
 * The encoder below is a linear differ (SourceRead / TargetRead + TargetCopy for
 * long runs of identical bytes). It is ideal for ROM hacks where data is edited
 * in place, which is exactly what ISS Forge does.
 *
 * Advantage over IPS: patchers verify the source CRC32, so applying the patch to
 * the wrong ROM (other region, already-patched, with copier header…) fails
 * loudly instead of producing a corrupted game.
 */
import { crc32 } from './crc32';

const MAGIC = [0x42, 0x50, 0x53, 0x31]; // "BPS1"

const SOURCE_READ = 0;
const TARGET_READ = 1;
const SOURCE_COPY = 2;
const TARGET_COPY = 3;

/** Equal bytes needed to interrupt a TargetRead with a SourceRead (cost/benefit) */
const MIN_SOURCE_READ = 3;
/** Identical bytes needed to encode a run as TargetRead(1) + TargetCopy */
const MIN_RLE = 8;

class ByteWriter {
  constructor() {
    this.bytes = [];
  }
  byte(b) {
    this.bytes.push(b & 0xff);
  }
  array(arr) {
    for (let i = 0; i < arr.length; i++) this.bytes.push(arr[i] & 0xff);
  }
  varint(value) {
    // Uses arithmetic instead of bit ops so values above 2^31 stay correct
    let data = value;
    for (;;) {
      const x = data % 128;
      data = Math.floor(data / 128);
      if (data === 0) {
        this.byte(0x80 | x);
        break;
      }
      this.byte(x);
      data -= 1;
    }
  }
  uint32(value) {
    this.byte(value);
    this.byte(value >>> 8);
    this.byte(value >>> 16);
    this.byte(value >>> 24);
  }
  get length() {
    return this.bytes.length;
  }
  toUint8Array() {
    return Uint8Array.from(this.bytes);
  }
}

function encodeMetadata(metadata) {
  if (!metadata) return new Uint8Array(0);
  return new TextEncoder().encode(metadata);
}

/**
 * Create a BPS patch transforming `source` into `target`.
 * @param {Uint8Array} source - original (clean) ROM
 * @param {Uint8Array} target - modified ROM
 * @param {{ metadata?: string }} [options]
 * @returns {Uint8Array} patch bytes
 */
export function createBps(source, target, { metadata = '' } = {}) {
  const w = new ByteWriter();
  w.array(MAGIC);
  w.varint(source.length);
  w.varint(target.length);
  const meta = encodeMetadata(metadata);
  w.varint(meta.length);
  w.array(meta);

  const sourceSize = source.length;
  const targetSize = target.length;
  let targetRelativeOffset = 0;

  const action = (command, length) => w.varint((length - 1) * 4 + command);
  const matches = (i) => i < sourceSize && source[i] === target[i];

  let pos = 0;
  while (pos < targetSize) {
    // 1. Unchanged bytes → SourceRead
    if (matches(pos)) {
      let end = pos + 1;
      while (end < targetSize && matches(end)) end++;
      action(SOURCE_READ, end - pos);
      pos = end;
      continue;
    }

    // 2. Long run of identical bytes → TargetRead(1) + TargetCopy(run - 1)
    let runEnd = pos + 1;
    while (runEnd < targetSize && target[runEnd] === target[pos]) runEnd++;
    if (runEnd - pos >= MIN_RLE) {
      action(TARGET_READ, 1);
      w.byte(target[pos]);
      const copyLength = runEnd - pos - 1;
      action(TARGET_COPY, copyLength);
      // Relative offset: copy from the byte we just wrote (pos)
      const delta = pos - targetRelativeOffset;
      w.varint(Math.abs(delta) * 2 + (delta < 0 ? 1 : 0));
      // Overlapping copy reads its own output → replicates the byte
      targetRelativeOffset = pos + copyLength;
      pos = runEnd;
      continue;
    }

    // 3. Changed bytes → TargetRead until a worthwhile unchanged/RLE stretch appears
    let end = pos + 1;
    while (end < targetSize) {
      let same = 0;
      while (end + same < targetSize && matches(end + same) && same < MIN_SOURCE_READ) same++;
      if (same >= MIN_SOURCE_READ || (same > 0 && end + same === targetSize)) break;

      let rle = 1;
      while (end + rle < targetSize && target[end + rle] === target[end] && rle < MIN_RLE) rle++;
      if (rle >= MIN_RLE) break;

      end++;
    }
    action(TARGET_READ, end - pos);
    w.array(target.subarray(pos, end));
    pos = end;
  }

  w.uint32(crc32(source));
  w.uint32(crc32(target));
  const body = w.toUint8Array();
  const patchCrc = crc32(body);

  const out = new Uint8Array(body.length + 4);
  out.set(body);
  out[body.length] = patchCrc & 0xff;
  out[body.length + 1] = (patchCrc >>> 8) & 0xff;
  out[body.length + 2] = (patchCrc >>> 16) & 0xff;
  out[body.length + 3] = (patchCrc >>> 24) & 0xff;
  return out;
}

function readUint32LE(data, p) {
  return (data[p] | (data[p + 1] << 8) | (data[p + 2] << 16) | (data[p + 3] << 24)) >>> 0;
}

/**
 * Decode a BPS varint starting at `p`.
 * @returns {{ value: number, next: number }}
 */
function decodeVarint(patch, p) {
  let value = 0;
  let shift = 1;
  for (;;) {
    if (p >= patch.length) throw new Error('Unexpected end of BPS patch');
    const x = patch[p++];
    value += (x & 0x7f) * shift;
    if (x & 0x80) break;
    shift *= 128;
    value += shift;
  }
  return { value, next: p };
}

/**
 * Parse the header of a BPS patch (sizes, metadata and stored CRCs).
 * @param {Uint8Array} patch
 */
export function readBpsInfo(patch) {
  if (patch.length < MAGIC.length + 3 + 12) throw new Error('Invalid BPS header');
  for (let i = 0; i < MAGIC.length; i++) {
    if (patch[i] !== MAGIC[i]) throw new Error('Invalid BPS header');
  }
  let p = MAGIC.length;
  const read = () => {
    const { value, next } = decodeVarint(patch, p);
    p = next;
    return value;
  };
  const sourceSize = read();
  const targetSize = read();
  const metadataSize = read();
  const metadata = new TextDecoder().decode(patch.subarray(p, p + metadataSize));
  p += metadataSize;
  const footer = patch.length - 12;
  return {
    sourceSize,
    targetSize,
    metadata,
    actionsStart: p,
    footer,
    sourceCrc: readUint32LE(patch, footer),
    targetCrc: readUint32LE(patch, footer + 4),
    patchCrc: readUint32LE(patch, footer + 8),
  };
}

/**
 * Apply a BPS patch, verifying all CRCs.
 * @param {Uint8Array} source
 * @param {Uint8Array} patch
 * @returns {Uint8Array} patched data
 */
export function applyBps(source, patch) {
  const info = readBpsInfo(patch);

  if (crc32(patch, 0, patch.length - 4) !== info.patchCrc) {
    throw new Error('BPS patch is corrupted (patch CRC mismatch)');
  }
  if (source.length !== info.sourceSize || crc32(source) !== info.sourceCrc) {
    throw new Error('BPS source ROM mismatch (wrong ROM or already patched)');
  }

  const target = new Uint8Array(info.targetSize);
  let outputOffset = 0;
  let sourceRelativeOffset = 0;
  let targetRelativeOffset = 0;
  let p = info.actionsStart;

  const readVarint = () => {
    const { value, next } = decodeVarint(patch, p);
    p = next;
    return value;
  };
  const readSigned = () => {
    const v = readVarint();
    return (v & 1 ? -1 : 1) * Math.floor(v / 2);
  };

  while (p < info.footer) {
    const data = readVarint();
    const command = data & 3;
    const length = Math.floor(data / 4) + 1;

    switch (command) {
      case SOURCE_READ:
        for (let i = 0; i < length; i++) target[outputOffset + i] = source[outputOffset + i];
        outputOffset += length;
        break;
      case TARGET_READ:
        target.set(patch.subarray(p, p + length), outputOffset);
        p += length;
        outputOffset += length;
        break;
      case SOURCE_COPY:
        sourceRelativeOffset += readSigned();
        for (let i = 0; i < length; i++) target[outputOffset++] = source[sourceRelativeOffset++];
        break;
      case TARGET_COPY:
        targetRelativeOffset += readSigned();
        for (let i = 0; i < length; i++) target[outputOffset++] = target[targetRelativeOffset++];
        break;
      default:
        break;
    }
  }

  if (crc32(target) !== info.targetCrc) {
    throw new Error('BPS target CRC mismatch');
  }
  return target;
}
