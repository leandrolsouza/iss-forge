# Pesquisa: paletas da partida (gramado, bola, árbitro)

> Status: **implementado no editor** (aba "Campo e Bola") e **validado em jogo**: a ROM salva pelo
> editor foi rodada no emulador (snes9x via `research/tools/emu-seq.cjs`) com gramado azul, bola
> laranja e árbitro amarelo.
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

## Como o jogo carrega paletas

- Buffer de CGRAM na WRAM: `$7E:3200`-`$7E:33FF` (256 cores). O NMI copia por DMA para a CGRAM quando o
  bit 15 de `$40` está ligado (`$00:81A1`).
- Sistema de "scripts de paleta": `$80:AB2B` (Y = endereço em `$81`) registra uma tarefa em `$1CB0+`. O
  tipo da tarefa depende de Y:
  - `< $89E6`: descritor único
  - `< $8C5E`: lista de descritores terminada em 0
  - `< $8C7C` / acima: fades
- Descritor (3 bytes, banco `$81`): `word ponteiro (banco $85)` + `byte índice` na tabela de destino
  `$81:86F3` (linhas `$3200`, `$3220`… e alguns destinos avulsos).
- Blob (banco `$85`, arquivo `0x28000 + (addr - 0x8000)`): `word tamanho` + cores. O loader (`$80:ACF0`)
  **pula a cor 0 de cada linha** (transparente), menos na linha 0 (backdrop). Valores com bit 15 ligado
  são comandos de repetição (`$80:AD64` / `$80:AD7F`).

## Gramado

Escolhido em `$00:CD32`: `lista = $81:94BC[ $81:9530[$1FA0] + $1F92 ]` (+3 = variante que também troca o
backdrop).

| RAM | Significado | Valores |
|-----|-------------|---------|
| `$1FA0` | tipo de gramado (tela "Stadium") | 0 = A, 1 = B, 2 = C → base `6 / 0 / 6` |
| `$1F92` | clima | 0 = sol, 1 = chuva, 2 = neve |

A e C usam as **mesmas cores** e mudam só o desenho do corte da grama (tiles).

| Paleta | Arquivo | Cores | Linha CGRAM |
|--------|---------|-------|-------------|
| Tipo B, sol | `0x2DC3F` | 30 | BG 2-3 (dentro do blob `$85:DC1F`, linhas 1-7) |
| Tipo B, chuva | `0x2E08B` | 30 | BG 2-3 |
| Tipo B, neve | `0x2E04D` | 30 | BG 2-3 |
| Tipos A/C, sol | `0x2DD33` | 30 | BG 2-3 |
| Tipos A/C, chuva | `0x2FD0F` | 30 | BG 2-3 |
| Tipos A/C, neve | `0x2FCB1` | 30 | BG 2-3 |
| Detalhes (compartilhada: B todos + A/C sol) | `0x2DCD5` | 15 | BG 7 |
| Detalhes A/C chuva | `0x2FD4D` | 15 | BG 7 |
| Detalhes A/C neve | `0x2FCEF` | 15 | BG 7 |

As linhas do campo (brancas) fazem parte das mesmas paletas.

Outras linhas de BG na partida: ver "Estádio e torcida" abaixo.

## Bola

- OBJ linha 15, carregada pelo descritor `$81:88F0` (blob `$85:DEDB`, lista `$81:8B3E`, `$00:CD16`).
- **Cores 2-10** (`0x2DEDF`, 9 tons do escuro ao claro) = bola.
- Cor 1 (`0x2DEDD`, amarelo) e 11-15 = outros sprites do HUD (marcadores do radar).

## Árbitro e bandeirinhas

- OBJ linha 14, `0x2E959`, 15 cores. A mesma paleta veste o árbitro e os bandeirinhas.
- Mesmo layout dos uniformes: cabelo (1), pele (5), camisa (3), calção (3), meias (2), extra (1).
- Original: camisa e calção em 3 tons de cinza escuro (preto).

## Como foi validado

1. A disassembly achou o buffer `$7E:3200` e o loader de paletas.
2. `research/tools/emu-seq.cjs` (frontend libretro headless) navegou até uma partida CPU x CPU e salvou
   um dump da WRAM.
3. `research/tools/cgram-match.cjs` cruzou as cores da CGRAM com a ROM.
4. Foram geradas ROMs de teste pintando cada bloco de uma cor chapada (vermelho, verde, azul…) e conferidas
   por screenshot.
5. Depois, a ROM salva pela UI do editor foi rodada no emulador.

## Bug corrigido junto

`rgbToSnesBytes` (uniformes, cabelo/pele, bandeiras) usava `Math.round(v / 8) & 0x1F`. `255 / 8` arredonda
para 32, e `32 & 0x1F = 0`: **branco puro (#FFFFFF) virava preto**. Agora o valor é limitado a 31.

## Estádio e torcida (validado em jogo)

| O quê | Arquivo | Cores | Linha | Observação |
|-------|---------|-------|-------|------------|
| Muro em volta do campo + rede do gol | `0x2DC7B` | 15 | BG 4 | blob `$85:DC1F`; igual para todos os tipos/climas |
| Fotógrafos atrás da linha de fundo | `0x2DC21` | 15 | BG 1 | blob `$85:DC1F` |
| Torcida | por time (abaixo) | 30 | BG 5-6 | 2 grupos de torcedores × 15 cores |

### Torcida por time

- Tabela `$81:9362` (arquivo `0x9362`): 27 words, indexada pelo **ordinal ×2 do time em `$1720`** (time 1 =
  o primeiro escolhido na seleção, **não necessariamente** o que aparece à esquerda no placar). Cada entrada
  aponta para um dos 20 descritores `$81:88AB + n*3`, que apontam para blobs de 31 cores no banco `$85`
  (`0x2F7B9`…`0x2FC53`).
- Carregada em `$07:DB63` / `$00:C43B` (`LDY $9362,X` → `$80:AB2E`).
- Visíveis: cores 1-15 da linha 5 e 1-15 da linha 6. A 31ª cor cai na cor 1 da linha 7 e é sobrescrita
  depois pela paleta do gramado.
- Layout de cada grupo (15 cores): contorno (1), pele (4), **camisa A (3, claro → escuro)**, neutros (3),
  **camisa B (3, claro → escuro)**, sombra (1).
- Times que compartilham paleta no original: ROM+COL, WAL+BEL, GER+SST, FRA+USA, SUI+BUL, DEN+NOR+KOR.
- Trocar a entrada da tabela (2 bytes) faz um time usar outra paleta sem gastar espaço.

## Pendências / ideias

- Backdrop (variante "+3", `$85:F7B5`).
- O sistema de paletas também serve para menus. A tabela completa de descritores está em `$81:875B`-`$89E5`.
- Separar uma paleta de torcida compartilhada exigiria um blob novo em espaço livre (31 cores + tamanho)
  e um descritor novo.
