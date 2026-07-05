# ISS Forge

> **BETA** — This project is in beta. Features are being added and refined continuously.

![Status](https://img.shields.io/badge/status-beta-orange)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Visual ROM Editor for International Superstar Soccer (SNES, 1995)**

ISS Forge is a visual ROM editor for International Superstar Soccer on the Super Nintendo. It allows you to customize teams, players, uniforms, flags and more through an intuitive interface.

![ISS Forge](https://img.shields.io/badge/ISS_Forge-v0.1.0--beta-e67e22?style=for-the-badge)

---

## Features

- **Players** — Edit names, shirt numbers and attributes (shooting, speed, stamina, technique)
- **Hair & Skin** — Customize hair style and skin color (normal and special players)
- **Uniforms** — Full color editor (shirt, shorts, socks, goalkeeper) with real-time preview
- **Flags** — Pixel-by-pixel design editor + palette colors (4 indexed colors)
- **Flag Templates** — Library of ready-made templates + image import
- **Team Names** — Rename teams with automatic tile generation (scoreboard + selection screen)
- **Overview** — Visualize the full team squad
- **Compare** — Compare attributes between two teams
- **AI Generator** — Generate complete teams (players, uniforms, flag) via prompt with local or cloud LLM
- **Tile Explorer** — Browse and visualize SNES tile graphics stored in the ROM (raw + Konami LZ)
- **Import/Export** — Export and import team configurations as JSON
- **Auto-update** — Automatic updates via GitHub Releases
- **Auto-backup** — Backup before saving + session recovery
- **Undo/Redo** — Undo and redo changes
- **Themes** — Light and dark mode
- **Internationalization** — Portuguese (pt-BR) and English

## Download

Head to the [Releases](../../releases) page to download the latest version for your OS:

- **Windows** — `.exe` (NSIS installer)
- **macOS** — `.dmg`
- **Linux** — `.AppImage` / `.deb`

## Development

### Requirements

- Node.js 20+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/leandrolsouza/iss-forge.git
cd iss-forge

# Install dependencies
npm install

# Development mode (web only)
npm run dev

# Development mode (Electron + Vite)
npm run electron:dev
```

### Commands

```bash
# Web build
npm run build

# Electron build (generates installer)
npm run electron:build

# Tests (single run)
npm test

# Tests (watch mode)
npm run test:watch

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check
```

## Compatible ROMs

- International Superstar Soccer (SNES) — `.smc` / `.sfc` files
- Jikkyou World Soccer 2: Fighting Eleven (Japanese version)

## Tech Stack

| Technology | Usage |
|------------|-------|
| Electron 43 | Cross-platform desktop app |
| React 19 | User interface |
| Vite 8 | Build tooling |
| Vitest 4 | Unit testing |
| ESLint 9 | Linter (flat config) |
| Prettier 3 | Code formatting |
| electron-builder | Packaging |
| electron-updater | Auto-update |
| SNES 4bpp | Tile graphics decoding |
| Konami LZ | Data compression/decompression |

## Architecture

```
iss-forge/
├── electron/          # Electron main process (CommonJS)
├── src/
│   ├── components/    # React components (editors and panels)
│   ├── context/       # RomContext — central ROM state
│   ├── hooks/         # Custom hooks (useRomState, useRomHandlers)
│   ├── rom/           # ROM parsing/writing logic (pure JS, no React)
│   │   ├── readers/   # Read specific data from ROM buffer
│   │   ├── writers/   # Write modified data back to ROM buffer
│   │   └── __tests__/ # Unit tests for ROM logic
│   ├── services/      # Abstraction over Electron IPC
│   ├── utils/         # Generic helpers
│   ├── i18n/          # Locale files (en, pt-BR)
│   ├── theme/         # Theme provider (light/dark)
│   └── styles/        # CSS (one file per component)
├── issparser-main/    # Reference Java project (read-only)
└── docs/              # Documentation
```

- Electron ↔ React communication via IPC with context bridge
- ROM logic in `src/rom/` is pure JS — easy to unit test in isolation
- Reader/Writer pattern: each data domain has dedicated modules
- Single `RomContext` centralizes all ROM state

## AI Generator

ISS Forge includes an AI team generator supporting multiple providers:

- **OpenAI-Compatible (Local)** — LM Studio, Ollama, etc.
- **OpenAI** — GPT-4o, GPT-4o-mini
- **Claude (Anthropic)** — Claude 4 Sonnet, Opus, Haiku
- **Gemini (Google)** — Gemini 2.5 Pro, Flash
- **Grok (xAI)** — Grok 3
- **AWS Bedrock** — Claude via Bedrock

Describe the team you want in natural language and the AI generates players, uniforms, colors and flag.

## Credits

Based on the work of:

- **Rodrigo Mallmann Guerra** — ISS Studio (Java)
- **Esteban Fuentealba** — Web ISS Studio (Vue/WASM)
- **ProtonNoir** — Konami SNES Compressor/Decompressor
- **Equipe Puma** — ROM offset maps & research
- **Equipe Falcon Brasil** — Testing & documentation

## Roadmap

- [x] Player editor (names, numbers, attributes)
- [x] Uniform editor with color preview
- [x] Hair & skin editor
- [x] Flag editor (design + colors)
- [x] Flag templates + image import
- [x] Team name editor
- [x] Squad overview
- [x] Team comparison
- [x] Import/export teams (JSON)
- [x] AI team generator
- [x] Tile Explorer
- [x] Undo/Redo
- [x] Auto-update
- [x] Auto-backup
- [x] Internationalization (pt-BR / en)
- [x] Light/dark themes
- [ ] Multi-ROM version support

## License

MIT — see [LICENSE](LICENSE) for details.

---

> ISS Forge is not affiliated with Konami. International Superstar Soccer is a trademark of Konami.
