# Guidelines for `src/rom/`

Supplements the [root](../../AGENTS.md) and [src/](../AGENTS.md) guides.

## Architecture and compatibility

- Keep logic in JavaScript independent of React, the DOM, Electron, networking,
  and filesystem access.
- `RomParser.js` is the byte-access facade and delegates operations to
  specialized modules. Use `readers/`, `writers/`, and existing domain modules.
- Consult `constants.js`, `romCompatibility.js`, `romValidator.js`, and the
  corresponding research in `research/` before introducing offsets or formats.
- The supported layout has `0x100000` ROM bytes, optionally preceded by a
  `0x200`-byte copier header. The title or whole-file CRC alone cannot establish
  compatibility; preserve engine and pointer validation.
- Do not expand compatibility to another region, expanded ROM, or relocated data
  without layout evidence and corresponding tests.

## Safe writes

- Distinguish file offsets, SNES addresses, and WRAM/VRAM addresses. Document
  the source of new addresses and apply `headerOffset` exactly once. Prefer
  parser access methods when the module receives a parser.
- Respect buffer, slot, table, pointer, and compressed-block boundaries.
  Validate capacity before writing; an invalid operation must not leave partial
  changes or overwrite neighboring data.
- Preserve bits and bytes unrelated to the edited field, including hidden
  attributes. Account for palettes, flags, and other blocks shared between teams.
- Keep the original loaded copy (`originalData`) intact; it is used for
  restoration and as the default patch base.
- Preserve SNES conventions for colors, tiles, transparency, endianness, and
  Konami compression. Reuse existing codecs and converters.
- Recalculate the checksum and its complement after the final write and before
  saving/exporting the ROM or generating a patch, through the existing flow.

## Tests and evidence

- Place tests in `__tests__/` and run relevant files from the repository root
  with `npm test -- src/rom/__tests__/<file>.test.js`.
- Prefer `Uint8Array` and synthetic fixtures, including
  `__tests__/compatibilityFixture.js` when a valid layout is needed. Do not make
  tests depend on commercial ROMs available only on this machine.
- For write changes, check reading after writing, boundaries, preservation of
  neighboring and shared data, invalid inputs, and ROMs with and without headers
  where applicable.
- For patches, compression, and restoration, verify reconstructed bytes; for
  graphics, also check relevant palettes and tile indices.
- A correct preview does not establish correct game behavior. For new maps or
  graphical changes, record emulator evidence when available and distinguish
  hypotheses, automated tests, and confirmation in the game.
