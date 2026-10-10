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

Outras linhas de BG na partida: 1 e 4 (`0x2DC21`, `0x2DC7B`, estádio), 5 e 6 (`0x2F8B3`/`0x2F8D1`,
provavelmente arquibancada/placas). **Não mapeadas visualmente.** São candidatas a um editor de "estádio".

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

## Pendências / ideias

- Paletas de estádio/torcida (BG linhas 1, 4, 5, 6) e o backdrop (variante "+3", `$85:F7B5`).
- `$07:DB63` carrega uma lista por time (`$9362[time]`): talvez cores da torcida por seleção.
- O sistema de paletas também serve para menus. A tabela completa de descritores está em `$81:875B`-`$89E5`.
