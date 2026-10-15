import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeAtomic } from '../../../electron/atomicFile.mjs';
import { saveBackup, loadBackup, clearBackup } from '../../../electron/backups.mjs';

let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'iss-safe-write-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('atomic persistence', () => {
  it('replaces a complete file and leaves no temporary files', () => {
    const file = path.join(root, 'rom.bin');
    fs.writeFileSync(file, 'old');
    writeAtomic(file, 'new');
    expect(fs.readFileSync(file, 'utf8')).toBe('new');
    expect(fs.readdirSync(root)).toEqual(['rom.bin']);
  });

  it.each(['writeFileSync', 'fsyncSync', 'renameSync'])(
    'keeps the previous file when %s fails',
    (operation) => {
      const file = path.join(root, 'rom.bin');
      fs.writeFileSync(file, 'previous');
      vi.spyOn(fs, operation).mockImplementationOnce(() => {
        throw new Error('disk failure');
      });
      expect(() => writeAtomic(file, 'replacement')).toThrow('disk failure');
      expect(fs.readFileSync(file, 'utf8')).toBe('previous');
      expect(fs.readdirSync(root)).toEqual(['rom.bin']);
    },
  );

  it('recovers the previous backup and its matching base after an interrupted replacement', () => {
    const original = new Uint8Array([1, 2, 3]);
    const first = { original, data: new Uint8Array([4, 5, 6]), meta: { fileName: 'first.sfc' } };
    saveBackup(root, first);
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('interrupted');
    });
    expect(() =>
      saveBackup(root, {
        original: new Uint8Array([8, 8, 8]),
        data: new Uint8Array([9, 9, 9]),
        meta: { fileName: 'second.sfc' },
      }),
    ).toThrow();
    const recovered = loadBackup(root);
    expect([...recovered.data]).toEqual([4, 5, 6]);
    expect([...recovered.original]).toEqual([1, 2, 3]);
    expect(recovered.meta.fileName).toBe('first.sfc');
  });

  it('reuses the immutable base and clears recovery when requested', () => {
    saveBackup(root, { original: new Uint8Array([1, 2]), data: new Uint8Array([3, 4]), meta: {} });
    saveBackup(root, { data: new Uint8Array([5, 6]), meta: { timestamp: 123 } });
    expect([...loadBackup(root).original]).toEqual([1, 2]);
    expect([...loadBackup(root).data]).toEqual([5, 6]);
    clearBackup(root);
    expect(loadBackup(root)).toBeNull();
  });

  it('reads a backup from an older installation', () => {
    fs.writeFileSync(path.join(root, 'autosave-backup.bin'), new Uint8Array([2]));
    fs.writeFileSync(path.join(root, 'autosave-original.bin'), new Uint8Array([1]));
    fs.writeFileSync(path.join(root, 'autosave-meta.json'), JSON.stringify({ hasOriginal: true }));
    expect([...loadBackup(root).original]).toEqual([1]);
  });
});
