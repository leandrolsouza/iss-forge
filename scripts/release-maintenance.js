const fs = require('node:fs');
const semver = require('semver');
const yaml = require('js-yaml');
const { gh } = require('./release');
const {
  changelogSection,
  previousReleaseTag,
  buildReleaseNotes,
  mergeReleaseNotes,
} = require('./release-notes');

const START = '<!-- iss-forge:release-health:start -->';
const END = '<!-- iss-forge:release-health:end -->';
const MANIFESTS = {
  'latest.yml': ['.exe'],
  'latest-mac.yml': ['.zip', '.dmg'],
  'latest-linux.yml': ['.AppImage', '.deb'],
};

function stableVersion(release) {
  const version = semver.valid(release.tag_name);
  return !release.draft && !release.prerelease && version && !semver.prerelease(version)
    ? version
    : null;
}

function inspectRelease(release, readManifest) {
  const issues = [];
  const assets = new Map(release.assets.map((asset) => [asset.name, asset]));
  for (const [name, extensions] of Object.entries(MANIFESTS)) {
    const manifest = assets.get(name);
    if (!manifest || manifest.state !== 'uploaded' || manifest.size <= 0) {
      issues.push(`Missing or incomplete ${name}`);
      continue;
    }
    // Network and parsing errors abort the run. They must never turn a temporary
    // GitHub outage into a permanent warning on a healthy release.
    const info = yaml.load(readManifest(manifest));
    if (
      info?.version !== stableVersion(release) ||
      !Array.isArray(info?.files) ||
      !info.files.length
    ) {
      issues.push(`Invalid version or file list in ${name}`);
      continue;
    }
    for (const extension of extensions) {
      if (
        !info.files.some((file) => typeof file.url === 'string' && file.url.endsWith(extension))
      ) {
        issues.push(`Missing ${extension} entry in ${name}`);
      }
    }
    for (const file of info.files) {
      const asset = assets.get(file.url);
      if (!asset || asset.state !== 'uploaded' || asset.size <= 0 || asset.size !== file.size) {
        issues.push(`Missing or mismatched asset referenced by ${name}: ${String(file.url)}`);
      }
      if (typeof file.sha512 !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)) {
        issues.push(`Missing or invalid SHA-512 in ${name}: ${String(file.url)}`);
      }
      if (/\.(exe|zip|dmg)$/.test(file.url)) {
        const blockmap = assets.get(`${file.url}.blockmap`);
        if (!blockmap || blockmap.state !== 'uploaded' || blockmap.size <= 0) {
          issues.push(`Missing or incomplete blockmap: ${String(file.url)}.blockmap`);
        }
      }
    }
    if (info.path !== info.files[0].url || info.sha512 !== info.files[0].sha512) {
      issues.push(`Inconsistent legacy fields in ${name}`);
    }
  }
  return issues;
}

function warningBody(body, issues) {
  const original = body || '';
  const start = original.indexOf(START);
  const end = original.indexOf(END);
  // Refuse to edit an ambiguous marker instead of overwriting hand-written notes.
  if ((start === -1) !== (end === -1) || (end !== -1 && end < start)) {
    throw new Error('Incomplete release-health marker in release notes');
  }
  const clean =
    start === -1 ? original : original.slice(0, start).trimEnd() + original.slice(end + END.length);
  if (!issues.length) return start === -1 ? original : clean;
  const warning = [
    START,
    '> **Automatic update warning:** This release has incomplete or inconsistent update assets.',
    '> Use the latest complete stable release for installation and updates.',
    '',
    ...issues.map((issue) => `- ${issue.replace(/[\r\n]/g, ' ')}`),
    END,
  ].join('\n');
  return `${clean.trimEnd()}${clean.trimEnd() ? '\n\n' : ''}${warning}`;
}

function planMaintenance(releases, readManifest, currentLatestId, notesConfig) {
  const health = releases.filter(stableVersion).map((release) => ({
    release,
    issues: inspectRelease(release, readManifest),
  }));
  const complete = health
    .filter((item) => !item.issues.length)
    .sort((a, b) => semver.rcompare(stableVersion(a.release), stableVersion(b.release)));
  const latest = complete[0]?.release;
  const actions = health.flatMap(({ release, issues }) => {
    let base = release.body;
    if (notesConfig) {
      const version = stableVersion(release);
      // Missing historical entries are left alone. Existing entries must be
      // nonempty, just like the publish-time validation requires.
      const hasEntry = notesConfig.changelog
        .split(/\r?\n/)
        .some((line) => line.match(/^## \[([^\]]+)\]/)?.[1] === version);
      if (hasEntry) {
        changelogSection(notesConfig.changelog, version);
        base = mergeReleaseNotes(
          base,
          buildReleaseNotes(
            notesConfig.changelog,
            version,
            notesConfig.repo,
            previousReleaseTag(releases, version),
          ),
        );
      }
    }
    const body = warningBody(base, issues);
    return body === (release.body || '')
      ? []
      : [{ id: release.id, tag: release.tag_name, body, expectedBody: release.body || '' }];
  });
  if (latest && latest.id !== currentLatestId) {
    actions.push({ id: latest.id, tag: latest.tag_name, make_latest: 'true' });
  }
  return {
    latest: latest?.tag_name || null,
    actions,
    health: health.map(({ release, issues }) => ({ tag: release.tag_name, issues })),
    preserved: releases
      .filter((release) => !stableVersion(release))
      .map((release) => release.tag_name),
  };
}

function applyPlan(repo, plan, run = gh) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Invalid repository');
  for (const { id, tag, body, expectedBody, make_latest: latest } of plan.actions) {
    // Only edit notes and the Latest designation. Never change release type,
    // publish a draft, delete releases/tags, or modify any installer/blockmap.
    const fields = [];
    if (body !== undefined) {
      if (expectedBody !== undefined) {
        const current = run(['api', `repos/${repo}/releases/${id}`], true);
        if ((current.body || '') !== expectedBody)
          throw new Error(`Notes changed during inspection for ${tag}; retry maintenance`);
      }
      fields.push('--raw-field', `body=${body}`);
    }
    if (latest !== undefined) {
      // Do not undo a newer release published while inspection was running,
      // unless that release was itself inspected and found incomplete.
      const current = run(['api', `repos/${repo}/releases/latest`], true);
      const knownBroken = plan.health?.some(
        (item) => item.tag === current.tag_name && item.issues.length,
      );
      if (
        stableVersion(current) &&
        semver.gt(stableVersion(current), semver.valid(tag)) &&
        !knownBroken
      )
        continue;
      fields.push('--raw-field', `make_latest=${latest}`);
    }
    run(['api', '--method', 'PATCH', `repos/${repo}/releases/${id}`, ...fields]);
  }
}

function summary(plan, apply) {
  return [
    `# Release maintenance (${apply ? 'apply' : 'preview'})`,
    '',
    `Latest complete stable release: ${plan.latest || 'none; Latest unchanged'}`,
    '',
    ...plan.health.map(
      ({ tag, issues }) =>
        `- ${tag}: ${issues.length ? issues.join('; ') : 'update assets consistent'}`,
    ),
    '',
    `Drafts, prereleases and non-SemVer releases preserved: ${plan.preserved.length}.`,
    `Planned changes to notes/Latest: ${plan.actions.length}. No releases, tags or assets deleted.`,
    '',
    'Checks compare published names, sizes and manifest fields; binaries are not downloaded or rehashed.',
    '',
  ].join('\n');
}

if (require.main === module) {
  try {
    const repo = process.env.GH_REPO;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('GH_REPO is required');
    const apply = process.argv.includes('--apply');
    const releases = gh(
      ['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`],
      true,
    ).flat();
    const latest = releases.some(stableVersion)
      ? gh(['api', `repos/${repo}/releases/latest`], true)
      : null;
    const plan = planMaintenance(
      releases,
      (asset) =>
        gh([
          'api',
          `repos/${repo}/releases/assets/${asset.id}`,
          '-H',
          'Accept: application/octet-stream',
        ]),
      latest?.id,
      { repo, changelog: fs.readFileSync('CHANGELOG.md', 'utf8') },
    );
    const report = summary(plan, apply);
    console.log(report);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
    if (apply) applyPlan(repo, plan);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { inspectRelease, warningBody, planMaintenance, applyPlan, summary };
