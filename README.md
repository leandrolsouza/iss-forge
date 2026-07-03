# ISS Forge

> **⚠️ BETA** — This project is in beta. Features are being added and refined continuously.

![Status](https://img.shields.io/badge/status-beta-orange)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**ROM Editor for International Superstar Soccer (SNES, 1995)**

ISS Forge is a visual ROM editor for International Superstar Soccer on the Super Nintendo. It allows you to customize teams, players, uniforms, flags and more through an intuitive interface.

![ISS Forge](https://img.shields.io/badge/ISS_Forge-v0.1.0--beta-e67e22?style=for-the-badge)

---

## Features

- ✏️ **Player names** — Edit all player names
- 🔢 **Shirt numbers** — Change player numbering
- 📊 **Attributes** — Modify speed, shot, defense and other stats
- 💇 **Hair & skin** — Customize hair style and skin color
- 👕 **Uniforms** — Full color editor (shirt, shorts, socks, goalkeeper)
- 🏳️ **Flags** — Pixel-by-pixel design editor + flag colors
- 🏷️ **Team names** — Rename teams with automatic tile generation
- 👁️ **Preview** — Visualize changes before saving
- 🔄 **Compare** — Compare stats between teams

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

# Run in development mode (web)
npm run dev

# Run in development mode (Electron)
npm run electron:dev
```

### Build

```bash
# Web build
npm run build

# Electron build (generates installer)
npm run electron:build
```

## Compatible ROMs

- International Superstar Soccer (SNES) — `.smc` / `.sfc` ROM files
- Jikkyou World Soccer 2: Fighting Eleven (Japanese version)

## Tech Stack

| Technology | Usage |
|------------|-------|
| Electron | Cross-platform desktop app |
| React | User interface |
| Vite | Build tooling |
| SNES 4bpp | Graphics tile decoding |
| Konami LZ | Data compression/decompression |

## Credits

Based on the work of:

- **Rodrigo Mallmann Guerra** — ISS Studio (Java)
- **Esteban Fuentealba** — Web ISS Studio (Vue/WASM)
- **ProtonNoir** — Konami SNES Compressor/Decompressor
- **Equipe Puma** — ROM offset maps & research
- **Equipe Falcon Brasil** — Testing & documentation

## Roadmap (Beta)

- [x] Player editor (names, numbers, attributes)
- [x] Uniform editor with color preview
- [x] Hair & skin editor
- [x] Flag editor (design + colors)
- [x] Team name editor
- [x] Full team preview
- [x] Team comparison
- [x] Import/export team configurations (JSON)
- [ ] Multi-ROM version support
- [ ] Full undo/redo

## License

MIT — see [LICENSE](LICENSE) for details.

---

> ISS Forge is not affiliated with Konami. International Superstar Soccer is a trademark of Konami.
