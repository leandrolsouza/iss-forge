# Pesquisa: tela inicial (logo, PRESS START, copyright)

> Status: **implementado no editor** (aba "Tela Inicial") e **validado em jogo** com snes9x
> (`research/tools/emu-seq.cjs`): cores, times dos jogadores, textos e logo importado aparecem como na
> prévia (a prévia do editor bate pixel a pixel com o emulador, salvo 48 pixels da névoa do gramado).
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

## Sequência

- Quadros ~0-600: logo da Konami (lista de carga `$82:8021`).
- ~600: a pincelada vermelha é pintada, o logo entra deslizando pela direita, pisca (passos de brilho) e
  some; o gramado, os jogadores e o PRESS START aparecem (~760). Depois de ~1300 quadros entra a partida
  de demonstração (Alemanha x Itália, não depende desta tela).
- Código: `$80:8CD5` (montagem), `$80:8D08` (jogadores), `$80:8E62` (objeto do logo), `$80:8F0A`
  (PRESS START piscando a cada 32 quadros).

## Camadas

| Camada | Conteúdo | VRAM | Origem |
|--------|----------|------|--------|
| BG1 4bpp | pincelada (paleta 7) + gramado (paletas 2-3) | mapa `$1000`, tiles `$2000` | `0x67E6E` (mapa), `0xBE106` + `0x49CE1` (tiles) |
| BG3 2bpp | copyright (paleta 0) + PRESS START (paleta 1) | mapa `$5C00`, tiles `$5000` | `0xD43C8` (mapa), `0x7F81B` (fonte simples) + `0xD44A9` (fonte sombreada) |
| OBJ | logo (paletas 2, 3 e 7), jogadores, bola | base `$6000` | `0xF71C8` (tiles do logo), lista `0xF7B25` |

- Listas de carga (banco `$82`): `$82:804C` (fonte simples), `$82:8178` (8 blocos da tela) e `$82:8038`
  (lista de sprites do logo). Formato VRAM: `00 00` e entradas `[destino word, ponteiro 24 bits]` até `FF`.
- Entrada `FE ptr destino|8000` (em `$82:8038`): descomprime para `$7E:B000` e `$80:965C` expande a lista
  de sprites para `$7E:5000` (7 bytes por sprite: dx word, dy word, tile, attr, tamanho).
- Gramado: colour math soma uma cor fixa por linha (névoa nas linhas 112-127, +1 até o fim). A prévia usa
  a tabela medida (`HAZE` em `titleScreen.js`).

## Paletas (descritores `$81:8800`-`$8830`, só desta tela)

Lista inicial `$81:8A44`. Os passos do brilho do logo estão em `$81:811C`: listas `8A5C`, `8A60`, `8A64`
(passos), `8A76` (logo escondido na cor do céu) e `8A68` (gramado + logo normal).

| O quê | Arquivo | Cores | CGRAM |
|-------|---------|-------|-------|
| Céu (backdrop) | `0x2D49E` | 1 | BG 0 cor 0 |
| Copyright | `0x2D4A0` | 3 | BG 0 cores 1-3 (paleta BG3 0) |
| PRESS START | `0x2D4A8` | 3 | BG 0 cores 5-7 (paleta BG3 1) |
| Gramado | `0x2DCF5` | 30 | BG 2-3 (bloco próprio, não é o da partida) |
| Pincelada | `0x2D4FE` | 15 | BG 7 |
| INTERNATIONAL | `0x2D4C0` | 15 | OBJ 10 (cor 15 = contorno, comando `$8001` = 1 × preto) |
| SUPERSTAR SOCCER | `0x2D4DE` | 15 | OBJ 11 (idem) |
| Brilho do logo (3 passos) | `0x2D53A`, `0x2D578`, `0x2D5B6` | 30 cada | OBJ 10-11 |
| TM | `0x2D520` | 12 | OBJ 15 cores 4-15 (antes, comando `$8003`) |
| "Céu" das entradas | `0x2D5F4` | 15 | cinza = céu: esconde gramado, jogadores e logo |

- Palavras com o bit 15 ligado são comandos: `$80nn` escreve `nn` cores pretas (`$80:AD7F`). O tamanho do
  blob conta as cores escritas, então trocar `$8001` por uma cor comum não muda o tamanho.
- O editor copia a cor do céu para `0x2D5F4` e move os passos de brilho junto com as cores do logo
  (mantém a diferença de cada canal).

## Jogadores

- `$80:8D18`: `LDA #$0002 / STA $1720` (jogador da esquerda) e `LDA #$0026 / STA $1770` (direita): ordinal ×
  2 (Itália = 1, Brasil = 19). Bytes `0x0D19` e `0x0D1F`.
- Usam o primeiro uniforme, cabelo e pele do time (OBJ 8-9 = bloco de cabelo/pele + uniforme). A
  partida de demonstração não muda.
- Os tiles dos jogadores vêm sem compressão (`0x5E846`...); a prévia usa a posição deles capturada da OAM
  (`titleScreenLayout.js`).

## Textos

- **Fonte sombreada** (`0xD44A9`, tiles BG3 `0x00`-`0x1F`): espaço, A-Z = 1-26, `.` `1` `5` `9` `©`.
  O bloco também é carregado por outras 3 listas (`0x10285`, `0x1029C`, `0x10883`): não é alterado.
- **Fonte simples** (`0x7F81B`, tiles `0x20`-`0x5F` em ordem ASCII): só esta tela e o aviso de região
  (`$80:835F`) carregam. As outras telas recarregam a fonte (corromper o bloco não estragou menu, seleção
  etc.). O editor desenha ali, no estilo sombreado, os caracteres extras do copyright (dígitos e
  pontuação). Regra das letras da Konami: linha 0 = cor 2, 1 = cor 1, 2-4 = cor 3, 5 = cor 1, 6-7 = cor 2
  (a forma é a mesma da fonte simples, salvo T, Y, `.` e `5`).
- **Copyright:** mapa BG3 `0xD43C8` (ponteiro `0x1019F`), linhas 24-26, centralizadas.
- **PRESS START:** string em `$81:8645` = `[endereço VRAM word] [tiles] FF` (`$5DCA` = linha 14, coluna
  10). Lida por `LDX #$8645` em `$80:8F2E` (esta tela) e `$80:84B5` (outra tela com a mesma fonte), por
  isso só usa a fonte sombreada. Até 11 letras ficam no lugar original; maiores vão para o fim do banco
  `$81` (`0xFFDD`-`0xFFFF`, tirado do espaço livre dos menus) e os dois ponteiros mudam.
- Mapa e fonte simples entram em `MENU_SCREENS` (movidos para o espaço livre quando não cabem).

## Logo

- Lista `0xF7B25` (Konami): `[01] [n word] [n]` e 4 vetores de `n` bytes: dx, dy (relativos a (128, 112)),
  tile, attr. attr: bit 4 = 16x16, bits 1-3 = paleta (o objeto faz OR com a paleta 2), bit 0 = bit 8 do
  tile, bit 7 = espelho vertical. O original tem 107 sprites, que reaproveitam tiles.
- Tiles `0xF71C8` (3936 bytes = 123 tiles) carregados em `$6700` (OBJ `0x70`-`0xEA`).
- Achado com `research/tools` + corrupção de fatias da ROM comparando a WRAM `$7E:5000` (não a tela),
  a partir de um estado salvo antes da montagem (quadro 600).
- **Logo importado:** grade de blocos 16x16 (o deslocamento da grade com menos células é escolhido);
  bloco com 3-4 células = sprite 16x16, senão sprites 8x8; tiles iguais são reaproveitados. Duas paletas de
  até 15 cores (2-médias sobre os blocos + median cut). Tiles em OBJ `0x60`-`0x17F` (livres nesta tela,
  carga em `$6600`). Os dois blocos precisam caber juntos na área original `0xF71C8`-`0xF7CAA` (2786
  bytes); quando não cabem, o editor baixa as cores por paleta (modo automático). O TM original pode ser
  mantido (paleta 7). Opção de esconder a pincelada (pintada com a cor do céu).
- Limite prático: um logo do tamanho e detalhe do original cabe com ~10 cores por paleta; imagens
  grandes e cheias precisam de menos cores ou de um tamanho menor (até 72 sprites 16x16 de tiles).

## Ideias / pendências

- Editar os desenhos da pincelada e do gramado (BG1).
- Liberar mais espaço para logos grandes (expandir a ROM ou mover blocos de outras telas).
- Sprites dos jogadores (quadros de animação em `0x5E846`...).
