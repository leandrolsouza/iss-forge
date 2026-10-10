# Pesquisa: modo Scenario

> Status: **implementado no editor** (aba "Cenários"). Validação em jogo pendente.
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

## Onde estão os dados

| O quê | Arquivo | SNES | Formato |
|-------|---------|------|---------|
| Times de cada cenário | `0x9CAE` | `$81:9CAE` | 9 × 2 bytes: `ordinal*2` do time 1 e do time 2 |
| Ponteiros dos registros | `0x9CC0` | `$81:9CC0` | 9 × word (banco `$01`) |
| Registros | `0x9CD2` | `$81:9CD2` | 9 × 12 bytes (abaixo) |
| Condição dos jogadores | `0x9C66` | `$81:9C66` | 9 × 8 bytes (abaixo) |
| Ponteiros dos textos | `0x38036` | `$87:8036` | 9 × word (banco `$02`) |
| Textos | `0x114AF`-`0x11910` | `$82:94AF` | ASCII, 1122 bytes no total |

"Ordinal" é a ordem de times da ROM (a mesma de `FLAG_DESIGN_ORDINALS`, com a Escócia na posição 5).

### Registro (12 bytes) — lido em `$00:ED97`

| Offset | Tamanho | Destino | Significado |
|--------|---------|---------|-------------|
| +0 | word | `$1A44` | relógio do apito final, BCD `m:ss`. Ao zerar (com bola rolando) o jogo seta `$9E=6` (fim) — `$05:A15F` |
| +2 | word | `$1A46` | relógio exibido no placar, BCD `m:ss`, só corre com a bola em jogo. `0` = sem relógio (`$00:C449`) |
| +4 | byte | `$1724` | gols do time 1 |
| +5 | byte | `$1774` | gols do time 2 |
| +6 | byte | `$9E` | estado inicial do jogo (tipo de reinício) — **não mapeado** |
| +7 | byte | `$B0/$B2` | se ≠ 0 → `0x0C00`, senão `0x0520` — **não mapeado** |
| +8 | word | `$0504` | provável X da bola — **não confirmado** |
| +10 | word | `$0506` | provável Y da bola — **não confirmado** |

Nos originais o apito final é sempre o placar + 10 s (ex.: `0x0210` / `0x0200`). A exceção é o cenário 9
(Bulgária x França): placar `0:00` (sem relógio) e apito em `0:12`.

Valores originais de +6/+7/+8/+10:

| # | Jogo | +6 | +7 | +8 | +10 |
|---|------|----|----|----|-----|
| 1 | BRA 0x0 USA | 2 | 0 | 0x200 | 0x000 |
| 2 | ITA 0x1 NIG | 2 | 0 | 0x280 | 0x1C0 |
| 3 | KOR 0x2 SPA | 3 | 1 | 0x580 | 0x0E0 |
| 4 | SCO 1x0 HOL | 2 | 0 | 0x140 | 0x000 |
| 5 | BUL 0x1 GER | 3 | 1 | 0x5C0 | 0x160 |
| 6 | HOL 1x2 BRA | 1 | 1 | 0x700 | 0x000 |
| 7 | ARG 1x3 ROM | 1 | 1 | 0x700 | 0x1C0 |
| 8 | USA 2x1 COL | 2 | 0 | 0x0E0 | 0x1C0 |
| 9 | BUL 1x1 FRA | 1 | 0 | 0x000 | 0x000 |

Hipótese: `+6` = tipo de reinício (2 com Y=0 parece lateral; 3 = falta?), `+7` = qual time repõe a
bola. Para testar no emulador: pegar o cenário 1, trocar só o `+6` (1, 2, 3, 4) e observar.

### Condição dos jogadores (8 bytes) — `$00:ED59` → `$85:A3FF`

Para cada time a rotina recebe duas máscaras de 16 bits (`$02`, `$04`) e preenche 15 words em
`$1870` (time 1) / `$188E` (time 2): `low byte = índice do jogador`, `high byte = estado`.

```
para cada jogador 0..14:
  se bit de $02:          estado 5          (partida normal: $02 = FFFF → todos 5)
  senão se bit de $04:    estado 1          ($04 só "anda" quando o bit de $02 é 0)
  senão:                  estado 3
```

Leitura das máscaras (curiosa, mas é o que o código faz): time 1 = `word(b0,b1)` e `word(b1,b2)`
(sobrepostas!); time 2 = `word(b4,b5)` e `word(b6,b7)`.

O significado de 5/3/1 **não está confirmado**. Pode ser cansaço, expulsão ou titular/reserva. O editor
preserva esses bytes. Isso explica, em tese, "Brasil com 10 homens" e "Itália com 9".

### Textos — `$07:D54B` → `$00:E2AC` / `$00:E31F`

- Tela de 8 linhas × 23 colunas (`A=#$0817`).
- `0xFD` = nova linha (completa a linha com espaço), `0xFF` = fim (resto em branco).
- Fonte: tabela `$82:8C80` (caractere ASCII → tile). Com glifo: `` !"',-.0-9:?A-Za-z `` (`` ` `` = `'`).
  Sem glifo (viram espaço): `#$%&()*+/;<=>@[\]^_`. `{|}~` apontam para tiles estranhos, então são evitados.
- No original os textos são quebrados com espaços e não têm `FF` em todos (o texto 7 começa no meio do 6).
  O editor decodifica como o jogo desenha e, ao editar, regrava os 9 textos em sequência com `FD`/`FF`. A
  aparência fica idêntica, mas os bytes mudam.

## Outras referências no código

- `$07:D4AA`: menu de cenários (desenha times, placar e relógio; casos especiais para os índices 1 e 6).
- `$04:C4A1`: usa a tabela de times para desenhar as bandeiras (`$87:9DAE`).
- `$04:C4CE`: `$1FB4` com máscara em `$80:80A7`, provavelmente "cenários concluídos".

## Pendências / ideias

1. Validar em jogo: times, placar, relógio e texto editados (cenário 1 é o mais fácil).
2. Mapear `+6`, `+7`, `+8`, `+10` (situação inicial) e os estados 5/3/1 da condição dos jogadores.
3. Se o espaço de texto (1122 bytes) ficar curto, dá para realocar os textos para área livre e trocar só
   os ponteiros (o banco é fixo em `$82`, ver `$00:E2C7`).

## Ferramenta

`research/tools/disasm65816.mjs`: disassembler 65816 mínimo (acompanha REP/SEP):

```
node research/tools/disasm65816.mjs "rom/original/International Superstar Soccer (Europe).sfc" '$00:ED41' 60
```
