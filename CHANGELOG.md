# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
