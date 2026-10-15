import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
const require = createRequire(import.meta.url);
const {
  changelogSection,
  previousReleaseTag,
  buildReleaseNotes,
  mergeReleaseNotes,
} = require('../../../scripts/release-notes');

const changelog =
  '# Changelog\r\n\r\n## [Unreleased]\r\n- Future feature\r\n\r\n---\r\n\r\n## [1.1.0] - 2026-10-15\r\n\r\n### Added\r\n\r\n- Stadium preview\r\n- Crowd presets\r\n\r\n---\r\n\r\n## [1.0.7]\r\n\r\n### Fixed\r\n\r\n- Version consistency\r\n';

describe('release notes from the changelog', () => {
  it('extracts only the exact version and retains categories and bullet points', () => {
    expect(changelogSection(changelog, '1.1.0')).toBe(
      '### Added\n\n- Stadium preview\n- Crowd presets',
    );
    expect(() => changelogSection(changelog, '1.1.1')).toThrow('Missing CHANGELOG.md section');
    expect(() => changelogSection('## [1.1.0]\n\n---\n\n## [1.0.7]\n- Old fix', '1.1.0')).toThrow(
      'Empty',
    );
  });

  it('creates a meaningful feed description with a comparison link', () => {
    const notes = buildReleaseNotes(changelog, '1.1.0', 'owner/repo', 'v1.0.7');
    expect(notes).toContain("## What's Changed\n\n### Added");
    expect(notes).toContain('- Stadium preview');
    expect(notes).toContain('https://github.com/owner/repo/compare/v1.0.7...v1.1.0');
    expect(notes).not.toContain('Future feature');
    expect(notes).not.toContain('Version consistency');
  });

  it('compares against a published stable release, skipping failed tags, drafts and prereleases', () => {
    const releases = [
      { tag_name: 'v1.0.10' },
      { tag_name: 'v1.0.9' },
      { tag_name: 'v1.0.11', draft: true },
      { tag_name: 'v2.0.0-beta', prerelease: true },
      { tag_name: 'v2.0.0' },
    ];
    expect(previousReleaseTag(releases, '1.1.0')).toBe('v1.0.10');
    expect(previousReleaseTag(releases, '0.1.0')).toBeUndefined();
    expect(buildReleaseNotes('## [0.1.0]\n- Initial release', '0.1.0', 'owner/repo')).toContain(
      '/commits/v0.1.0',
    );
  });

  it('fills link-only notes while preserving the update-health warning', () => {
    const warning =
      '<!-- iss-forge:release-health:start -->\nKnown update issue\n<!-- iss-forge:release-health:end -->';
    const old =
      '**Full Changelog**: https://github.com/owner/repo/compare/v1.0.6...v1.0.7\n\n' + warning;
    const notes = buildReleaseNotes(changelog, '1.0.7', 'owner/repo', 'v1.0.5');
    const result = mergeReleaseNotes(old, notes);
    expect(result).toContain('Version consistency');
    expect(result).toContain(warning);
    expect(mergeReleaseNotes(result, notes)).toBe(result);
  });

  it('preserves human notes and GitHub PR/contributor lists', () => {
    for (const body of [
      'Upgrade instructions written by a maintainer',
      "## What's Changed\n- PR #15 by @author\n\n## New Contributors\n- @author",
    ]) {
      expect(mergeReleaseNotes(body, 'Generated notes')).toBe(body);
    }
  });

  it('refreshes only its own block and rejects incomplete markers', () => {
    const before = buildReleaseNotes(changelog, '1.0.7', 'owner/repo', 'v1.0.5');
    const after = buildReleaseNotes(changelog, '1.1.0', 'owner/repo', 'v1.0.7');
    expect(mergeReleaseNotes('Manual preface\n\n' + before + '\n\nManual footnote', after)).toBe(
      'Manual preface\n\n' + after + '\n\nManual footnote',
    );
    expect(() => mergeReleaseNotes('<!-- iss-forge:release-notes:start -->', after)).toThrow(
      'Incomplete',
    );
  });
});
