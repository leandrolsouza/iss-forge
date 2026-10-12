import { describe, it, expect } from 'vitest';
import {
  buildProjectArchive,
  parseProjectArchive,
  restoreProjectArchive,
  isArchiveBase,
  romBaseCrc,
  bytesToBase64,
  base64ToBytes,
  projectArchiveFileName,
  PROJECT_ARCHIVE_FORMAT,
} from '../projectArchive';
import en from '../../i18n/en';
import ptBR from '../../i18n/pt-BR';

function makeRom(size = 64 * 1024, seed = 1) {
  const rom = new Uint8Array(size);
  let x = seed;
  for (let i = 0; i < size; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    rom[i] = x >>> 24;
  }
  return rom;
}

function withHeader(rom) {
  const out = new Uint8Array(rom.length + 512);
  out.set(rom, 512);
  return out;
}

const project = {
  name: 'Campeonato Brasileiro',
  description: 'Serie A 2026',
  romFileName: 'ISS.sfc',
};

describe('projectArchive', () => {
  it('round-trips a project through the file', () => {
    const original = makeRom();
    const data = original.slice();
    data[100] = 0x42;
    data.set([1, 2, 3, 4], 5000);

    const file = buildProjectArchive({ project, original, data });
    const archive = parseProjectArchive(file);
    expect(archive.project).toEqual(project);
    expect(archive.baseCrc).toBe(romBaseCrc(original));
    expect(archive.baseSize).toBe(original.length);

    const restored = restoreProjectArchive(archive, original);
    expect(restored.original).toEqual(original);
    expect(restored.data).toEqual(data);
  });

  it('does not carry the ROM, only the changes', () => {
    const original = makeRom(256 * 1024);
    const data = original.slice();
    data[10] = data[10] ^ 0xff;
    const file = buildProjectArchive({ project, original, data });
    expect(file.length).toBeLessThan(2048);
  });

  it('works with a copier header on either side', () => {
    const original = makeRom();
    const data = original.slice();
    data[7] = 0x99;
    const archive = parseProjectArchive(
      buildProjectArchive({ project, original: withHeader(original), data: withHeader(data) }),
    );
    expect(isArchiveBase(archive, original)).toBe(true);
    expect(isArchiveBase(archive, withHeader(original))).toBe(true);
    const restored = restoreProjectArchive(archive, original);
    expect(restored.data).toEqual(data);
  });

  it('refuses another base ROM', () => {
    const original = makeRom();
    const archive = parseProjectArchive(buildProjectArchive({ project, original, data: original }));
    const other = makeRom(original.length, 99);
    expect(isArchiveBase(archive, other)).toBe(false);
    expect(() => restoreProjectArchive(archive, other)).toThrow('projectArchiveWrongBase');
  });

  it('rejects files that are not projects', () => {
    expect(() => parseProjectArchive('not json')).toThrow('projectArchiveInvalid');
    expect(() => parseProjectArchive('{"format":"iss-forge-team"}')).toThrow(
      'projectArchiveInvalid',
    );
    expect(() =>
      parseProjectArchive(JSON.stringify({ format: PROJECT_ARCHIVE_FORMAT, version: 1 })),
    ).toThrow('projectArchiveInvalid');
    expect(() =>
      parseProjectArchive(
        JSON.stringify({ format: PROJECT_ARCHIVE_FORMAT, version: 99, patch: '', base: {} }),
      ),
    ).toThrow('projectArchiveVersion');
  });

  it('rejects a corrupted patch', () => {
    const original = makeRom();
    const data = original.slice();
    data[1] = 0;
    const json = JSON.parse(
      new TextDecoder().decode(buildProjectArchive({ project, original, data })),
    );
    const patch = base64ToBytes(json.patch);
    patch[patch.length - 20] ^= 0xff;
    json.patch = bytesToBase64(patch);
    const archive = parseProjectArchive(JSON.stringify(json));
    expect(() => restoreProjectArchive(archive, original)).toThrow('projectArchiveInvalid');
  });

  it('encodes base64 of large buffers', () => {
    const bytes = makeRom(200_000, 7);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('suggests a safe file name', () => {
    expect(projectArchiveFileName('Premier League')).toBe('Premier League.issproj');
    expect(projectArchiveFileName('A/B: "C"?')).toBe('AB C.issproj');
    expect(projectArchiveFileName('')).toBe('projeto.issproj');
  });

  it('has messages for every error in both languages', () => {
    for (const key of [
      'projectArchiveInvalid',
      'projectArchiveVersion',
      'projectArchiveWrongBase',
      // errors of the projects store (electron/projects.mjs)
      'projectNotFound',
      'projectNameRequired',
      'projectRomMissing',
    ]) {
      expect(en[key], `en.${key}`).toBeTypeOf('string');
      expect(ptBR[key], `pt-BR.${key}`).toBeTypeOf('string');
    }
  });
});
