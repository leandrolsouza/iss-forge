# Pesquisa: visualizador de telas

> Status: **implementado no editor** (aba "Visualizador de Telas", `src/rom/screenView.js`) e **conferido
> contra o emulador**: cada receita foi tirada de um save state do snes9x e a tela desenhada pelo editor
> bate com o screenshot (`research/tools/screen-check.mjs`), salvo sprites e textos que o jogo desenha
> sem posição conhecida.
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

## Como uma tela é montada

- **Listas de carga** (banco `$82`, arquivo `0x10000`-`0x17FFF`): `00 00` + `[destino VRAM word]
  [ponteiro 24]` ou `01 00` + `[destino WRAM 24][ponteiro 24]`, terminadas por `FF`. Os blocos são
  comprimidos (Konami). Os destinos WRAM usados pelas telas são os buffers de tilemap: `$7E:4390` →
  VRAM `$1800` (BG3) e `$7E:4B90` → `$1C00` (segunda metade). As telas de menu (`MENU_SCREENS`) são
  carregadas assim, e o editor atualiza esses descritores quando move uma tela: o visualizador segue.
- **Paletas** (banco `$81`): descritor de 3 bytes `[word do blob no banco $85][deslocamento em bytes na
  tabela $81:86F3]` (a tabela tem os endereços do buffer de CGRAM, `$7E:3200` = cor 0; 0, 2, 4... = linhas
  0, 1, 2...). O loader `$80:ACF0`: **a word de tamanho conta bytes menos 1** (o laço roda enquanto ela
  fica ≥ 0), pula a cor 0 de cada linha depois da primeira, e uma word com o bit 15 escreve (byte baixo)
  cores pretas. Antes o editor lia o tamanho como número de cores (`readCgramBlob` lia o dobro, entrando
  no blob seguinte; corrigido).
- **PPU** (lido do save state): todas as telas de menu usam o modo 1 com prioridade do BG3:
  | Camada | Mapa | Tiles | Conteúdo |
  |--------|------|-------|----------|
  | BG1 4bpp | `$0000`, 64×64 | `$2000` | molduras (e "1P"/"2P" da tela de controles) |
  | BG2 4bpp | `$1000`, 32×64 | `$2000` (tiles em `$3000`) | fundo "SUPER STAR SOCCER", sobe devagar (VOFS anima) |
  | BG3 2bpp | `$1800`, 32×64 | `$4000` ou `$5000` | textos (prioridade, por cima de tudo) |
  | OBJ | base `$6000`, segunda tabela `$7000` | | cursor, rostos, itens do menu principal |
- **Caixas escuras:** colour math subtrai uma cor fixa (`4,3,7`) do BG2 dentro da janela de cor 1 (e 2),
  com as bordas por linha vindas de HDMA (`$2126`/`$2127`, tabela em `$7E:D700`). A receita guarda os
  retângulos `[primeira linha, linhas, esquerda, direita]` medidos no state.
- **Menu principal:** só BG2 + OBJ na tela principal; BG3 (as faixas azuis) na sub-tela, com subtração e
  metade (`CGADSUB $C2`, `CGWSEL $02`). Os itens são as 8 listas de sprites do pack `mainMenu`.

## Save state do snes9x (para pesquisar)

Blocos `XXX:000000:` (nome, tamanho em decimal). `VRA` = VRAM, `RAM` = WRAM, `FIL` = arquivo de
registradores (`$2100`-`$213F` como escritos por último, `$420C` = HDMAEN), `DMA` = 8 canais de 19 bytes
(`+6` B-bus, `+7/+8` endereço A em big-endian), `PPU` = `SnapPPU` em big-endian:
`+14 + n*11`: BG n (SCBase, HOffset, VOffset, BGSize, NameBase, SCSize), `+58` modo, `+59` prioridade do
BG3, `+63` CGRAM (256 words), `+2636..2638` cor fixa (R, G, B).

## Ferramentas

- `research/tools/screen-recipe.mjs <state>`: imprime o PPU, as listas de carga que batem com a VRAM do
  state (e uma cobertura gulosa = receita), os descritores de paleta que explicam a CGRAM (gulosa também),
  a janela e a cor fixa.
- `research/tools/screen-check.mjs <pasta> [ids]`: desenha cada receita de `SCREEN_VIEWS` e compara com
  `<pasta>/<state>.png` (tolerância de 1 nível por canal: o snes9x arredonda a subtração com metade). Grava
  `check_<id>.png` (editor | emulador | diferenças).
- `research/tools/ext-loader.mjs`: hook para o Node importar os módulos do app (imports sem extensão).

```
FROM=pm.st OUT=<pasta> node research/tools/emu-seq.cjs "wait:1 shot:pm"
NODE_PATH=<pngjs> node --import ./research/tools/ext-loader.mjs research/tools/screen-check.mjs <pasta>
```

Resultado (out/2026): pré-jogo, pré-jogo dos torneios, opções, treino (nome e instruções) e menu principal
≥ 98%; senha 96%, controles 97%; seleção de times 88% e substituições 81% (listas de jogadores, rostos,
bandeira e barras desenhados pelo código).

## Textos desenhados pelo código (overlays)

O editor escreve no mapa do BG3 os textos com posição conhecida (`overlays` da receita), lidos da ROM
atual: título e instruções do treino (linha 10/12, coluna 7), nível ("LEVEL"; o dígito é desenhado à
parte), descrição do time do jogador 1 (linha 18, coluna 6, Itália), rótulos e ajuda da tela de controles
(linhas 4-10 nas colunas 4 e 18, PLAYER CHANGE na linha 13, nome e ajuda do PASS nas linhas 18/20). O
inspetor mostra o caminho do texto no JSON de tradução.

## Achados

- "1P"/"2P" da tela de controles são tiles do BG1 (`0x6AD98` em `$2100` + `0xBE7D3` em `$2180`, mapa
  `0x671D9`), não sprites. Os quadros dos jogadores, rostos e o "TYPE A" ainda não foram localizados.
- A tela de controles é aberta a partir das Opções: a lista das Opções (`$82:857F`) é carregada antes, e a
  fonte 8x8 (`$82:8300`) é recarregada depois (senão os glifos de `0xDFDDB` em `$4388` estragam o A-Z).

## Pendências

- Sprites das outras telas (cursor, rostos, bandeiras) e as listas de nomes de jogadores.
- Receitas de mais telas: cenário (paletas da partida, 96/256 cores explicadas), grupo da Copa, tabela
  da fase, resultados da World Series, Parabéns, títulos dos modos.
