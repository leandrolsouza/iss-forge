/**
 * IPS patch creation / application
 *
 * Format:
 *   "PATCH"
 *   records: [offset:3 BE][size:2 BE][data:size]
 *            or RLE: [offset:3 BE][0x0000][rleSize:2 BE][value:1]
 *   "EOF"
 *   optional [truncateSize:3 BE] (Lunar IPS extension)
 *
 * Limitations of the format (handled here):
 *   - offsets are 24-bit (max 16 MB)
 *   - a record cannot start at 0x454F46 ("EOF" in ASCII) or it would be read
 *     as the end marker
 *   - records hold at most 0xFFFF bytes
 */

const HEADER = [0x50, 0x41, 0x54, 0x43, 0x48]; // "PATCH"
const FOOTER = [0x45, 0x4f, 0x46]; // "EOF"
const EOF_OFFSET = 0x454f46;
const MAX_OFFSET = 0xffffff;
const MAX_RECORD = 0xffff;

/** Merge two diff runs if the unchanged gap between them is shorter than a record header */
const MERGE_GAP = 6;
/** Minimum identical-byte run worth an RLE record */
const RLE_MIN = 16;

class ByteWriter {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }
  push(...bytes) {
    for (const b of bytes) this.chunks.push(b & 0xff);
    this.length += bytes.length;
  }
  pushArray(arr) {
    for (let i = 0; i < arr.length; i++) this.chunks.push(arr[i] & 0xff);
    this.length += arr.length;
  }
  toUint8Array() {
    return Uint8Array.from(this.chunks);
  }
}

function writeOffset(w, offset) {
  if (offset > MAX_OFFSET) {
    throw new Error(`IPS cannot address offset 0x${offset.toString(16)} (max 16 MB)`);
  }
  w.push((offset >> 16) & 0xff, (offset >> 8) & 0xff, offset & 0xff);
}

/**
 * Find ranges [start, end) where target differs from source.
 * Bytes past the end of source always count as different.
 */
function findDiffRuns(source, target) {
  const runs = [];
  const len = target.length;
  const isDiff = (i) => i >= source.length || source[i] !== target[i];

  let i = 0;
  while (i < len) {
    if (!isDiff(i)) {
      i++;
      continue;
    }
    const start = i;
    let end = i + 1;
    for (;;) {
      while (end < len && isDiff(end)) end++;
      // Look ahead: merge with the next run if the gap is small
      let g = end;
      while (g < len && g - end < MERGE_GAP && !isDiff(g)) g++;
      if (g < len && g - end < MERGE_GAP && isDiff(g)) {
        end = g;
        continue;
      }
      break;
    }
    runs.push([start, end]);
    i = end;
  }
  return runs;
}

/** Split a diff run into literal / RLE pieces */
function splitPieces(target, start, end) {
  const pieces = [];
  let litStart = start;
  let i = start;
  while (i < end) {
    let j = i + 1;
    while (j < end && target[j] === target[i]) j++;
    if (j - i >= RLE_MIN) {
      if (i > litStart) pieces.push({ type: 'lit', start: litStart, end: i });
      pieces.push({ type: 'rle', start: i, end: j, value: target[i] });
      litStart = j;
    }
    i = j;
  }
  if (litStart < end) pieces.push({ type: 'lit', start: litStart, end });
  return pieces;
}

function emitLiteral(w, target, start, end) {
  let pos = start;
  while (pos < end) {
    let recStart = pos;
    // A record may not begin at "EOF" — back up one byte (rewriting the same value is harmless)
    if (recStart === EOF_OFFSET) recStart -= 1;
    const recEnd = Math.min(end, recStart + MAX_RECORD);
    writeOffset(w, recStart);
    const size = recEnd - recStart;
    w.push((size >> 8) & 0xff, size & 0xff);
    w.pushArray(target.subarray(recStart, recEnd));
    pos = recEnd;
  }
}

function emitRle(w, target, start, end, value) {
  let pos = start;
  while (pos < end) {
    if (pos === EOF_OFFSET) {
      emitLiteral(w, target, pos, pos + 1);
      pos += 1;
      continue;
    }
    const size = Math.min(end - pos, MAX_RECORD);
    writeOffset(w, pos);
    w.push(0, 0, (size >> 8) & 0xff, size & 0xff, value);
    pos += size;
  }
}

/**
 * Create an IPS patch transforming `source` into `target`.
 * @param {Uint8Array} source - original (clean) ROM
 * @param {Uint8Array} target - modified ROM
 * @returns {Uint8Array} patch bytes
 */
export function createIps(source, target) {
  if (target.length > MAX_OFFSET + 1) {
    throw new Error('IPS does not support files larger than 16 MB');
  }

  const w = new ByteWriter();
  w.pushArray(HEADER);

  for (const [start, end] of findDiffRuns(source, target)) {
    for (const piece of splitPieces(target, start, end)) {
      if (piece.type === 'rle') emitRle(w, target, piece.start, piece.end, piece.value);
      else emitLiteral(w, target, piece.start, piece.end);
    }
  }

  w.pushArray(FOOTER);

  if (target.length < source.length) {
    const size = target.length;
    w.push((size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff);
  }

  return w.toUint8Array();
}

/**
 * Apply an IPS patch.
 * @param {Uint8Array} source
 * @param {Uint8Array} patch
 * @returns {Uint8Array} patched data
 */
export function applyIps(source, patch) {
  for (let i = 0; i < HEADER.length; i++) {
    if (patch[i] !== HEADER[i]) throw new Error('Invalid IPS header');
  }

  let out = new Uint8Array(source);
  const ensure = (size) => {
    if (size > out.length) {
      const grown = new Uint8Array(size);
      grown.set(out);
      out = grown;
    }
  };

  let p = HEADER.length;
  for (;;) {
    if (p + 3 > patch.length) throw new Error('Unexpected end of IPS patch');
    const offset = (patch[p] << 16) | (patch[p + 1] << 8) | patch[p + 2];
    p += 3;
    if (offset === EOF_OFFSET) break;

    const size = (patch[p] << 8) | patch[p + 1];
    p += 2;
    if (size === 0) {
      const rleSize = (patch[p] << 8) | patch[p + 1];
      const value = patch[p + 2];
      p += 3;
      ensure(offset + rleSize);
      out.fill(value, offset, offset + rleSize);
    } else {
      ensure(offset + size);
      out.set(patch.subarray(p, p + size), offset);
      p += size;
    }
  }

  if (p + 3 <= patch.length) {
    const truncate = (patch[p] << 16) | (patch[p + 1] << 8) | patch[p + 2];
    out = out.slice(0, truncate);
  }

  return out;
}
