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

O menu principal (OPEN GAME, INTERNATIONAL CUP...), os títulos dos modos ("INTERNATIONAL CUP" em verde) e
o logotipo usam outras fontes/gráficos. Ficam para o item "Tela título e logos".

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

Código: `src/rom/screenTexts.js` (`SCREEN_TEXTS`, `SCREEN_TEXT_PACKS`, `SCREEN_TEXT_RANGES` em
`constants.js`), painel `src/components/ScreenTextPanel.jsx`, testes em
`src/rom/__tests__/screenTexts.test.js`.

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
