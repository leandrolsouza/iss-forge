import fs from 'node:fs';
import path from 'node:path';
import { writeAtomic } from './atomicFile.mjs';

const SNAPSHOT = 'autosave-snapshot.json';
const LEGACY = ['autosave-backup.bin', 'autosave-meta.json', 'autosave-original.bin'];

/** One atomic envelope keeps edited bytes, their base and metadata in the same generation. */
export function saveBackup(root, { data, meta, original }) {
  const previous = original ? null : loadBackup(root);
  const base = original ? Buffer.from(original) : previous?.original;
  if (!base || base.length !== data.length) throw new Error('backupOriginalMissing');
  const snapshot = {
    version: 1,
    meta: { ...meta, hasOriginal: true },
    data: Buffer.from(data).toString('base64'),
    original: Buffer.from(base).toString('base64'),
  };
  writeAtomic(path.join(root, SNAPSHOT), JSON.stringify(snapshot));
}

export function loadBackup(root) {
  const file = path.join(root, SNAPSHOT);
  if (fs.existsSync(file)) {
    const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (snapshot.version !== 1) throw new Error('backupInvalid');
    const data = Buffer.from(snapshot.data, 'base64');
    const original = Buffer.from(snapshot.original, 'base64');
    if (!data.length || original.length !== data.length) throw new Error('backupInvalid');
    return { data, original, meta: snapshot.meta };
  }
  // Read old installations without rewriting or discarding their recovery files.
  const [rom, metadata, base] = LEGACY.map((name) => path.join(root, name));
  if (!fs.existsSync(rom) || !fs.existsSync(metadata)) return null;
  const data = fs.readFileSync(rom);
  const meta = JSON.parse(fs.readFileSync(metadata, 'utf8'));
  const original = meta.hasOriginal && fs.existsSync(base) ? fs.readFileSync(base) : null;
  return { data, meta, original: original?.length === data.length ? original : null };
}

export function clearBackup(root) {
  // Remove the current snapshot last so a failed legacy cleanup keeps recovery available.
  for (const name of [...LEGACY, SNAPSHOT]) fs.rmSync(path.join(root, name), { force: true });
}
