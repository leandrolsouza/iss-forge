import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const {
  validateVersion,
  validateAssets,
  publish,
  manifestName,
} = require('../../../scripts/release.js');
let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'iss-release-'));
  vi.stubEnv('GH_REPO', 'owner/repo');
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function fixture(platform, channel = 'latest', version = '1.0.6') {
  const extensions = { windows: ['exe'], macos: ['zip', 'dmg'], linux: ['AppImage', 'deb'] }[
    platform
  ];
  const files = extensions.map((ext) => {
    const name = `iss-forge-${version}-x64.${ext}`;
    const data = Buffer.from(name);
    fs.writeFileSync(path.join(directory, name), data);
    if (platform !== 'linux')
      fs.writeFileSync(path.join(directory, `${name}.blockmap`), 'blockmap');
    return {
      url: name,
      size: data.length,
      sha512: createHash('sha512').update(data).digest('base64'),
    };
  });
  fs.writeFileSync(
    path.join(directory, manifestName(platform, channel)),
    yaml.dump({ version, files, path: files[0].url, sha512: files[0].sha512 }),
  );
  return files;
}

describe('release integrity gates', () => {
  it('requires matching semver tags, package and lockfile versions, including rc channels', () => {
    const pkg = { version: '1.0.6-rc.1' };
    const lock = { version: pkg.version, packages: { '': pkg } };
    expect(validateVersion('v1.0.6-rc.1', pkg, lock)).toEqual({
      version: pkg.version,
      channel: 'rc',
    });
    expect(() => validateVersion('v1.0.6', pkg, lock)).toThrow('must match');
    expect(() => validateVersion('vgarbage', pkg, lock)).toThrow('Invalid release tag');
    expect(() => validateVersion('1.0.6-rc.1', pkg, lock)).toThrow('Invalid release tag');
  });

  it('rejects missing Windows metadata, wrong hashes and missing installers', () => {
    expect(() => validateAssets(directory, 'windows', '1.0.6', 'latest')).toThrow();
    const [file] = fixture('windows');
    fs.writeFileSync(path.join(directory, file.url), Buffer.alloc(file.size));
    expect(() => validateAssets(directory, 'windows', '1.0.6', 'latest')).toThrow('SHA-512');
    fs.unlinkSync(path.join(directory, file.url));
    expect(() => validateAssets(directory, 'windows', '1.0.6', 'latest')).toThrow();
  });

  it('reports stale lockfile versions even when tag and package.json match', () => {
    const pkg = { version: '1.0.6' };
    for (const lock of [
      { version: '1.0.5', packages: { '': pkg } },
      { version: pkg.version, packages: { '': { version: '1.0.5' } } },
      { version: pkg.version },
    ]) {
      expect(() => validateVersion('v1.0.6', pkg, lock)).toThrow('versions must match');
    }
    expect(() =>
      validateVersion('v1.0.6', pkg, {
        version: '1.0.5',
        packages: { '': { version: '1.0.5' } },
      }),
    ).toThrow('package-lock.json=1.0.5');
  });

  it('rejects missing differential blockmaps and mismatched versions', () => {
    const [file] = fixture('windows');
    expect(() => validateAssets(directory, 'windows', '1.0.7', 'latest')).toThrow(
      'Invalid update manifest',
    );
    fs.unlinkSync(path.join(directory, `${file.url}.blockmap`));
    expect(() => validateAssets(directory, 'windows', '1.0.6', 'latest')).toThrow();
  });

  it('rejects names rewritten by GitHub or differing from the manifest', () => {
    const [file] = fixture('windows');
    fs.copyFileSync(
      path.join(directory, file.url),
      path.join(directory, file.url.replaceAll('-', '.')),
    );
    fs.unlinkSync(path.join(directory, file.url));
    expect(() => validateAssets(directory, 'windows', '1.0.6', 'latest')).toThrow();
    const metadata = path.join(directory, 'latest.yml');
    const info = yaml.load(fs.readFileSync(metadata, 'utf8'));
    info.files[0].url = '../installer.exe';
    fs.writeFileSync(metadata, yaml.dump(info));
    expect(() => validateAssets(directory, 'windows', '1.0.6', 'latest')).toThrow(
      'Unsafe release asset name',
    );
  });

  it('publishes rc metadata as a prerelease without marking it latest', () => {
    expect(manifestName('windows', 'rc')).toBe('latest.yml');
    for (const platform of ['windows', 'linux', 'macos']) fixture(platform, 'rc', '1.0.6-rc.1');
    const run = vi.fn((args) => {
      if (args[0] === 'api') return [[]];
      if (args[1] === 'view')
        return {
          assets: fs
            .readdirSync(directory)
            .map((name) => ({ name, size: fs.statSync(path.join(directory, name)).size })),
        };
    });
    publish(directory, 'v1.0.6-rc.1', '1.0.6-rc.1', 'rc', run);
    expect(run.mock.calls.find(([args]) => args[1] === 'create')[0]).toContain('--prerelease');
    expect(run.mock.calls.at(-1)[0]).toEqual(['release', 'edit', 'v1.0.6-rc.1', '--draft=false']);
  });

  it('cannot create a release when any platform is incomplete', () => {
    fixture('linux');
    fixture('macos');
    const run = vi.fn();
    expect(() => publish(directory, 'v1.0.6', '1.0.6', 'latest', run)).toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it('reuses a draft and refuses to publish if uploaded assets are missing', () => {
    for (const platform of ['windows', 'linux', 'macos']) fixture(platform);
    const run = vi.fn((args) => {
      if (args[0] === 'api') return [[{ tag_name: 'v1.0.6', draft: true }]];
      if (args[1] === 'view') return { assets: [] };
    });
    expect(() => publish(directory, 'v1.0.6', '1.0.6', 'latest', run)).toThrow('uploaded asset');
    expect(run.mock.calls.some(([args]) => args[1] === 'create')).toBe(false);
    expect(run.mock.calls.some(([args]) => args[1] === 'edit')).toBe(false);
  });

  it('publishes only after confirming every uploaded file and never overwrites a published release', () => {
    for (const platform of ['windows', 'linux', 'macos']) fixture(platform);
    const run = vi.fn((args) => {
      if (args[0] === 'api') return [[]];
      if (args[1] === 'view')
        return {
          assets: fs
            .readdirSync(directory)
            .map((name) => ({ name, size: fs.statSync(path.join(directory, name)).size })),
        };
    });
    publish(directory, 'v1.0.6', '1.0.6', 'latest', run);
    expect(run.mock.calls.at(-1)[0]).toEqual([
      'release',
      'edit',
      'v1.0.6',
      '--draft=false',
      '--latest',
    ]);
    run.mockImplementation(() => [[{ tag_name: 'v1.0.6', draft: false }]]);
    expect(() => publish(directory, 'v1.0.6', '1.0.6', 'latest', run)).toThrow('already published');
  });
});
