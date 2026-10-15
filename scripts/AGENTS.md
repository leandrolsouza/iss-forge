# Guidelines for `scripts/`

Supplements the [root guide](../AGENTS.md).

## Conventions

- `.js` scripts in this directory use CommonJS. Preserve Node.js 22 compatibility
  and support for Windows, macOS, and Linux in development and CI flows.
- Run from the repository root or resolve paths explicitly. Do not introduce
  machine-specific absolute paths in shared tools.
- Prefer testable functions separated from the CLI entry point, following the
  existing release scripts. Do not trigger network access or remote mutations
  when importing a module.
- ROM inspection tools should work on copies, accept explicit paths when needed,
  and keep ROMs and local output out of version control.
- Do not run scripts merely to discover their effects: read the CLI entry point
  and distinguish inspection, file generation, and publishing.

## Releases

- Consult the release section of `README.md`, the scripts `release.js`,
  `release-notes.js`, `release-maintenance.js`, and `.github/workflows/` together.
- `node scripts/release.js validate-package` checks versions in `package.json`
  and `package-lock.json`. A release also requires a matching `v<version>` tag
  and a nonempty `## [version]` changelog section.
- Publishing changes must preserve validation of installers, blockmaps, and
  update manifests, including version, name, size, and SHA-512. Artifact names
  must match manifests and contain no spaces.
- Preserve complete uploads before publication and draft recovery after failures.
  Do not overwrite published releases or move their tags.
- Maintenance must preserve manual notes, tags, assets, and existing releases.
  Keep preview as the default; `--apply` changes remote state and should only
  be used when the task includes that change.
- Do not bump versions or create tags as a side effect of a fix.

## Validation

Release tests live in `src/services/__tests__/release*.test.js`. Run the tests
related to changed scripts. When changing workflows, also check commands,
permissions, and artifact contracts consumed by other jobs. Do not publish a
release to test a local change.
