import { createRequire } from 'node:module';
import { describe, it, expect, vi } from 'vitest';
const require = createRequire(import.meta.url);
const {
  inspectRelease,
  warningBody,
  planMaintenance,
  applyPlan,
} = require('../../../scripts/release-maintenance');

function fixture(tag = 'v1.0.7', id = 7) {
  let nextId = id * 100;
  const assets = [];
  const manifests = new Map();
  for (const [name, extensions] of Object.entries({
    'latest.yml': ['exe'],
    'latest-mac.yml': ['zip', 'dmg'],
    'latest-linux.yml': ['AppImage', 'deb'],
  })) {
    const files = extensions.map((ext) => {
      const url = `iss-forge-${tag.slice(1)}.${ext}`;
      assets.push({ id: nextId++, name: url, size: 10, state: 'uploaded' });
      if (['exe', 'zip', 'dmg'].includes(ext))
        assets.push({ id: nextId++, name: `${url}.blockmap`, size: 2, state: 'uploaded' });
      return { url, size: 10, sha512: 'a'.repeat(86) + '==' };
    });
    const manifest = { id: nextId++, name, size: 20, state: 'uploaded' };
    assets.push(manifest);
    manifests.set(
      manifest.id,
      JSON.stringify({ version: tag.slice(1), files, path: files[0].url, sha512: files[0].sha512 }),
    );
  }
  return {
    release: {
      id,
      tag_name: tag,
      draft: false,
      prerelease: false,
      assets,
      body: 'Human release notes.',
    },
    read: (asset) => manifests.get(asset.id),
  };
}

describe('release maintenance', () => {
  it('keeps a complete release unchanged and preserves its human notes', () => {
    const { release, read } = fixture();
    const plan = planMaintenance([release], read, release.id);
    expect(plan.latest).toBe('v1.0.7');
    expect(plan.actions).toEqual([]);
    expect(release.body).toBe('Human release notes.');
  });

  it('flags missing Windows metadata and mismatched artifact names', () => {
    const { release, read } = fixture();
    release.assets = release.assets.filter((asset) => asset.name !== 'latest.yml');
    const zip = release.assets.find((asset) => asset.name.endsWith('.zip'));
    zip.name = zip.name.replaceAll('-', '.');
    const issues = inspectRelease(release, read);
    expect(issues).toContain('Missing or incomplete latest.yml');
    expect(issues.some((issue) => issue.includes('mismatched asset'))).toBe(true);
  });

  it('selects the highest complete stable SemVer and preserves drafts/prereleases', () => {
    const older = fixture('v1.0.9', 9);
    const newer = fixture('v1.0.10', 10);
    const broken = fixture('v1.0.11', 11);
    broken.release.assets = [];
    const draft = { ...fixture('v2.0.0', 20).release, draft: true };
    const beta = { ...fixture('v3.0.0-beta.1', 30).release, prerelease: true };
    const read = (asset) => older.read(asset) || newer.read(asset);
    const plan = planMaintenance(
      [draft, beta, broken.release, older.release, newer.release],
      read,
      9,
    );
    expect(plan.latest).toBe('v1.0.10');
    expect(plan.preserved).toEqual(['v2.0.0', 'v3.0.0-beta.1']);
    expect(plan.actions.find((action) => action.make_latest)).toMatchObject({
      id: 10,
      make_latest: 'true',
    });
    expect(plan.actions.some((action) => [20, 30].includes(action.id))).toBe(false);
  });

  it('adds one managed warning, removes it when resolved, and preserves manual notes', () => {
    const original = 'Human release notes.';
    const warned = warningBody(original, ['Missing latest.yml']);
    expect(warningBody(warned, ['Missing latest.yml'])).toBe(warned);
    expect(warningBody(warned, [])).toBe(original);
    expect(warningBody(warned, ['Missing ZIP'])).toContain('Human release notes.');
    expect(() => warningBody('<!-- iss-forge:release-health:start -->', [])).toThrow('Incomplete');
  });

  it('does not change Latest when no stable release is complete', () => {
    const { release } = fixture();
    release.assets = [];
    const plan = planMaintenance([release], vi.fn(), 7);
    expect(plan.latest).toBe(null);
    expect(plan.actions.every((action) => action.make_latest === undefined)).toBe(true);
  });

  it('aborts without a plan on network or malformed YAML errors', () => {
    const { release } = fixture();
    expect(() =>
      planMaintenance(
        [release],
        () => {
          throw new Error('GitHub unavailable');
        },
        7,
      ),
    ).toThrow('GitHub unavailable');
    expect(() => planMaintenance([release], () => 'files: [', 7)).toThrow();
  });

  it('only patches notes and Latest, with no delete/asset/tag operations', () => {
    const run = vi.fn(() => ({ tag_name: 'v1.0.7', draft: false, prerelease: false }));
    applyPlan(
      'owner/repo',
      {
        actions: [
          { id: 7, body: 'Warning' },
          { id: 8, tag: 'v1.0.8', make_latest: 'true' },
        ],
      },
      run,
    );
    expect(run.mock.calls.map(([args]) => args)).toEqual([
      ['api', '--method', 'PATCH', 'repos/owner/repo/releases/7', '--raw-field', 'body=Warning'],
      ['api', 'repos/owner/repo/releases/latest'],
      [
        'api',
        '--method',
        'PATCH',
        'repos/owner/repo/releases/8',
        '--raw-field',
        'make_latest=true',
      ],
    ]);
  });

  it('does not replace a newer release published during inspection', () => {
    const run = vi.fn(() => ({ tag_name: 'v1.0.9', draft: false, prerelease: false }));
    applyPlan(
      'owner/repo',
      { actions: [{ id: 8, tag: 'v1.0.8', make_latest: 'true' }], health: [] },
      run,
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toEqual(['api', 'repos/owner/repo/releases/latest']);
  });

  it('preserves notes edited by a human while inspection was running', () => {
    const run = vi.fn(() => ({ body: 'New human notes' }));
    expect(() =>
      applyPlan(
        'owner/repo',
        {
          actions: [
            { id: 7, tag: 'v1.0.7', body: 'Old notes with warning', expectedBody: 'Old notes' },
          ],
        },
        run,
      ),
    ).toThrow('Notes changed during inspection');
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toEqual(['api', 'repos/owner/repo/releases/7']);
  });
});
