# Agent guidelines — ISS Forge

## Scope and context

These instructions apply throughout the repository. Subdirectory `AGENTS.md`
files supplement this guide with local rules. Explicit user instructions take
priority.

ISS Forge is a visual ROM editor for International Superstar Soccer (SNES,
1995), built with React, Vite, and Electron. ROM logic is JavaScript independent
of the UI. The supported format is the 1 MB European ROM, with or without a
512-byte copier header, including hacks that preserve the validated layout.

## Project map

| Path                 | Responsibility                                             | Guide                                        |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `src/`               | UI, state, services, translations, and utilities           | [src/AGENTS.md](src/AGENTS.md)               |
| `src/rom/`           | Reading, writing, compression, SNES rendering, and patches | [src/rom/AGENTS.md](src/rom/AGENTS.md)       |
| `electron/`          | Main process, preload, IPC, files, and credentials         | [electron/AGENTS.md](electron/AGENTS.md)     |
| `scripts/`           | Development, inspection tools, and releases                | [scripts/AGENTS.md](scripts/AGENTS.md)       |
| `research/`          | ROM maps, findings, and reverse engineering tools          | Consult the research for the affected domain |
| `game-translations/` | Exported game texts in EN and PT-BR                        | Preserve the import format                   |
| `.github/workflows/` | Tests, packaging, publishing, and release maintenance      | Check the scripts called by each workflow    |

## Setup and commands

Run commands from the repository root. Use Node.js 22 to match CI, and npm with
the existing `package-lock.json`. For a clean installation, CI uses
`npm ci --legacy-peer-deps`; do not reinstall dependencies unnecessarily.

| Command                                                 | Purpose                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `npm run dev`                                           | Vite web UI on port 5173                 |
| `npm run electron:dev`                                  | Vite and the Electron app                |
| `npm test`                                              | Full Vitest suite without watch mode     |
| `npm test -- src/rom/__tests__/PlayerReadWrite.test.js` | Example of a targeted test run           |
| `npm run lint`                                          | ESLint                                   |
| `npm run format:check`                                  | Prettier for files covered by the script |
| `npm run build`                                         | Renderer build in `dist/`                |
| `node scripts/release.js validate-package`              | Package version consistency              |

## Working practices

- Read nearby code and tests before changing behavior. Keep changes focused and
  preserve local changes unrelated to the task.
- Follow the existing style: JavaScript/JSX, 2-space indentation, semicolons,
  single quotes, and the ESLint and Prettier configurations. Do not introduce
  TypeScript, libraries, or broad reformatting unless the task requires them.
- Keep boundaries between the UI, ROM logic, and system operations. Reuse
  existing modules instead of duplicating binary rules or IPC calls.
- Use Portuguese when interacting with this project's user, and preserve the
  language and conventions of nearby identifiers and code comments.
- Update documentation when contracts or workflows change. Record changes
  intended for a release in `CHANGELOG.md`, following its existing structure.
- Do not edit generated output in `dist/`, `release/`, `release-assets/`, or
  `coverage/`, or dependencies in `node_modules/`. `issparser-main/` and
  `konami-compressor/` are local references, not application source code.
- Check `git ls-files` and `.gitignore` before adding files: `research/` contains
  tracked files, but new files are ignored by the current rule. Do not force-add
  ROMs, dumps, save states, personal data, or secrets.

## Validation and delivery

- For behavior changes, add or update tests that check outcomes and potential
  regressions. Use synthetic fixtures whenever possible.
- Run affected tests first. For code changes spanning application areas, also
  run `npm test` and `npm run build`, as CI does. Run lint and formatting checks
  for relevant code changes.
- For documentation-only changes, check paths, commands, links, and the diff;
  running the application test suite is unnecessary.
- Report what changed, which checks ran, and any actual limitations, such as
  missing local ROMs or an emulator needed to confirm behavior in the game.
  Do not present static inspection as an execution test.
- Creating tags, publishing releases, or changing remote releases requires the
  task to include that action; these are not routine validation steps.
