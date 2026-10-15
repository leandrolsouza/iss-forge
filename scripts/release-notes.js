const semver = require('semver');

const START = '<!-- iss-forge:release-notes:start -->';
const END = '<!-- iss-forge:release-notes:end -->';
const HEALTH =
  /<!-- iss-forge:release-health:start -->[\s\S]*?<!-- iss-forge:release-health:end -->/g;

function changelogSection(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.match(/^## \[([^\]]+)\]/)?.[1] === version);
  if (start === -1) throw new Error(`Missing CHANGELOG.md section for ${version}`);
  const next = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  const section = lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join('\n')
    .trim()
    .replace(/\n*---\s*$/, '')
    .trim();
  if (!section) throw new Error(`Empty CHANGELOG.md section for ${version}`);
  return section;
}

function previousReleaseTag(releases, version) {
  return releases
    .filter((release) => {
      const previous = semver.valid(release.tag_name);
      return (
        !release.draft &&
        !release.prerelease &&
        previous &&
        !semver.prerelease(previous) &&
        semver.lt(previous, version)
      );
    })
    .sort((a, b) => semver.rcompare(a.tag_name, b.tag_name))[0]?.tag_name;
}

function buildReleaseNotes(changelog, version, repo, previousTag) {
  if (!semver.valid(version) || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    throw new Error('Invalid release notes version or repository');
  const tag = `v${version}`;
  const link = previousTag
    ? `https://github.com/${repo}/compare/${encodeURIComponent(previousTag)}...${encodeURIComponent(tag)}`
    : `https://github.com/${repo}/commits/${encodeURIComponent(tag)}`;
  return [
    START,
    "## What's Changed",
    '',
    changelogSection(changelog, version),
    '',
    `**Full Changelog**: ${link}`,
    END,
  ].join('\n');
}

function mergeReleaseNotes(currentBody, notes) {
  const body = currentBody || '';
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if ((start === -1) !== (end === -1) || (end !== -1 && end < start))
    throw new Error('Incomplete release-notes marker');
  if (start !== -1) {
    return body.slice(0, start) + notes + body.slice(end + END.length);
  }
  const warnings = body.match(HEALTH) || [];
  const remaining = body.replace(HEALTH, '').trim();
  // Backfill only empty/legacy link-only notes. Keep manually written notes and
  // GitHub's PR/contributor lists unless they contain our own managed block.
  if (
    remaining &&
    !/^\*\*Full Changelog\*\*:\s+https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:compare|commits)\/\S+$/.test(
      remaining,
    )
  )
    return body;
  return [notes, ...warnings].join('\n\n');
}

module.exports = { changelogSection, previousReleaseTag, buildReleaseNotes, mergeReleaseNotes };
