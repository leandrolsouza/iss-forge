# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Projects** (desktop) — keep several mods side by side ("Campeonato Brasileiro", "Premier League"...).
  Each project is a folder managed by the app (`<userData>/projects/<id>/`) with its own copy of the
  original ROM, the edited ROM and metadata. The start screen lists the projects (open, new, import, and
  per project rename/description, duplicate, export, delete); the sidebar shows what is open and closes it.
  While a project is open Ctrl+S saves into the project, "Save As" exports a ROM file and patches keep
  using the project's original ROM. A ROM file opened without a project can be turned into one, and
  opening loose ROM files keeps working as before
- Per-project auto-save: unsaved edits are kept in the project folder and offered when it is opened again
- **Project switcher** (File > Open Project, Ctrl+Shift+O, the Projects button of the title bar, or the
  project name in the sidebar): search, switch to another project (asks to save the current one first),
  new project, import, open a ROM file, back to the start screen
- The sidebar card shows where the session is saved: project folder, source ROM and last save (or the
  path of a loose ROM file), with "Open folder", "Export ROM" and "Create a project from this ROM"
- File menu: New / Open / Close Project; "Save Project" and "Export ROM" labels while a project is open
  ("Save As" suggests `<project name>.sfc`); Save, Patch and Emulator are disabled with nothing open
- Projects are listed by last use (opened or saved), with a search field from 6 projects on and the
  per-project actions always visible
- **Project files (.issproj)** — JSON with the name, description and a BPS patch from the original ROM:
  the ROM itself is not inside. Importing finds the original among the user's projects by CRC32, or asks
  for the ROM file
- **Player attributes** — every bit of the 6-byte player block is now editable: start speed, top speed
  without/with the ball, attacking/defensive duel strength and goalkeeper kick power
  (see `research/hidden-player-attributes.md`)
- The SPEED bar is computed like the game's DATA screen: `(2 × start + top + dribble) / 4`
- Team JSON format v2 with the new fields; v1 files are still imported
- **Tournaments tab** — edit the 32 International Cup / World Series draws (6 groups of 4). The editor
  blocks drafts that leave a selectable team out of every draw, which would freeze the game
  (see `research/tournaments.md`)
- **Game Texts tab** — translate the training texts (instructions, result comments, record, ranking
  messages, mode titles) with a preview of each box, and the texts of 19 menu screens (pre-match menu,
  rules, options, sound, password, tournament and training screens). See `research/game-texts.md`
- **Texts JSON export/import** — one file with every translatable text (training, menus, scenario texts,
  team descriptions). Partial files are accepted and accents are removed on import. What does not fit is
  left out and listed with the reason; the rest is imported as one undo step
- Menu screens that no longer fit in place are moved to free ROM space (bank-end padding or the slot
  left by another moved screen) and their load pointers are updated. When no single free area is big
  enough, all movable screens are re-arranged at once
- Translation strings accept `{name}` parameters

### Changed
- **Real previews** — Uniforms, Hair & Skin, Flag Colors and the Overview draw the team's player and
  goalkeeper with the game's own sprites (front and back), coloured with the team's kit, hair/skin and
  flag colours, updated on every edit; the flags are drawn from the real 24x16 design instead of 4
  stripes. The crest on the shirt uses the flag colours, as in a match (checked in the emulator)
- **Text previews in the game's fonts** — training texts, scenario texts, "Other screens", team
  descriptions (with their real colours) and the text layer of the menu screens are drawn with the
  game's 8x8 / 8x16 fonts and palettes instead of monospaced text
- **Pitch preview** — the grass is drawn with the match's own tiles and mowing pattern, in the edited
  colours (the lines are a plan view)
- **Restore original** buttons for each kit, hair & skin, flag colours, flag design, team names, each
  player, the team description and the menu texts
- **Predominant colour** of each team (decides which team changes kit) on the Uniforms tab, also in the
  team JSON and team copy
- Player editor marks repeated shirt numbers and empty names; search box in the training texts; Compare
  Teams also shows attack, defence, positions and numbers
- Settings that did nothing now work: confirm before overwriting the ROM, `.bak` copy of the previous
  file before saving, default folder for patches
- Status bar, save warnings, import errors, the About panel and the native Electron menus and dialogs
  follow the selected language
- `konamiCompress` now uses an optimal parse. It matches the size of Konami's own data, so edited menu
  screens fit back in place. The previous greedy encoder produced 2-5× larger tilemaps

### Fixed
- Menu texts: "1ST"/"2ND" in "1ST SEASON", "1ST STAGE" are drawn by the game itself and are no longer
  part of the editable text; a text can no longer grow into the next one ("TEMPO POR ETAPA3.5.7")
- Importing a texts file over an earlier import: menu texts are matched against the original ROM text
  ("text not found on the screen" warnings)
- Konami decompressor: the window ring wrapped one byte late in RLE runs (`>` instead of `>=`). No real
  block was affected
- Player attribute blocks (numbers, hair, stats) were read in the menu team order. The game uses the ROM
  ordinal order (Scotland = 5), so teams 5-24 showed the data of a neighbouring team
- The attribute formerly labelled "Speed" (byte 1, low nibble) is the goalkeeper kick power. The game only
  uses 0-7, so the editor now caps it at that range
- The shooting/technique bars in the player details now update right after an edit
- **Flag designs are written to the ROM at the end of each brush stroke** (they used to wait for the save).
  Copying/swapping a team no longer loses unsaved drawings, and the auto-save backup and the emulator
  test include them. A design that does not fit in the flag area is refused with a message instead of
  being silently dropped at save time
- **In-game (scoreboard) name** — the 32x8 graphic is now read from the ROM. Copy/swap and team JSON
  carry the exact tiles (format v3), so they no longer overwrite e.g. "GERMANY" with "GER". The editor
  shows the graphic, accepts names up to 32 pixels (about 7 letters) and reads back the text of graphics
  drawn with its font. Pre-v3 files, whose scoreboard name was always the first 3 letters of the menu
  name, get the full menu name
- Team name: the menu field shows when a name will be shortened to fit the name area, the status bar shows
  the name really written, and a rejected write leaves no undo step. The last name in the area could
  overflow it
- AI generator: applying a team is one undo step again (the flag created a second one)
- Restoring the auto-save backup keeps the unedited ROM as the "original" (patch base and restore
  buttons) and marks the session as modified. Undo/redo follow the saved point: undoing back to the last
  save clears "modified", redoing past it sets it again
- Formation tab: the number fields commit on Enter/blur (one undo step per edit, an emptied field keeps
  its value) instead of on every keystroke
- Undo/redo only re-read the data that changed, so an unapplied draft (scenario, texts, menus, draws,
  description, title screen) survives undoing an edit made in another tab
- A rejected write (scenario, texts, menu, description, title screen logo/background/texts) no longer
  leaves an empty undo step, and anything it moved in the ROM is put back
- Editing any team description no longer drops the colours inside the body of the 4 originals that
  colour player names; the "Defensive" title colour is labelled green (it was called yellow)
- The original ROM draws 12 flags from 4 shared designs (e.g. Germany, Holland, Austria and Russia):
  editing one silently changed the others. The edited team now gets its own copy, and the tab says so
- Super Star's goalkeeper uses Belgium's colours: both tabs warn and stay in sync after an edit
- The save warnings were shown before writing (and said "saved" even when the save failed)

---

## [0.1.0-beta] - 2025-01-01

### Added
- **ROM Parser** — core infrastructure for reading and writing ISS SNES ROM data ([`ad1e65a`](../../commit/ad1e65a))
- **Player Editor** — edit player stats, positions, formations, and team names with help tooltips ([`931e885`](../../commit/931e885))
- **Team Name Editor** — positional tile-based team name rendering and editing ([`931e885`](../../commit/931e885))
- **Uniform Editor** — edit team uniform colors with SNES 15-bit palette ([`931e885`](../../commit/931e885))
- **Flag Design Editor** — template selector with bulk design application across teams ([`9d52cfd`](../../commit/9d52cfd))
- **Flag Color Editor** — edit flag colors with bulk import operations ([`62828b3`](../../commit/62828b3))
- **Flag Image Import** — import custom flag images and convert to SNES tile format ([`62828b3`](../../commit/62828b3))
- **Hair & Skin Editor** — templates, special hair/skin options, and goalkeeper separation ([`a82210c`](../../commit/a82210c))
- **AI Team Generator** — generate team names and data using LM Studio or other LLM backends ([`652a964`](../../commit/652a964))
- **Multi-provider AI** — support for OpenAI, Claude, Gemini, Grok, Amazon Bedrock, and OpenAI-compatible endpoints with streaming ([`5c1812a`](../../commit/5c1812a))
- **Undo / Redo** — full history navigation with unsaved changes guard ([`d6d4364`](../../commit/d6d4364))
- **Auto-save & Backup** — automatic backup before save with recovery on next launch ([`d70bd9b`](../../commit/d70bd9b))
- **Team Selector** — dedicated component for switching between the 27 teams ([`9294fa4`](../../commit/9294fa4))
- **Recent ROMs** — track and quickly reopen recently used ROM files ([`f5b044b`](../../commit/f5b044b))
- **ROM loading overlay** — visual feedback during ROM parsing ([`2e14358`](../../commit/2e14358))
- **Auto-updater** — in-app update notifications and one-click install via GitHub Releases ([`a53ca40`](../../commit/a53ca40))
- **i18n** — UI internationalization with Portuguese (pt-BR) and English (en) support ([`263c928`](../../commit/263c928))
- **Team Compare** — side-by-side team comparison view ([`931e885`](../../commit/931e885))
- **KonamiCodec** — custom Konami encoding/decoding for player names ([`ad1e65a`](../../commit/ad1e65a))

### Changed
- Updated `react` and `react-dom` to 19.3.0
- Updated `prettier` to 3.9.6
- Updated `concurrently` to 10.0.5
- Updated `wait-on` to 9.1.0
- Updated `globals` to 17.12.0
- Updated `eslint-plugin-react-refresh` to 0.5.6
- Updated `@vitejs/plugin-react` to 6.1.1
- Updated `eslint` to 10.10.0 and `@eslint/js` to 10.0.1
- Updated `vitest` to 5.0.0
- Updated `electron-store` to 11.0.2
- Converted `electron/main.js` and `electron/aiProviders.js` from CommonJS to ESM (`.mjs`) to support `electron-store` v9+ which is ESM-only
- Added `fsModuleCache: true` to Vitest config for faster transform caching between runs

### Fixed
- Author email in `package.json` for Linux `.deb` packaging ([`1be95fe`](../../commit/1be95fe))
- Release workflow: use `--publish never` and manual upload to avoid conflicts ([`db87504`](../../commit/db87504))

### Infrastructure
- Electron + Vite + React project scaffold with custom titlebar ([`01b7021`](../../commit/01b7021))
- ESLint + Prettier configuration ([`35da440`](../../commit/35da440))
- Vitest test suite with coverage ([`932d5bb`](../../commit/932d5bb))
- GitHub Actions CI for tests and multi-platform releases (Windows, macOS, Linux) ([`a53ca40`](../../commit/a53ca40))

---

[0.1.0-beta]: ../../releases/tag/v0.1.0-beta
