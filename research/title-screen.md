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
- **Pose:** `LDY #quadro` antes de `JSL $83:D536` (`$83:D3DC` guarda Y em `$3C,X`, com DB = `$82`):
  `$80:8D9A` (`0x0D9B`, esquerda, objeto `$0E80`) e `$80:8D5A` (`0x0D5B`, direita, objeto `$0DE0`).
  Original: `$82:C1DC` (cabeceio, esquerda) e `$82:C1A8` (direita).
- **Quadro de animação** (banco `$82`, os mesmos da partida): `[lista word] [ponteiro A 24 bits]
  [ponteiro B 24 bits]`. A lista fica no banco `$88` (`n`, depois `n` × `[dy, dx, tile, attr]`; attr:
  bit 4 = 16x16, bit 5 = paleta + 4, bit 6 = espelho horizontal, bit 7 = vertical; o bit 3 é comum e não
  muda a paleta). Cada ponteiro aponta para `[tamanho word] + tiles 4bpp sem compressão`, copiados por
  DMA para a linha de tiles OBJ do objeto (esquerda `0x40`/`0x50`, direita `0x20`/`0x30`).
- Os registros ficam entre `$82:BC00` e `$82:F2E0` (`0x13C00`-`0x172E0`), misturados com outros dados: o
  editor procura os que passam nas validações (ponteiros nos bancos `$88`-`$9F`, tamanhos múltiplos de 32,
  tiles dentro das 2 linhas, posições razoáveis): 866 quadros. Escolher outro quadro só muda o `LDY`; a
  partida não muda.
- Objetos: esquerda x = `0x72`, paleta 0; direita x = `0x90`, paleta 1, espelhada (x = origem − dx −
  tamanho). Pés em y = `0xB0`. A bola e as sombras são objetos à parte (seção "Bola, sombras e posições").
- Linhas OBJ 12-13: cores de goleiro dos dois times (11 cores do bloco de goleiro), usadas pelas peças
  com o bit 5.

- **Tile extra do quadro** (`$83:D472`): depois dos 2 DMAs, a word seguinte do registro escolhe 1 tile
  (32 bytes) carregado no tile 7 da segunda linha (`0x37` / `0x57`): 0 = tile vazio (`$82:AB27`);
  positivo = tabela + 3 × ordinal do time (detalhe por time); negativo = tabela +
  deslocamento do jogador (0 à esquerda, `0x2D` à direita, com `$56,X` = 0). Peças que usam tiles além do
  que o quadro carrega mostram o que outro quadro deixou na VRAM: o editor descarta esses quadros (864
  sobram).
- **Escudo no peito (out/2026):** nos quadros de frente o detalhe por time é o escudo da camisa (águia da
  Alemanha, distintivo do Brasil, listras da Argentina). A peça tem o bit 5 (linhas 12-13) e usa as cores
  12-15. Na partida essas 4 cores são as **cores da bandeira** do time: o CGRAM de 3 dumps
  (`emu-out/match.wram`, `walesmatch.wram`, `scotmatch.wram`) bate com as entradas de `0x2DD91`, e a
  tabela `0x9486` (logo depois dos ponteiros das bandeiras; words do banco `$85` por ordinal) aponta para
  `[0x0007] [4 cores]` de cada time. A tela inicial não carrega essas cores (preenche `0x739C`), então lá
  o escudo sai cinza. **Conferido no emulador (out/2026):** com as 4 cores da Alemanha trocadas por rosa
  (`0x2DD91`), o escudo da camisa ficou rosa na demonstração (cor 12 só no peito; as cores 13-15 também
  pintam a bandeira do placar). A prévia do editor (`playerPreview.js`) usa as cores da bandeira.
- **Goleiros:** os registros `$82:E3EA`-`$82:F02A` são quadros de goleiro (8 bytes, sem a word do tile
  extra; o editor lê a word seguinte mesmo assim, mas nenhum dos quadros usados nas prévias usa o tile
  `0x17`). Os pixels usam as cores 1-11 da paleta de goleiro (1 cabelo, 2-4 pele, 5-9 camisa e meião,
  10 calção, 11 sombra).
- **Quadros das prévias** (`PREVIEW_POSES` em `playerPreview.js`): `$82:C203` (de pé, de frente),
  `$82:C22A` (de costas), `$82:E41A` e `$82:E3EA` (goleiro de frente e de costas).
- **Uniforme:** `$80:ADB3` compara a cor predominante dos dois times (`$81:8DB2[ordinal]`); se for igual, o
  jogador da direita (time 2) usa o segundo uniforme (Itália x França, Alemanha x Inglaterra, Brasil x
  Brasil...).

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

## Bola, sombras e posições

Os valores são operandos de `LDA #imm` no código da tela (`$80:8D24`-`$8DDA`). Um objeto com handler 0
não é executado e não aparece (testado: menu e partida de demonstração continuam normais).

| O quê | Objeto | Arquivo (operando) | Original |
|-------|--------|--------------------|----------|
| Sombra do jogador da direita | `$1660` | x `0x0D28`, y `0x0D2D`, handler `0x0D32` | `0x90`, `0xB6`, `$80E2` |
| Jogador da direita | `$0DE0` | x `0x0D44` | `0x90` |
| Sombra do jogador da esquerda | `$16A0` | x `0x0D68`, y `0x0D6D`, handler `0x0D72` | `0x70`, `0xB6`, `$80E2` |
| Jogador da esquerda | `$0E80` | x `0x0D84` | `0x72` |
| Bola | `$0480` | x `0x0DA8`, chão `0x0DB0`, altura `0x0DB8`, handler `0x0DCA` | `0x84`, `0xBA`, `-54`, `$805D` |
| Sombra da bola | `$1620` | mesmo x / chão da bola, handler `0x0DCF` | `$806C` |
| Pés dos dois jogadores | `$80:8DDD` | y `0x0DE5` | `0xB0` |

- Sprites (conferidos na OAM): sombra da esquerda = tiles `0x187` em (x − 8, y) e `0x188` em (x, y);
  da direita, espelhada, `0x187` em (x, y) e `0x188` em (x − 8, y); sombra da bola `0x1B0` em (x − 4, chão −
  3); bola `0x1A0` em (x − 4, chão + altura − 7).
- A sombra da bola diminui com a altura: tiles `0xBED2B` + 32 × tamanho, tamanho = (altura − 1) / 48,
  limitado a 2 (até 48 px = maior, até 96, acima).
- O copyright e o PRESS START (BG3 com prioridade) ficam por cima de todos os sprites.

## Fundo (BG1)

- Mapa `0x67E6E` (ponteiro `0x1019A`, 380 bytes + 22 de `FF`) e tiles `0xBE106` (ponteiro `0x1017C`,
  1533 bytes, 85 tiles): só esta tela usa. Os dois entram em `MENU_SCREENS` (podem mudar de lugar).
- Linhas 0-13: pincelada (tiles 1-`0x54`, paleta BG 7), revelada por uma janela que abre da esquerda para a
  direita (`$1944` sobe de `0x14` até `0xFE`, `$80:8E3E`). Qualquer imagem nessa área aparece com a mesma
  cortina.
- Linhas 14-27: gramado, um padrão de 8 × 4 células com os tiles `0xDC`-`0xEA` (paletas 2-3) do bloco
  `0x49CE1`, que outras 2 listas também carregam (`0x10075`, `0x10639`). Ele é carregado depois do bloco
  da tela, então os tiles `0xDC`-`0xEA` nunca são usados por imagens novas.
- VRAM livre para BG1 nesta tela: tiles `0x55`-`0x2FF` (até `$5000`, onde começa a BG3).
- Tile 0 = vazio (o céu aparece). Sem gramado, a névoa do colour math não aparece no céu.
- **Editor:** cada parte pode ficar como está, voltar ao original, ser removida ou receber uma imagem. A
  área da pincelada usa 1 paleta de 15 cores (paleta 7); o gramado, imagem inteira (256 × 112) ou textura
  repetida (16, 32 ou 64 px), com 2 paletas de 15 cores (uma por célula). Tiles iguais, inclusive
  espelhados, são reaproveitados. As cores baixam sozinhas até os blocos caberem (no lugar ou no espaço
  livre dos menus).

## Ideias / pendências
- Liberar mais espaço para logos grandes (expandir a ROM ou mover blocos de outras telas).
- Desenhar quadros novos para os jogadores (precisa de espaço para tiles e de um registro novo no banco
  ``; os quadros existentes são compartilhados com a partida).
