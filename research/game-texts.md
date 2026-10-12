# Pesquisa: textos do jogo (tradução)

> Status: **implementado no editor** (aba Textos do Jogo, out/2026). Validado no emulador.
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

O jogo usa três tipos de texto, cada um num formato diferente.

## 1. Textos em quadro (fonte 8x8, ASCII)

É o mesmo formato dos cenários: bytes ASCII, `FD` = nova linha, `FF` = fim. Uma linha que ocupa todas as
colunas quebra sozinha, sem `FD`. São desenhados por `$80:E2AC`, e a fonte e o conjunto de caracteres são
os mesmos do modo Scenario (sem acentos).

| Texto | Tabela de ponteiros (banco `$02`) | Lido em | Quadro | Área dos textos |
|-------|-----------------------------------|---------|--------|-----------------|
| Instruções dos 5 treinos | `$82:8CFB` (5 words) | `$07:D419` | 8 linhas × 18 col. | `0x10D05`-`0x10F3E` (570 bytes) |
| Comentários do resultado | `$82:8F3F` (5 words → 5 sub-tabelas de 4 words) | `$04:C577` | 5 × 16 | `0x10F49`-`0x11307` (959 bytes, sub-tabelas incluídas) |
| "Recorde batido" | operando de `LDY #$92D4` em `$04:C56D` (arquivo `0x2456E`) | `$04:C56D` | 5 × 16 | na mesma área dos comentários |

- O índice do treino vem de `$1862` (0 Dribble … 4 Corner Kick). O comentário é escolhido pela nota
  `[$2A],Y` e, se a nota passa do recorde, o jogo usa o texto do recorde.
- O editor reempacota tudo nas duas áreas e regrava as tabelas. As 5 sub-tabelas ficam no começo da área
  dos comentários.
- No original vários textos repetem ponteiros. Por exemplo, o "Keep practising" (`0x10F8D`) também é usado
  por outras telas (`0x10CA1`, `$82:C83B`, ...). Ao reempacotar, **só** os ponteiros listados acima mudam.
  Esses usos extras continuam apontando para o endereço antigo, que passa a ter outro texto. Até agora não
  vi efeito em jogo, mas fica o aviso.

## 2. Textos de tamanho fixo (fonte 8x16, código dos nomes)

Usam a mesma tabela de caracteres dos nomes de jogador (`A`=`0x6C`, `a`=`0x86`, `0`=`0x62`, espaço =
`0x00`) e são desenhados com a fonte grande. Ocupam um espaço fixo, completado com espaços.

| Texto | Tabela | Lido em | Formato |
|-------|--------|---------|---------|
| Mensagens do ranking do treino | `$82:9308` (4 words) | `$06:971A` | 3 linhas × 20 colunas |
| Títulos dos modos ("~ Dribble ~") | `$82:940A` (5 words) | `$07:D405` | 1 × 15 |

Ali perto também há textos de ajuda ("Press L or R button to see what functions each key performs",
`0x11F74`) e rótulos (`LOB`, `PASS`, `SHOOT`, `DASH`, `NEXTGAME`, `VS`). Eles estão na seção 4.

### Fonte 8x16 — tabela `$82:8AF4`

Cada código de caractere tem 2 bytes: o tile de cima e o de baixo. O jogo soma `0x30`, ou `0x110` quando o
código × 2 ≥ `0x10C` (minúsculas). Na tabela:

- `0x52` = `!!`, `0x53` = `-`, `0x54` = `.`, `0x55` = `,`, `0x56` = `"`, `0x57` = `=`, `0x58` = `+`;
- `0x59`/`0x5A` = "1ST" (dois tiles) e `0x60`/`0x61` = "2ND";
- `0x5B` = `%`, `0x5C` = `'`, `0x5D` = `~`, `0x5E` = `:`, `0x5F` = `/`.

No editor, "1ST" e "2ND" são escritos `{1S}{T}` e `{2N}{D}`. Códigos sem glifo aparecem como `{xx}` e
são preservados.

## 3. Menus (telas comprimidas)

"Game Start", "Substituting", "Yellow Card", "CROWD NOISE" etc. **não são texto**. São telas de BG de
32×32 tiles (2048 bytes) comprimidas com o compressor da Konami. Cada letra é um par de tiles: o de cima
na linha `r` e o de baixo na linha `r+1`, os mesmos da tabela `$82:8AF4`.

Encontrei 19 telas fazendo a varredura dos blocos comprimidos que descomprimem para 2048 bytes e
contêm pares da fonte (lista em `MENU_SCREENS`, `src/rom/constants.js`).

- **Variantes:** algumas telas usam pares fora da tabela. Para identificá-los, comparei o desenho dos
  tiles na VRAM (dump `vram:` do `emu-seq.cjs`). O principal é o **"T" = `E2/E1`**, que tem o bit de
  espelhamento no tile de cima. Os outros (`e`, `o`, `V`, `y`) estão em `FONT16_EXTRA_PAIRS`.
- **Edição:** só as células cujo caractere mudou são regravadas, com os pares da tabela e só a
  paleta/prioridade do texto. O bit de espelhamento do "T" não pode ser copiado: na primeira tentativa,
  "Tactics" → "Tatica" saiu de cabeça para baixo.
- **Tamanho:** cada texto pode crescer sobre células vazias até a borda do bloco de texto da tela + 2,
  deixando sempre uma célula vazia antes do texto seguinte (sem isso, "TEMPO POR ETAPA" encostava em
  "3.5.7."). A disposição dos textos (posição e espaço) vem sempre da tela original. Assim, um texto que
  cresce até o vizinho não é lido depois como um texto só.
- **1ST / 2ND:** em "1ST SEASON", "1ST STAGE ..." o jogo desenha o ordinal por cima das 3 primeiras
  células durante a execução. Só a parte depois dele é editável. Na tradução, "1a TEMPORADA" aparecia
  como "1STTEMPORADA".
- **Espaço:** os blocos ficam colados uns nos outros. Se a tela editada não recomprimir no lugar original,
  ela é **movida** para espaço livre e os ponteiros são atualizados (ver abaixo).

### Realocação das telas

Cada tela é carregada por um descritor no banco `$02`: `01 00 90 43 7E` + ponteiro longo de 3 bytes
(`lo hi banco|$80`). Algumas telas têm um segundo descritor (`CF A5 8D 00 18` + ponteiro, ou
`6B FA 8E 00 18`/`8F 9E 90 4B 7E` + ponteiro). Todos estão em `MENU_SCREENS[].pointers`.

- **Áreas livres (`MENU_FREE_SPACE`):** só `0xFF` de fim de banco na ROM original. Ficam de fora
  `0x17680`-`0x17FFF`, usado pelos tiles dos nomes dos times, e as sobras do pré-jogo e da Senha, que já
  contam como espaço dessas telas.
- **Lugar deixado por uma tela movida:** o slot original vira espaço livre para as outras.
- **Ordem:** a importação grava primeiro as telas maiores. Ela repete a gravação até nenhuma tela nova
  caber, porque as telas que saem liberam lugar.
- **Volta ao lugar:** uma tela movida volta ao slot original assim que couber de novo.
- **Reorganização:** se não houver um espaço livre grande o bastante (por exemplo, numa segunda
  importação, quando as telas movidas antes ocupam as sobras), o editor reposiciona **todas** as telas
  móveis de uma vez. É um bin packing com busca exaustiva limitada, sobre os slots originais e as áreas
  livres, que prefere manter cada tela no seu lugar. Todos os blocos são lidos antes de gravar, então
  trocar duas telas de lugar é seguro.
- **Sem ponteiro conhecido:** só Parabéns (ponteiro não achado) é regravada apenas no lugar. Senha
  (`0x1087B`), Grupo da Cup (`0x10750`) e a "pontuação do treino" (`0xF10C9`, segunda metade da tela de
  níveis, mesmo descritor: `90 4B 7E` + ponteiro em `0x10802`) têm descritor normal e podem ser movidas.
  Os ponteiros de Senha e Grupo foram achados na varredura ampla (ver abaixo); não há outras referências
  no código.
- **Correspondência na importação:** os menus são localizados por `at` ou pelo texto **da ROM original**,
  não pelo texto atual, que pode já estar traduzido.
- **Validado no emulador:** com a tradução PT-BR, 7 a 8 telas são movidas; quais delas depende da ordem
  das importações e da reorganização. Já vi no jogo: o pré-jogo movido para o banco `$01` (`0x0FEBB`),
  Regras, Táticas, Opções, World Series: jogos (no slot de outra tela) e Treino: nome. Todas aparecem
  certas.
- **Limite de LZ:** a maior distância de LZ usada pela Konami é `0x3C2`. O compressor continua limitado a
  `0x3DF`, por segurança.

### Compressor

O `konamiCompress` antigo (porte guloso do `konami_c`) gerava 2 a 5 vezes o tamanho original nas telas.
Ele escolhia RLE_A0 para sequências `00 20 00 20 ...` (custa 1 + L/2 bytes) em vez de uma cópia LZ
sobreposta (2 bytes para 33). Agora o compressor faz um **parse ótimo** (programação dinâmica sobre RAW,
LZ, A0, C0 e E0): nas 19 telas dá 5768 bytes contra 5791 do original, e todas voltam idênticas.

Também corrigi o anel do descompressor: em C0/E0 a volta do buffer usava `>` em vez de `>=`. Isso não
muda nenhum bloco real (73 blocos conferidos: telas e bandeiras).

### Não coberto

O menu principal e os títulos dos modos estão na seção 5. A tela inicial (logo, copyright e PRESS START)
está em `title-screen.md`.

### Varredura ampla (out/2026)

- **Descritores de carga** (banco `$02`, `0x10150`-`0x10880`): listas que começam com `00 00` (destino
  VRAM: `endereço(2) + ponteiro(3)` por entrada) ou `01 00` (destino WRAM: `endereço(3) + ponteiro(3)`),
  terminadas por `FF`. As telas de texto vão para `$7E:4390` (32×32) e `$7E:4B90` (segunda metade de uma
  tela 64×32).
- Descomprimi o alvo de **todo** ponteiro longo da ROM (`lo hi banco`, banco `$80`-`$9F`) e procurei pares
  da fonte em qualquer tamanho de saída. Não apareceu nenhuma tela de texto nova: as 19 telas são todas
  as que usam a fonte 8x16 em tilemap comprimido (os outros acertos eram blocos lidos fora do início).
- Isso achou os ponteiros da Senha e do Grupo da Cup, que antes eram "sem ponteiro".
- O que ainda está em inglês e não é texto: "1P"/"2P" e "TYPE A" na tela de controles, "VS" e os nomes
  dos times antes da partida, os títulos grandes dos modos e o menu principal. São sprites ou gráficos.

## 4. Textos desenhados pelo código (aba Textos do Jogo > Outras telas)

Fora das telas comprimidas, o código desenha textos do banco `$02` com três rotinas:

| Rotina | Uso | Parâmetros |
|--------|-----|------------|
| `$80:E1C3` | 1 linha, fonte 8x16 | `Y` = texto (`$82:xxxx`), `X` = célula (linha × 32 + coluna), `A` = nº de células |
| `$80:E1FF` | várias linhas, fonte 8x16 | `A` = linhas << 8 \| colunas; cada linha avança 2 linhas de tiles |
| `$80:E2AC` | quadro ASCII 8x8 (`FD`/`FF`) | `A` = linhas << 8 \| colunas (o mesmo dos cenários) |

Na fonte 8x16, `FE xx` troca a paleta das células seguintes e **não ocupa célula**; `FC nn` pula `nn`
células; `FD` deixa a célula como está (o jogo escreve um número ali depois). Para listar todos os
textos: procurar `JSL $80E1C3`/`$80E1FF`/`$80E2AC` e o `LDY #` logo antes.

| Tela | Texto | Endereço | Tamanho | Visto no jogo |
|------|-------|----------|---------|---------------|
| Controles (Opções > Joypad controls) | "Press"L"or"R"button..." | `0x11F67` | 3 × 23 | sim |
| | LOB/PASS/SHOOT/DASH com pontos (1P e 2P) | `0x11FAC` (+23 por linha, 2ª coluna +14) | 9 | sim |
| | "PLAYER / CHANGE" (quadro, 1P e 2P) | `0x12008` | 10 × 2, 22 bytes | sim |
| | títulos "= LOB =" etc. (tabela `$82:9931`, 11 words; a 0 aponta para a introdução) | `0x11947`-`0x11A56` | 26 células (26 ou 30 bytes) | sim |
| | ajudas (tabela `$82:9A57`, mesma ordem) | área `0x11A6D`-`0x11F66` | 26 × 7 | sim |
| Cenário | "VS", "SCORE", "TIME", "EXTRA TIME" | `0x11911`, `0x11913`, `0x1191B`, `0x11927` | 2, 5, 4, 10 | sim (menos EXTRA TIME) |
| | "CONGRATULATIONS!" / "You qualify..." / "UNLUCKY THIS TIME..." | `0x12AA7`, `0x12AB7`, `0x12ADA` | 16, 18 × 2 (35 bytes), 18 × 2 (33 bytes) | não |
| Grupo da Cup (linha de baixo) | "NEXTGAME", "VS" | `0x1201E`, `0x1202A` | 8, 2 | sim |
| World Series | ordinal da temporada "1ST"/"2ND" (`$86:CF4B`, X = `0x53`) | `0x175ED`, `0x175F0` | 3 | sim |
| | sufixo da fase "ST ND RD TH×20" (`$86:CEE7`, depois do número) | `0x175F3` (23 × 2) | 2 | sim |
| Treino (antes do exercício) | " LEVEL " (o número vem depois) | `0x11403` | 7 | não |

- **Ordem das 10 ajudas na área:** LOB, PASS, DASH, STRATEGY, ON THE BALL, FLICK, SHOOT, TYPE A, TYPE B
  (termina em "CONTINUED", que ocupa a 7ª linha; não tem `FF`), TYPE B página 2. O editor reempacota as
  10 na área e regrava a tabela (a entrada 0 não muda).
- **Limites dos rótulos do cenário:** os números do placar e do relógio são desenhados em posições fixas,
  por isso "SCORE" tem 5 células e "TIME" 4. Em PT-BR ficou "GOLS 0-0  HORA 02:00".
- **Tabela `$87:A86A`:** ponteiros, tamanhos e posições de "ASIAN LEAGUE", "INTERNATIONAL CUP",
  "WORLD SERIES 1ST STAGE"/"2ND STAGE" (`0x17621`-`0x17669`). Não achei quem lê nem a tela, então ficaram
  de fora do editor.
- Também ficaram de fora: "NEXT GAME      VS" em `0x12A94` e "OK"/"NO" em `0x12B05` (sem leitor achado).
  Como "ASIAN LEAGUE" não existe nesta versão, esses textos provavelmente sobraram da versão asiática da
  qual esta foi adaptada.

Código: `src/rom/screenTexts.js` (`SCREEN_TEXTS`, `SCREEN_TEXT_PACKS`, `SCREEN_TEXT_RANGES` em
`constants.js`), painel `src/components/ScreenTextPanel.jsx`, testes em
`src/rom/__tests__/screenTexts.test.js`.

## 5. Menu principal e títulos dos modos (Outras telas)

### Menu principal: sprites

Os 8 itens (OPEN GAME ... OPTIONS) são **listas de sprites** no banco `$88`. Achei a área corrompendo
fatias da ROM e carregando um save state no menu: só `0x43C00`-`0x43EFF` estragava as letras.

- **Tabela:** `$87:9E1F`, 8 words (ponteiros no banco `$88`, arquivo = `0x40000` + ptr − `0x8000`). Logo
  depois, em `$87:9E2F`, vêm as posições Y do cursor (`15 2D 45 ...`).
- **Lista:** `n`, depois `n` × `[dy, dx, tile, attr]`, com `dx`/`dy` com sinal relativos ao centro da tela
  (128, 112). `attr`: bit 4 = sprite 16x16, bit 0 = bit 8 do tile, paleta 6. O jogo troca a paleta do
  item selecionado. As 8 listas ficam juntas em `0x43C4F`-`0x43E3E` (496 bytes = 122 sprites). O
  menu usa 123 dos 128 sprites contando o cursor.
- **OAM:** o jogo monta o buffer em `$01E0`-`$03DF` **ao contrário** (o DMA de `$00:81D3` decrementa a
  partir de `$03DF`), com a tabela alta em `$03E0`. Para ler a OAM de um dump de WRAM: byte `k` =
  `WRAM[0x3DF − k]`.
- **Fonte (tiles OBJ `0x100`-`0x13F`, base OBJ = VRAM `0x6000`):** letras inteiras 16x16 para A D E K M N O P
  R S W, e peças 8x8 para as outras: I = haste (`127`/`128`), T = barra (`12A`/`12B`) + haste, L = haste +
  pé do D (`112`) + `129`, C e G = metade esquerda do O (`10C`/`11C`) + `12E` e `12F`/`126`, U = duas
  hastes + `136`/`137`, Y = `12C`/`12D` + haste. A Konami não fez B F H J Q V X Z; o editor acrescenta
  todas (ver abaixo).
- **Espaçamento:** a Konami encostou as letras tinta com tinta (a última coluna desenhada de uma e a
  primeira da outra ficam lado a lado), com ajustes de 1-2 px em pares como AT; o espaço entre palavras
  é de 6-7 px. O editor faz o mesmo (`MENU_SPRITE_FONT` guarda as colunas de tinta de cada letra) e
  aperta 1-2 px quando o texto passaria de x = 252. Itens que não mudam mantêm a lista original.
- **Limites:** 34 fatias de 8 px por linha de varredura (o cursor usa uma) e o espaço da área. "COPA
  INTERNACIONAL" usa 29 sprites e vai até x ≈ 242.
- **Save state:** o objeto do menu guarda o ponteiro da lista. Um estado salvo no menu com outra ROM
  mostra lixo; é preciso ligar o jogo de novo (`wait:300 hold:START:10 wait:200 hold:START:10 wait:200`).

### Letras novas no menu (todas as 26)

- **Montadas com peças que já existem** (sempre disponíveis, sem mexer nos tiles):
  - B = metade de cima do P (`10E`/`10F`) + metade de baixo do D (`112`/`113`) 2 px à direita, para as
    hastes ficarem alinhadas (a barriga de baixo fica maior, como num B);
  - F = metade de cima do E (`104`/`105`) + metade de baixo do P (`11E`/`11F`, só a haste);
  - J = metade direita do U (`127` + `137`) + a curva de baixo da esquerda (`136`).
- **Desenhadas pelo editor:** H Q V X Z (`MENU_SPRITE_DRAWN`, 16x16 na paleta 6). Hastes iguais às do I;
  barras com as camadas do pé do L (`e` / `7` / `5` / `4`, cada camada 1 px para a direita); diagonais
  descendo 1 px a cada 1-2 linhas (a primeira versão do V juntava os braços cedo demais e parecia um Y); o
  Q é o O com rabo.
- **Tiles da fonte:** bloco comprimido `0x6CCC0` (1356 bytes, 56 tiles = OBJ `0x100`-`0x137`), carregado
  em VRAM `0x7000` pela lista de carga do menu principal (`0x10455`, ponteiro em `0x1045E`; a lista só é
  usada pelo registro do menu em `$87:9E57`). O tamanho do DMA é o da saída descomprimida.
- **Não dá para crescer:** com mais 32 tiles o bloco comprime para ~2000 bytes, e a maior área livre
  depois da tradução tem 350. Por isso cada letra desenhada ocupa os 4 tiles de uma letra 16x16 que
  nenhum item usa. Os espaços são escolhidos a cada gravação, nesta ordem: K W D P M R N S E A O
  (`MENU_FONT_SLOTS`). Uma letra conta como usada se algum item desenha qualquer tile dela (C e G usam a
  metade do O, L usa o pé do D, B usa P e D, F usa E e P). Uma letra que já está num espaço livre fica
  nele; os espaços que sobram voltam a ter a letra original.
- Com os 8 itens em inglês não sobra espaço; numa tradução sempre sobram alguns (PT-BR: K e W, que
  recebem o H). As 5 letras desenhadas ao mesmo tempo cabem no bloco.
- Visto no jogo: SENHA, BOLA BOB, FINAL JOGO FEIJAO, VOLTAR VIVO, ZONA QUIZ, QUASE, XIS VIVA, HOJE.

### Letras novas nos títulos (todas as 26)

- **Montadas** com tiles que já existem (`TITLE_FONT`): B = linhas de cima do P (`8`/`9`, `18`/`19`) +
  linhas de baixo do D (`11`/`68`, `71`/`72`); J = metade direita do U + o tile de baixo da metade
  esquerda (`50`).
- **Os tiles dos títulos são máscaras:** só usam as cores 0 e 1. A cor 1 é o fundo preto; a letra é a cor
  0 (transparente), por onde aparece a textura de outra camada (tilemap `0x1000`, tiles `0x60`-`0x68` do
  mesmo bloco). Por isso dá para desenhar letras novas em 1 bit, sem copiar textura.
- **Desenhadas:** K Q V X Y Z (`TITLE_FONT_DRAWN`, gerado de máscaras 16×32). Os tiles iguais a tiles
  existentes (inclusive espelhados) são reaproveitados: Y usa a haste e o pé do T, Q usa o O; sobram 22
  tiles novos (`TITLE_NEW_TILES`), em `0x59`-`0x5F` (vazios no original) e `0x69`-`0x77` (depois do bloco).
- O bloco só recebe os tiles das letras que algum título usa, e é recomprimido no lugar (839 bytes; com
  o nosso compressor o original fica com 752). Cabem 3 letras desenhadas ao mesmo tempo (4 passam por
  4 bytes). Se não couber, nada é gravado e a importação deixa de fora os últimos títulos com essas letras.
- Os tiles `0x69`+ ficam na VRAM depois do bloco (até a palavra `0x2780`): no jogo, o título, a seleção
  de times e a volta ao menu principal continuam certos.
- Visto no jogo: BOLA JOGO / JUBA BEBE, VIVA / XUXA, KAKA / TEMPORADA 1, QUIZ / YOYO.
- Faltam os dígitos 0 e 3-9 (o 0 pode usar o O).
### Títulos dos modos: tilemaps

"INTERNATIONAL CUP", "WORLD SERIES 1ST SEASON" etc. são tilemaps 32×32 comprimidos (VRAM `0x0000`), todos
sobre os mesmos 105 tiles (bloco `0x97B09` → VRAM `0x2000`, 4bpp, paleta 3). Cada letra tem 4 linhas ×
1-2 colunas de tiles, alinhada aos tiles, e usa espelhamento para partes simétricas.

| Título | Bloco | Ponteiro |
|--------|-------|----------|
| INTERNATIONAL / CUP | `0xD4B15` | `0x106FF` |
| INTERNATIONAL / CUP / FINAL | `0xD4C4E` | `0x10707` |
| INTERNATIONAL / CUP / TOURNAMENT | `0x97E5E` | `0x1070F` |
| CHAMPION  SHIP | `0xD4D97` | `0x10760` |
| WORLD SERIES / 1ST  SEASON | `0xD4EAC` | `0x10768` |
| WORLD SERIES / 2ND  SEASON | `0xF367A` | `0x10770` |
| SPECIAL GAME | `0xA6187` | `0x1078A` |

- **Letras:** 1 2 A C D E F G H I L M N O P R S T U W (`TITLE_FONT`, extraído dos 7 títulos), mais B e J montadas e K Q V X Y Z desenhadas pelo editor. I e 1
  ocupam 1 coluna, o espaço 1, as outras 2 (o L tem o pé na 2ª coluna).
- **Layout:** linhas nas linhas de tiles 8, 13 e 18, centralizadas (arredondando para a direita, como no
  original). O editor reconstrói os 7 originais idênticos a partir do texto.
- Os blocos entram em `MENU_SCREENS` (`title: true`), então usam a mesma realocação das telas de menu.
  Com a tradução PT-BR, 5 títulos são movidos para espaço livre.
- Só vi no jogo a Copa e a 1ª temporada da World Series; os outros usam o mesmo mecanismo.

Código: `src/rom/menuSprites.js` (`MENU_SPRITE_FONT`, `MENU_SPRITE_LAYOUT`) e `src/rom/titleScreens.js`
(`TITLE_FONT`, `TITLE_LAYOUT`); campos `kind: 'sprite'` e `kind: 'title'` em `SCREEN_TEXTS`.

## Arquivo de tradução (JSON)

Os botões **Exportar JSON / Importar JSON** da aba Textos do Jogo (`src/utils/textsExport.js`) salvam e
leem um único arquivo com todos os textos traduzíveis:

```json
{
  "_format": "iss-forge-texts",
  "_version": 1,
  "training": { "titles": [5], "intros": [5], "results": [[4] x 5], "record": "...", "messages": [4] },
  "menus": { "prematch": [{ "at": "5,11", "max": 20, "original": "Game Start", "text": "Game Start" }] },
  "screens": { "joypad": [{ "id": "intro", "limit": "3 lines x 23 letters", "text": "..." }] },
  "scenarios": [{ "index": 1, "match": "BRAZIL 0x0 USA", "text": "..." }],
  "teamDescriptions": [{ "team": "GERMANY", "title": "...", "body": "..." }]
}
```

- Só `text`, `title` e `body` são importados. `at`, `original`, `max`, `note` e `match` servem para
  identificar e orientar. `note` aparece nos textos depois de um "1ST"/"2ND" desenhado pelo jogo.
- Nos menus, o texto é localizado por `at` (linha,coluna) e, se não achar, por `original`, sempre
  comparado com a ROM **original**. Por isso o mesmo arquivo pode ser importado várias vezes. O
  `original` exportado é sempre o texto da ROM original (antes vinha o texto atual).
- Em `screens`, cada texto é localizado pelo `id`; `limit` só orienta.
- Partes ou itens podem ser apagados do arquivo: o que faltar fica como está.
- Os acentos são removidos na importação (`técnico` → `tecnico`), e as aspas tipográficas viram ASCII. Os
  caracteres que continuam sem glifo aparecem num aviso e viram espaço.
- **Importa o que couber:** o que não cabe fica de fora e aparece em `skipped` com o motivo, as linhas
  como o jogo vai quebrar (ex.: `teamDescriptions.GERMANY: body has 7 lines, max 6 (15 columns): "Jogadores
  com" / "boas" / ...`) ou os bytes da tela. Quando a área de um grupo enche (instruções, comentários,
  descrições), os textos novos mais longos saem primeiro. A importação vira um único passo de undo.
- **Arquivos antigos:** quando o `original` tinha "1ST ..." / "2ND ...", o ordinal é retirado do texto
  traduzido e um aviso mostra o que foi importado.

## Validação no emulador

- **Instruções e título:** "Use a corrida e o drible para nao ser desarmado. Pegue todas as bandeiras o
  mais rapido possivel!" e "~ Drible ~" aparecem quebrados como na prévia do editor.
- **Menu pré-jogo:** traduzido para Iniciar Jogo / Substituicoes / Tatica / Estadio / Regras / Uniformes /
  Som. O cursor e o destaque continuam funcionando.
- **Tradução PT-BR completa** (`game-translations/PT-BR.json`): o estado e as telas conferidas estão em
  `BACKLOG.md`, seção "Tradução PT-BR — estado".

## Código

| Arquivo | Conteúdo |
|---------|----------|
| `src/rom/gameTexts.js` | textos do treino (quadros e tamanho fixo), charset 8x16 (`encodeIss`/`decodeIss`) |
| `src/rom/menuScreens.js` | telas de menu: leitura dos textos, gravação, realocação e reorganização, undo |
| `src/rom/KonamiCodec.js` | descompressor e compressor (parse ótimo) |
| `src/utils/textsExport.js` | exportar/importar o JSON de textos |
| `src/components/GameTextEditor.jsx`, `MenuTextPanel.jsx` | aba Textos do Jogo (Treino / Menus) |
| `src/rom/constants.js` | `GAME_TEXTS`, `FONT16_TABLE`, `FONT16_EXTRA_PAIRS`, `MENU_SCREENS`, `MENU_FREE_SPACE` |

Os testes ficam em `src/rom/__tests__/gameTexts.test.js`, `menuScreens.test.js` e
`src/utils/__tests__/textsExport.test.js`. Os que usam a ROM real são pulados quando ela não está em
`rom/original/`.

## Ferramentas

- `emu-seq.cjs`: nova ação `vram:nome` (dump de 64 KB da VRAM; `libretro-emu.cjs` ganhou `vram()`).
- **Testar uma ROM traduzida no emulador:** gerar a ROM com um teste temporário do vitest que lê a ROM
  original, chama `applyTexts(rom, json)`, faz `rom.fixChecksum()` e grava o arquivo. Depois rodar
  `ROM=<arquivo> node research/tools/emu-seq.cjs "<caminho de menu> shot:nome"`. Os testes temporários não
  podem ficar em `research/tools/emu-out/`, senão o `npx vitest run` os executa.
- Os scripts de varredura das telas, de identificação de glifos pela VRAM e de folha de tiles foram
  temporários. Para refazer:
  - **Telas:** descomprimir cada offset da ROM com `konamiDecompress`, guardar os que terminam com
    exatamente 2048 bytes e decodificar os pares (`findTextRuns` em `src/rom/menuScreens.js`).
  - **Glifos:** comparar o desenho dos dois tiles (VRAM `0x8000` + tile × 16, 2bpp) com os da tabela,
    deslocando para a esquerda até a primeira coluna acesa.
