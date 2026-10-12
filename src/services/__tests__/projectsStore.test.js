/* global Buffer */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as store from '../../../electron/projects.mjs';

const rom = (fill, size = 4096) => new Uint8Array(size).fill(fill);

let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'iss-forge-projects-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('projects store', () => {
  it('starts empty, also when the folder does not exist', () => {
    expect(store.listProjects(path.join(root, 'missing'))).toEqual([]);
    expect(store.listProjects(root)).toEqual([]);
  });

  it('creates a project from a ROM and lists it', () => {
    const meta = store.createProject(
      root,
      {
        name: '  Campeonato Brasileiro  ',
        description: 'Serie A',
        romFileName: 'ISS.sfc',
        baseCrc: 'ABCD1234',
        original: rom(1),
      },
      1000,
    );
    expect(meta.id).toMatch(/^campeonato-brasileiro-[0-9a-f]{6}$/);
    expect(meta).toMatchObject({
      name: 'Campeonato Brasileiro',
      description: 'Serie A',
      romFileName: 'ISS.sfc',
      baseCrc: 'ABCD1234',
      createdAt: 1000,
      updatedAt: 1000,
      autosaveAt: null,
    });
    expect(store.listProjects(root).map((p) => p.id)).toEqual([meta.id]);

    const loaded = store.loadProject(root, meta.id);
    expect([...loaded.data]).toEqual([...rom(1)]);
    expect([...loaded.original]).toEqual([...rom(1)]);
    expect(loaded.autosave).toBeNull();
  });

  it('keeps several independent projects, most recent first', () => {
    const br = store.createProject(root, { name: 'Brasileirao', original: rom(1) }, 1000);
    const pl = store.createProject(root, { name: 'Premier League', original: rom(1) }, 2000);
    expect(store.listProjects(root).map((p) => p.name)).toEqual(['Premier League', 'Brasileirao']);

    store.saveProjectRom(root, br.id, rom(7), 3000);
    expect(store.listProjects(root).map((p) => p.name)).toEqual(['Brasileirao', 'Premier League']);
    expect(store.loadProject(root, br.id).data[0]).toBe(7);
    expect(store.loadProject(root, pl.id).data[0]).toBe(1);
    // the original never changes
    expect(store.loadProject(root, br.id).original[0]).toBe(1);
  });

  it('lists the most recently used first: opened or saved', () => {
    const a = store.createProject(root, { name: 'A', original: rom(1) }, 1000);
    const b = store.createProject(root, { name: 'B', original: rom(1) }, 2000);
    expect(store.listProjects(root).map((p) => p.name)).toEqual(['B', 'A']);
    store.markProjectOpened(root, a.id, 3000);
    expect(store.listProjects(root).map((p) => p.name)).toEqual(['A', 'B']);
    store.saveProjectRom(root, b.id, rom(2), 4000);
    expect(store.listProjects(root).map((p) => p.name)).toEqual(['B', 'A']);
    expect(store.listProjects(root)[0]).toMatchObject({ savedAt: 4000, updatedAt: 4000 });
    // renaming is not a save
    const renamed = store.updateProject(root, a.id, { name: 'A2' }, 5000);
    expect(renamed.savedAt).toBeUndefined();
  });

  it('tells where the project is, without storing it', () => {
    const meta = store.createProject(root, { name: 'Where', original: rom(1) });
    expect(meta.dir).toBe(path.join(root, meta.id));
    expect(store.projectPaths(root, meta.id)).toEqual({
      dir: path.join(root, meta.id),
      rom: path.join(root, meta.id, 'rom.bin'),
    });
    store.saveProjectAutosave(root, meta.id, rom(2));
    store.markProjectOpened(root, meta.id);
    const stored = JSON.parse(fs.readFileSync(path.join(root, meta.id, 'project.json'), 'utf-8'));
    expect(stored).not.toHaveProperty('dir');
    expect(stored).not.toHaveProperty('autosaveAt');
    expect(stored.openedAt).toBeTypeOf('number');
  });

  it('requires a name and a ROM', () => {
    expect(() => store.createProject(root, { name: '  ', original: rom(1) })).toThrow(
      'projectNameRequired',
    );
    expect(() => store.createProject(root, { name: 'X' })).toThrow('projectRomMissing');
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('accepts names without letters or with accents', () => {
    expect(store.slugify('Sao Paulo / Sul-Americana')).toBe('sao-paulo-sul-americana');
    expect(store.slugify('Copa do Nordeste é top')).toBe('copa-do-nordeste-e-top');
    expect(store.slugify('!!!')).toBe('projeto');
  });

  it('renames and changes the description', () => {
    const meta = store.createProject(root, { name: 'Old', original: rom(1) }, 1000);
    const updated = store.updateProject(root, meta.id, { name: 'New', description: 'D' }, 5000);
    expect(updated).toMatchObject({ id: meta.id, name: 'New', description: 'D', updatedAt: 5000 });
    expect(store.listProjects(root)[0].name).toBe('New');
    expect(() => store.updateProject(root, meta.id, { name: '' })).toThrow('projectNameRequired');
  });

  it('duplicates the saved state without the auto-save', () => {
    const meta = store.createProject(root, { name: 'Base', original: rom(1), data: rom(2) });
    store.saveProjectAutosave(root, meta.id, rom(3));
    const copy = store.duplicateProject(root, meta.id, { name: 'Base (copia)' });
    expect(copy.id).not.toBe(meta.id);
    const loaded = store.loadProject(root, copy.id);
    expect(loaded.data[0]).toBe(2);
    expect(loaded.original[0]).toBe(1);
    expect(loaded.autosave).toBeNull();
    expect(loaded.meta.name).toBe('Base (copia)');
  });

  it('deletes a project', () => {
    const meta = store.createProject(root, { name: 'Gone', original: rom(1) });
    store.deleteProject(root, meta.id);
    expect(store.listProjects(root)).toEqual([]);
    expect(() => store.loadProject(root, meta.id)).toThrow('projectNotFound');
  });

  it('keeps an auto-save per project until it is saved or cleared', () => {
    const a = store.createProject(root, { name: 'A', original: rom(1) });
    const b = store.createProject(root, { name: 'B', original: rom(1) });
    store.saveProjectAutosave(root, a.id, rom(9));

    expect(store.loadProject(root, a.id).autosave[0]).toBe(9);
    expect(store.loadProject(root, b.id).autosave).toBeNull();
    expect(store.listProjects(root).find((p) => p.id === a.id).autosaveAt).toBeTypeOf('number');

    store.saveProjectRom(root, a.id, rom(9));
    expect(store.loadProject(root, a.id).autosave).toBeNull();

    store.saveProjectAutosave(root, b.id, rom(4));
    store.clearProjectAutosave(root, b.id);
    expect(store.loadProject(root, b.id).autosave).toBeNull();
  });

  it('ignores an auto-save of another size', () => {
    const meta = store.createProject(root, { name: 'A', original: rom(1) });
    store.saveProjectAutosave(root, meta.id, rom(9, 100));
    expect(store.loadProject(root, meta.id).autosave).toBeNull();
  });

  it('refuses ids that are not project folders', () => {
    for (const id of ['../x', '..', 'a/b', 'C:\\x', '', null, 'UPPER']) {
      expect(() => store.loadProject(root, id)).toThrow('projectNotFound');
      expect(() => store.deleteProject(root, id)).toThrow('projectNotFound');
    }
  });

  it('skips folders that are not projects', () => {
    fs.mkdirSync(path.join(root, 'junk'));
    fs.writeFileSync(path.join(root, 'junk', 'project.json'), '{not json');
    fs.mkdirSync(path.join(root, 'empty'));
    const meta = store.createProject(root, { name: 'Ok', original: rom(1) });
    expect(store.listProjects(root).map((p) => p.id)).toEqual([meta.id]);
  });

  it('finds the original ROM of a project by base CRC', () => {
    store.createProject(root, { name: 'A', original: rom(5), baseCrc: 'DEADBEEF' });
    expect(store.findOriginalByCrc(root, 'deadbeef')[0]).toBe(5);
    expect(store.findOriginalByCrc(root, '00000000')).toBeNull();
    expect(store.findOriginalByCrc(root, '')).toBeNull();
  });

  it('accepts Buffers and Uint8Arrays', () => {
    const meta = store.createProject(root, { name: 'Buf', original: Buffer.from(rom(3)) });
    expect(store.loadProject(root, meta.id).data[0]).toBe(3);
  });
});
