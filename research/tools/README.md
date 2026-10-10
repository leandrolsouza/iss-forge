# Ferramentas de pesquisa

Scripts de apoio à engenharia reversa. **Não fazem parte do app.**

| Arquivo | Para quê |
|---------|----------|
| `disasm65816.mjs` | Disassembler 65816 mínimo (acompanha `REP`/`SEP`). Aceita offset de arquivo ou endereço SNES (`$00:ED41`). |
| `libretro-emu.cjs` | Frontend libretro headless (Node + koffi): roda um core sem janela, com controle, screenshots, save states e dump de WRAM. |
| `emu-seq.cjs` | Roteiro de botões/esperas/screenshots/dumps para o emulador (ver o cabeçalho do arquivo). |
| `cgram-match.cjs` | Lê o buffer de paletas (`$7E:3200`) de um dump de WRAM e localiza cada linha na ROM. |
| `png-crop.cjs` | Recorta e amplia um trecho de screenshot (ex.: inspecionar um sprite). |

## Dependências extras (só para o emulador)

```
npm install --no-save koffi pngjs
```

ou num diretório separado, apontando com `NODE_PATH`. Também é preciso um core libretro de SNES
(testado com `snes9x2010_libretro.dll` do RetroArch). O caminho padrão pode ser trocado com a variável
`ISS_CORE`.

## Exemplo: chegar numa partida CPU x CPU e salvar o estado

```
node research/tools/emu-seq.cjs "wait:600 START wait:400 A wait:150 DOWN DOWN A wait:150 A wait:120 A wait:150" prematch.st
FROM=prematch.st node research/tools/emu-seq.cjs "A wait:1300 A wait:200 A wait:200 A wait:400 shot:match dump:match"
node research/tools/cgram-match.cjs research/tools/emu-out/match.wram
```

Para testar uma ROM modificada, use `ROM=caminho/da/rom.sfc`. As saídas vão para
`research/tools/emu-out/`, que está no `.gitignore`.
