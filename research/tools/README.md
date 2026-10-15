# Ferramentas de pesquisa

Scripts de apoio à engenharia reversa. **Não fazem parte do app.**

| Arquivo | Para quê |
|---------|----------|
| `disasm65816.mjs` | Disassembler 65816 mínimo (acompanha `REP`/`SEP`). Aceita offset de arquivo ou endereço SNES (`$00:ED41`). |
| `libretro-emu.cjs` | Frontend libretro headless (Node + koffi): roda um core sem janela, com controle, screenshots, save states, dump de WRAM e VRAM (`vram()`) e `poke(addr, bytes)` para escrever na WRAM (testes A/B em valores vivos). |
| `emu-seq.cjs` | Roteiro de botões/esperas/screenshots/dumps (`dump:` WRAM, `vram:` VRAM) para o emulador (ver o cabeçalho do arquivo). |
| `cgram-match.cjs` | Lê o buffer de paletas (`$7E:3200`) de um dump de WRAM e localiza cada linha na ROM. |
| `png-crop.cjs` | Recorta e amplia um trecho de screenshot (ex.: inspecionar um sprite). |
| `png-montage.cjs` | Junta vários screenshots numa grade, para ver uma partida inteira de uma vez. |
| `png-find-color.cjs` | Conta pixels de cores exatas e lista os frames onde mais aparecem. Serve para achar onde uma cor de teste, pintada na ROM, aparece no jogo. |
| `rom-corrupt.cjs` | Copia a ROM com um trecho embaralhado (XOR). Carregando um save state com essa ROM, mostra se o que está na tela vem daquele trecho (busca binária: 16 fatias de 64 KB, depois de 4 KB, de 256 bytes). |
| `screen-recipe.mjs` | Lê um save state do snes9x (VRAM, CGRAM, registradores, HDMA) e acha as listas de carga do banco `` e os descritores de paleta do banco `` que montam aquela tela (receita do visualizador de telas, ver `../screen-viewer.md`). |
| `screen-check.mjs` | Desenha as receitas de `SCREEN_VIEWS` (`src/rom/screenView.js`) e compara com screenshots do emulador; grava `check_<id>.png` (editor, emulador, diferenças). |
| `ext-loader.mjs` | Hook do Node (`--import`) para os scripts importarem os módulos do app, cujos imports não têm extensão. |
| `wram-corrupt-search.cjs` | Mesma busca, mas compara bytes da WRAM em vez da tela: acha dados que o jogo descomprime/expande na WRAM (ex.: a lista de sprites do logo em `$7E:5000`, ver `../title-screen.md`). Use um estado salvo antes da tela ser montada. |
| `scene-capture.mjs` | Recorta um retângulo dos mapas BG2/BG1 de um save state da partida (`node scene-capture.mjs estado.st x0 y0 colunas linhas nome`, coordenadas do BG2 em pixels), acha na ROM os tiles crus trocados durante o jogo e confere que o desenho só com a ROM é idêntico (`diffPixels: 0`). Gera `nome.json`. |
| `scene-gen.mjs` | Junta `stand.json` e `goal120.json` em `src/rom/matchScenes.js` (cenas das prévias de Estádio e Torcida). |

## Técnica usada nas paletas

1. Pinte um bloco de cores da ROM com cores chapadas (vermelho, amarelo, verde, magenta).
2. Rode a partida e salve vários frames.
3. Use `png-find-color.cjs` para achar os frames com essas cores e `png-montage.cjs` para olhar.

Cuidado: a partida não é idêntica entre execuções com ROMs diferentes, então compare sempre pela cor, não
pelo número do frame.

## Dependências extras (só para o emulador)

```
npm install --no-save koffi pngjs
```

ou num diretório separado, apontando com `NODE_PATH`. Também é preciso um core libretro de SNES
(testado com `snes9x2010_libretro.dll` do RetroArch). O caminho padrão pode ser trocado com a variável
`ISS_CORE`.

## Exemplo: chegar no menu pré-jogo (1P x CPU) e salvar o estado

Os botões precisam ficar pressionados por alguns quadros (`hold:BTN:10`). Com toques curtos, o jogo cai na
partida de demonstração, que serve para testes CPU x CPU, mas não para os menus.

```
node research/tools/emu-seq.cjs "wait:300 hold:START:10 wait:100 hold:START:10 wait:150 hold:A:10 wait:150 hold:START:10 wait:200 hold:A:10 wait:150 hold:A:10 wait:150 hold:A:10 wait:150 hold:A:10 wait:200" premenu.st
FROM=premenu.st node research/tools/emu-seq.cjs "DOWN wait:20 hold:A:10 wait:150 shot:data"   # tela Substituting (quadro DATA)
FROM=premenu.st node research/tools/emu-seq.cjs "hold:A:10 wait:900 hold:A:10 wait:300 hold:A:10 wait:300 hold:A:10 wait:300" kickoff.st   # moeda → partida
```

## Exemplo: outras telas a partir do menu principal

Com um save state no menu principal (cursor em OPEN GAME), por exemplo `mainmenu.st`. Um estado salvo com
a ROM original funciona com uma ROM traduzida (`ROM=...`), porque as telas seguintes são carregadas de novo.

```
FROM=mainmenu.st node research/tools/emu-seq.cjs "hold:UP:10 wait:30 hold:A:10 wait:150 hold:UP:8 wait:40 hold:A:10 wait:150 shot:joy hold:R:10 wait:60 shot:joy_lob"   # Opções > Joypad controls (R troca a ajuda)
FROM=mainmenu.st node research/tools/emu-seq.cjs "hold:DOWN:10 wait:30 hold:DOWN:10 wait:30 hold:DOWN:10 wait:30 hold:DOWN:10 wait:30 hold:A:10 wait:200 shot:scen"   # Cenários (placar e relógio)
FROM=mainmenu.st node research/tools/emu-seq.cjs "hold:DOWN:10 wait:30 hold:A:10 wait:200 hold:A:10 wait:200 hold:A:10 wait:200 shot:group"   # International Cup: grupo (NEXTGAME)
FROM=mainmenu.st node research/tools/emu-seq.cjs "hold:UP:10 wait:30 hold:UP:10 wait:30 hold:A:10 wait:200 shot:pw"   # Password (Digitar senha)
```

Nos menus com cursor, cada `hold:DOWN` precisa de uma espera depois (`wait:30` ou mais); segurar por
muitos quadros faz o cursor repetir.

O menu principal é uma exceção: o objeto do menu guarda o ponteiro de cada lista de sprites, então um
estado salvo nele com outra ROM mostra lixo. Para conferir o menu, ligue o jogo do zero:

```
ROM=traduzida.sfc node research/tools/emu-seq.cjs "wait:300 hold:START:10 wait:200 hold:START:10 wait:200 shot:menu" menu_pt.st
```

Para ver a OAM num dump de WRAM: o buffer fica em `$01E0`-`$03DF` de trás para frente (byte `k` =
`WRAM[0x3DF − k]`) e a tabela alta em `$03E0`.

## Exemplo: partida de demonstração (CPU x CPU) e paletas

```
node research/tools/emu-seq.cjs "wait:600 START wait:400 A wait:150 DOWN DOWN A wait:150 A wait:120 A wait:150" demo.st
FROM=demo.st node research/tools/emu-seq.cjs "A wait:1300 A wait:200 A wait:200 A wait:400 shot:match dump:match"
node research/tools/cgram-match.cjs research/tools/emu-out/match.wram
```

Para testar uma ROM modificada, use `ROM=caminho/da/rom.sfc`. As saídas vão para
`research/tools/emu-out/`, que está no `.gitignore`.

## Endereços úteis na partida (WRAM)

| Endereço | Conteúdo |
|----------|----------|
| `$0520 + i*0xA0` | objeto do jogador `i` (0-10 time 1, 11-21 time 2); `+$14` estado, `+$44` velocidade-alvo, `+$66` velocidade atual, `+$50..$59` atributos (ver `hidden-player-attributes.md`) |
| `$0502` | objeto que está com a bola (0 = ninguém) |
| `$04B6` | Y da bola (`$0380` = meio-campo) |
| `$7E:A010` / `$7E:A5B0` | fichas dos 15 jogadores de cada time (`0x60` bytes cada) |

### Estabilidade (bugs corrigidos no frontend)

Os crashes aleatórios (`0xC0000005`) tinham três causas, todas corrigidas em `libretro-emu.cjs`:

- **Leitura do framebuffer:** a última linha do framebuffer é mais curta que o `pitch`, e ler
  `pitch × altura` lia memória além do fim. Esta era a causa principal.
- **Strings temporárias:** texto entregue ao core (`path` do jogo, diretórios) era liberado logo depois da
  chamada, com o core ainda guardando o ponteiro. Agora o `path` é um buffer mantido vivo, e os diretórios
  não são informados.
- **Buffer da ROM:** o buffer e os callbacks precisam continuar vivos enquanto o core roda (`_keepAlive`).
