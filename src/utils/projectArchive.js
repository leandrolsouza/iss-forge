/**
 * Project files (.issproj) — share a project or move it to another computer.
 *
 * The file is JSON with the project's name/description and a BPS patch from the
 * unedited ROM to the project's ROM. The ROM itself is NOT inside: whoever imports
 * needs the same original ROM (found among their projects by CRC, or picked by hand).
 * Patch and CRC are on headerless data (copier header stripped), like exported patches.
 *
 * {
 *   "format": "iss-forge-project", "version": 1, "exportedAt": "2026-10-12T...",
 *   "project": { "name", "description", "romFileName" },
 *   "base": { "crc": "6CD568A9", "size": 1048576 },
 *   "patch": "<base64 BPS>"
 * }
 *
 * Errors are thrown with an i18n key as message.
 */
import { createBps, applyBps, crc32, formatCrc32, stripCopierHeader } from '../rom/patches';

export const PROJECT_ARCHIVE_FORMAT = 'iss-forge-project';
export const PROJECT_ARCHIVE_VERSION = 1;
export const PROJECT_ARCHIVE_EXTENSION = '.issproj';

/** CRC32 (8 hex digits) of the headerless ROM — identifies the base of a project */
export function romBaseCrc(rom) {
  return formatCrc32(crc32(stripCopierHeader(rom)));
}

export function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(text) {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * @param {object} params
 * @param {{ name: string, description?: string, romFileName?: string }} params.project
 * @param {Uint8Array} params.original - the project's unedited ROM
 * @param {Uint8Array} params.data - the project's ROM
 * @param {Date} [params.exportedAt]
 * @returns {Uint8Array} UTF-8 JSON
 */
export function buildProjectArchive({ project, original, data, exportedAt = new Date() }) {
  const source = stripCopierHeader(original);
  const target = stripCopierHeader(data);
  const patch = createBps(source, target, { metadata: project.name || '' });
  const archive = {
    format: PROJECT_ARCHIVE_FORMAT,
    version: PROJECT_ARCHIVE_VERSION,
    exportedAt: exportedAt.toISOString(),
    project: {
      name: project.name || '',
      description: project.description || '',
      romFileName: project.romFileName || '',
    },
    base: { crc: formatCrc32(crc32(source)), size: source.length },
    patch: bytesToBase64(patch),
  };
  return new TextEncoder().encode(JSON.stringify(archive, null, 2));
}

/**
 * Read and check a project file.
 * @param {Uint8Array|string} input
 * @returns {{ project: {name: string, description: string, romFileName: string},
 *   baseCrc: string, baseSize: number, patch: Uint8Array }}
 */
export function parseProjectArchive(input) {
  let json;
  try {
    const text = typeof input === 'string' ? input : new TextDecoder().decode(input);
    json = JSON.parse(text);
  } catch {
    throw new Error('projectArchiveInvalid');
  }
  if (!json || json.format !== PROJECT_ARCHIVE_FORMAT) throw new Error('projectArchiveInvalid');
  if (typeof json.version !== 'number' || json.version > PROJECT_ARCHIVE_VERSION) {
    throw new Error('projectArchiveVersion');
  }
  if (typeof json.patch !== 'string' || !json.base || typeof json.base.crc !== 'string') {
    throw new Error('projectArchiveInvalid');
  }
  let patch;
  try {
    patch = base64ToBytes(json.patch);
  } catch {
    throw new Error('projectArchiveInvalid');
  }
  const p = json.project || {};
  return {
    project: {
      name: String(p.name || '').trim(),
      description: String(p.description || ''),
      romFileName: String(p.romFileName || ''),
    },
    baseCrc: json.base.crc.toUpperCase(),
    baseSize: Number(json.base.size) || 0,
    patch,
  };
}

/** True when `rom` (header or not) is the base the archive was made from */
export function isArchiveBase(archive, rom) {
  return !!rom && romBaseCrc(rom) === archive.baseCrc;
}

/**
 * Rebuild the project's ROMs from a parsed archive and its base ROM.
 * @returns {{ original: Uint8Array, data: Uint8Array }} both headerless
 */
export function restoreProjectArchive(archive, baseRom) {
  if (!isArchiveBase(archive, baseRom)) throw new Error('projectArchiveWrongBase');
  const original = stripCopierHeader(baseRom).slice();
  let data;
  try {
    data = applyBps(original, archive.patch);
  } catch {
    throw new Error('projectArchiveInvalid');
  }
  return { original, data };
}

/** "Campeonato Brasileiro" -> "Campeonato Brasileiro.issproj" (no characters Windows refuses) */
export function projectArchiveFileName(name) {
  const stem =
    String(name || '')
      .replace(/[<>:"/\\|?*]/g, '')
      .split('')
      .filter((c) => c.charCodeAt(0) >= 32)
      .join('')
      .trim() || 'projeto';
  return `${stem}${PROJECT_ARCHIVE_EXTENSION}`;
}
