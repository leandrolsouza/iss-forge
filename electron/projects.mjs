/**
 * Projects store (main process).
 *
 * A project is a folder managed by the app, one per mod ("Campeonato Brasileiro",
 * "Premier League"...), under <userData>/projects/<id>/:
 *
 *   project.json   metadata (name, description, source ROM name, base CRC; createdAt,
 *                  updatedAt = any change, savedAt = ROM saved, openedAt = last opened)
 *   original.bin   the unedited ROM the project was created from (patch base,
 *                  "restore original" buttons)
 *   rom.bin        the project's ROM with every saved edit
 *   autosave.bin   unsaved edits, written every minute while the project is modified;
 *                  removed when the project is saved or the edits are discarded
 *
 * Pure Node (fs/path/crypto): every function takes the projects root folder, so the
 * module can be tested without Electron.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { writeAtomic } from './atomicFile.mjs';

export const PROJECT_FORMAT_VERSION = 1;

const META_FILE = 'project.json';
const ROM_FILE = 'rom.bin';
const ORIGINAL_FILE = 'original.bin';
const AUTOSAVE_FILE = 'autosave.bin';

export const MAX_NAME_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 1000;

/** Error with an i18n key as message (the renderer shows t(error)) */
function fail(key) {
  const err = new Error(key);
  err.code = key;
  return err;
}

// Folder names are generated here; anything else is refused (no path traversal)
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function projectDir(root, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw fail('projectNotFound');
  return path.join(root, id);
}

function existingProjectDir(root, id) {
  const dir = projectDir(root, id);
  if (!fs.existsSync(path.join(dir, META_FILE))) throw fail('projectNotFound');
  return dir;
}

/** "Campeonato Brasileiro 2026" -> "campeonato-brasileiro-2026" */
export function slugify(name) {
  const slug = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'projeto';
}

function newId(root, name) {
  const base = slugify(name);
  for (;;) {
    const id = `${base}-${crypto.randomBytes(3).toString('hex')}`;
    if (!fs.existsSync(path.join(root, id))) return id;
  }
}

function cleanName(name) {
  const value = String(name ?? '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  if (!value) throw fail('projectNameRequired');
  return value;
}

function cleanDescription(description) {
  return String(description ?? '')
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
}

function readMeta(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, META_FILE), 'utf-8'));
}

function writeMeta(dir, meta) {
  // `dir` / `autosaveAt` are computed on read, never stored
  const stored = { ...meta };
  delete stored.dir;
  delete stored.autosaveAt;
  writeAtomic(path.join(dir, META_FILE), JSON.stringify(stored, null, 2));
}

/** Metadata plus where it lives and the time of the pending auto-save (null when none) */
function withAutosave(dir, meta) {
  const file = path.join(dir, AUTOSAVE_FILE);
  return {
    ...meta,
    dir,
    autosaveAt: fs.existsSync(file) ? fs.statSync(file).mtimeMs : null,
  };
}

/** Last time the project was opened or saved (list order) */
export function lastUsed(meta) {
  return Math.max(meta.openedAt || 0, meta.updatedAt || 0, meta.createdAt || 0);
}

function toBuffer(data) {
  if (!data || !data.length) throw fail('projectRomMissing');
  return Buffer.from(data);
}

/**
 * All projects, most recently used (opened or saved) first. Broken folders are skipped.
 * @param {string} root
 */
export function listProjects(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !ID_RE.test(entry.name)) continue;
    const dir = path.join(root, entry.name);
    try {
      const meta = readMeta(dir);
      if (meta.id !== entry.name) continue;
      if (!fs.existsSync(path.join(dir, ROM_FILE))) continue;
      out.push(withAutosave(dir, meta));
    } catch {
      // unreadable project.json: not a project
    }
  }
  return out.sort((a, b) => lastUsed(b) - lastUsed(a));
}

/**
 * @param {string} root
 * @param {object} params
 * @param {string} params.name
 * @param {string} [params.description]
 * @param {string} [params.romFileName] - file the project was created from
 * @param {string} [params.baseCrc] - CRC32 (hex) of the headerless original ROM
 * @param {Uint8Array} params.original - unedited ROM
 * @param {Uint8Array} [params.data] - starting ROM (defaults to the original)
 * @param {number} [now]
 * @returns {object} metadata
 */
export function createProject(root, params, now = Date.now()) {
  const name = cleanName(params.name);
  const original = toBuffer(params.original);
  const data = params.data ? toBuffer(params.data) : original;

  fs.mkdirSync(root, { recursive: true });
  const id = newId(root, name);
  const dir = path.join(root, id);
  fs.mkdirSync(dir);

  const meta = {
    formatVersion: PROJECT_FORMAT_VERSION,
    id,
    name,
    description: cleanDescription(params.description),
    romFileName: params.romFileName ? String(params.romFileName) : '',
    baseCrc: params.baseCrc ? String(params.baseCrc) : '',
    createdAt: now,
    updatedAt: now,
  };
  try {
    fs.writeFileSync(path.join(dir, ORIGINAL_FILE), original);
    fs.writeFileSync(path.join(dir, ROM_FILE), data);
    writeMeta(dir, meta);
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return withAutosave(dir, meta);
}

/**
 * @returns {{ meta: object, data: Buffer, original: Buffer, autosave: Buffer|null }}
 */
export function loadProject(root, id) {
  const dir = existingProjectDir(root, id);
  const meta = readMeta(dir);
  const data = fs.readFileSync(path.join(dir, ROM_FILE));
  const originalFile = path.join(dir, ORIGINAL_FILE);
  const original = fs.existsSync(originalFile) ? fs.readFileSync(originalFile) : data;
  const autosaveFile = path.join(dir, AUTOSAVE_FILE);
  const autosave = fs.existsSync(autosaveFile) ? fs.readFileSync(autosaveFile) : null;
  return {
    meta: withAutosave(dir, meta),
    data,
    original,
    // an auto-save of another size can't belong to this ROM
    autosave: autosave && autosave.length === data.length ? autosave : null,
  };
}

/** Save the project's ROM (the pending auto-save is now obsolete) */
export function saveProjectRom(root, id, data, now = Date.now()) {
  const dir = existingProjectDir(root, id);
  writeAtomic(path.join(dir, ROM_FILE), toBuffer(data));
  fs.rmSync(path.join(dir, AUTOSAVE_FILE), { force: true });
  const meta = { ...readMeta(dir), updatedAt: now, savedAt: now };
  writeMeta(dir, meta);
  return withAutosave(dir, meta);
}

/** The project was opened in the editor (most recently used projects come first) */
export function markProjectOpened(root, id, now = Date.now()) {
  const dir = existingProjectDir(root, id);
  const meta = { ...readMeta(dir), openedAt: now };
  writeMeta(dir, meta);
  return withAutosave(dir, meta);
}

/** Rename / change the description */
export function updateProject(root, id, changes = {}, now = Date.now()) {
  const dir = existingProjectDir(root, id);
  const meta = readMeta(dir);
  if (changes.name !== undefined) meta.name = cleanName(changes.name);
  if (changes.description !== undefined) meta.description = cleanDescription(changes.description);
  meta.updatedAt = now;
  writeMeta(dir, meta);
  return withAutosave(dir, meta);
}

/** Copy of a project (saved state only: its auto-save is not copied) */
export function duplicateProject(root, id, { name, description } = {}, now = Date.now()) {
  const { meta, data, original } = loadProject(root, id);
  return createProject(
    root,
    {
      name: name ?? meta.name,
      description: description ?? meta.description,
      romFileName: meta.romFileName,
      baseCrc: meta.baseCrc,
      original,
      data,
    },
    now,
  );
}

export function deleteProject(root, id) {
  const dir = existingProjectDir(root, id);
  fs.rmSync(dir, { recursive: true, force: true });
}

export function saveProjectAutosave(root, id, data) {
  const dir = existingProjectDir(root, id);
  writeAtomic(path.join(dir, AUTOSAVE_FILE), toBuffer(data));
}

export function clearProjectAutosave(root, id) {
  const dir = existingProjectDir(root, id);
  fs.rmSync(path.join(dir, AUTOSAVE_FILE), { force: true });
}

/**
 * Where everything of a project is, for "show in folder"
 * @returns {{ dir: string, rom: string }}
 */
export function projectPaths(root, id) {
  const dir = existingProjectDir(root, id);
  return { dir, rom: path.join(dir, ROM_FILE) };
}

/**
 * Unedited ROM of any project whose base has this CRC (to import a shared project
 * without asking for the ROM again). Null when none matches.
 */
export function findOriginalByCrc(root, crc) {
  if (!crc) return null;
  const wanted = String(crc).toLowerCase();
  for (const meta of listProjects(root)) {
    if ((meta.baseCrc || '').toLowerCase() !== wanted) continue;
    const file = path.join(root, meta.id, ORIGINAL_FILE);
    if (fs.existsSync(file)) return fs.readFileSync(file);
  }
  return null;
}
