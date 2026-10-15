# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.5] - 2026-10-15

### Added

- Status bar update indicator with "Check for updates" button — shows live update state (checking, available, downloading, ready) directly in the bottom bar; clickable chips for available/downloaded states re-open the update toast

---

## [1.0.4] - 2026-10-15

### Changed

- Standardize editor and operation feedback with toast notifications

### Fixed

- Show errors for failed JSON imports, settings loads, ROM reads and flag image imports
- Toast notifications now appear above modals

---

## [1.0.3] - 2026-10-15

### Fixed
- Update error notification now shows the actual error message to aid diagnosis

---

## [1.0.2] - 2026-10-15

### Fixed
- Auto-update on Windows: download no longer fails on unsigned builds (code signature verification is now skipped)

---

## [1.0.1] - 2026-10-14

### Fixed
- App icon on Windows now displays the ISS Forge logo at all resolutions (16×16 to 256×256)

---

## [1.0.0] - 2026-10-14

Initial stable release of ISS Forge — a visual ROM editor for International Superstar Soccer (SNES, 1995).

### Editors

- **Player Editor** — edit all six bytes of each player block: name, shirt number, positions, formation,
  start speed, top speed (with/without ball), attacking/defensive duel strength and goalkeeper kick power.
  Marks repeated shirt numbers and empty names. The SPEED bar matches the game's own DATA screen formula.
- **Uniform Editor** — edit shirt, shorts, socks and goalkeeper colors with the SNES 15-bit palette.
  Shows the predominant color (used by the game to decide which team changes kit).
- **Flag Design Editor** — pixel-by-pixel 24×16 tile editor with template selector and bulk application.
  Shared designs (e.g. Germany/Austria) are automatically split so editing one team does not affect another.
- **Flag Color Editor** — edit flag palette colors with bulk import across teams.
- **Hair & Skin Editor** — templates, special hair/skin options and goalkeeper separation.
- **Team Name Editor** — positional tile-based rendering; shows when a name will be shortened and warns
  about overflow. Includes the in-game scoreboard name (32×8 graphic, up to ~7 letters).
- **Tournaments Tab** — edit the 32 International Cup / World Series group draws (6 groups of 4).
  Blocks drafts that would leave a selectable team out of every draw, which freezes the game.
- **Game Texts Tab** — translate training instructions, result comments, record/ranking messages, mode
  titles and 19 menu screens (pre-match, rules, options, sound, password, tournament, training).
  Menu screens that no longer fit in place are relocated to free ROM space automatically.
  Texts accept `{name}` parameters. Preview renders with the game's own 8×8 / 8×16 fonts and palettes.

### Visuals

- **Real sprite previews** — Uniforms, Hair & Skin, Flag Colors and the Overview draw the team's player
  and goalkeeper with the game's own sprites (front and back), colored with the team's kit, hair/skin and
  flag colors. Flags are drawn from the actual 24×16 design. The crest uses flag colors as in a match.
- **Pitch preview** — grass drawn with the match's own tiles and mowing pattern in the edited colors.
- **Text previews** — training texts, scenario texts, menu screens and team descriptions rendered with the
  game's fonts and palettes.

### Projects

- **Projects** — keep several mods side by side ("Campeonato Brasileiro", "Premier League" …).
  Each project is a folder under `<userData>/projects/` with its own original ROM, edited ROM and metadata.
- **Start screen** — list, open, create, import and manage projects (rename, duplicate, export, delete).
- **Project switcher** — File › Open Project, Ctrl+Shift+O, the title-bar button or the sidebar card.
  Searches and switches between projects (asks to save current work first).
- **Project files (.issproj)** — JSON containing name, description and a BPS patch from the original ROM.
  The ROM itself is not bundled; importing matches by CRC32 or asks for the file.
- **Per-project auto-save** — unsaved edits are preserved in the project folder and offered on reopen.
- Ctrl+S saves into the project; "Export ROM" writes a standalone file; "Save As" suggests `<name>.sfc`.
  Opening a loose ROM file still works as before and can be turned into a project at any time.

### Import / Export

- **Team JSON (v3)** — export and import a full team configuration including the scoreboard name graphic.
  v1 and v2 files are still accepted on import.
- **Texts JSON** — export and import every translatable text (training, menus, scenario texts, team
  descriptions) in one file. Partial files are accepted; accents are removed; what doesn't fit is listed.
- **Flag Image Import** — import a custom image and convert it to the SNES tile format.
- **Restore original** buttons for each kit, hair & skin, flag colors, flag design, team names, each
  player, team description and menu texts.

### Other Features

- **AI Team Generator** — generate team names and player data via LM Studio or any OpenAI-compatible
  backend. Supports OpenAI, Claude, Gemini, Grok, Amazon Bedrock and custom endpoints with streaming.
- **Undo / Redo** — full history with unsaved-changes guard. Undo/redo only re-reads changed data, so
  an unapplied draft survives edits made in another tab. Undoing back to the last save clears "modified".
- **Team Compare** — side-by-side view of stats, attack, defence, positions and shirt numbers.
- **Auto-updater** — in-app update notifications and one-click install via GitHub Releases.
- **i18n** — UI available in Portuguese (pt-BR) and English. All native menus and dialogs follow the
  selected language.
- **Recent ROMs** and quick-reopen from the File menu.
- Confirm-before-overwrite, `.bak` backup before save and configurable default patch folder now work.

### Compatible ROMs

- International Superstar Soccer (`.smc` / `.sfc`)
- Jikkyou World Soccer 2: Fighting Eleven (Japanese version)

---

[1.0.5]: ../../releases/tag/v1.0.5
[1.0.4]: ../../releases/tag/v1.0.4
[1.0.3]: ../../releases/tag/v1.0.3
[1.0.2]: ../../releases/tag/v1.0.2
[1.0.1]: ../../releases/tag/v1.0.1
[1.0.0]: ../../releases/tag/v1.0.0
