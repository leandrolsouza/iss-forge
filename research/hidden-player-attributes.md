# Pesquisa: atributos dos jogadores (bloco de 6 bytes)

> Status: **implementado no editor** (aba Jogadores, out/2026). Todos os bits usados pelo jogo estão mapeados.
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

## Onde fica

Cada jogador tem um bloco de **6 bytes** em `0x387EC + ordinal*90 + jogador*6`. Os 15 jogadores do time
vêm em sequência, e os 11 primeiros são os titulares.

**Atenção:** o índice é o **ordinal** da ROM (Escócia = 5), não a ordem de `TEAMS` (Escócia = 24), que é a
usada pelos nomes. Até out/2026 o editor usava `TEAMS` aqui, e os times 5 a 24 mostravam os dados do
vizinho. Detalhes em `tournaments.md`.

A tabela de ponteiros por time fica em `$01:DED7` (`0x0DED7`, 27 words: `$87EC`, `$8846`, ...). Ela é
indexada pelo id do time (`$1720`) e é seguida por `playerDataAddress()`.

## Mapa final

| Byte | Bits | Campo no editor | Uso no jogo |
|------|------|-----------------|-------------|
| 0 | 7-4 | `topSpeed` (Vel. sem bola) | velocidade máxima correndo **sem** a bola |
| 0 | 3-0 | `acceleration` (Arranque) | velocidade com que o jogador **começa** a correr |
| 1 | 7 | — | sempre 0 na ROM; o jogo somaria 8 ao chute (sem efeito, já está no teto) |
| 1 | 6-4 | `shootingIndex` (Chute) | força do chute a gol |
| 1 | 3-0 | `gkKickIndex` (Chute do goleiro) | força máxima do chute do **goleiro** com a bola na mão. 0-7; 8-15 = 7 |
| 2 | 7-4 | `stamina` | stamina (×2) e tabela `$81:A46D` |
| 2 | 3 | — | sempre 0; o jogo leria a técnica com 4 bits, mas valores > 7 caem fora da tabela |
| 2 | 2-0 | `techniqueIndex` (Técnica) | precisão do chute a gol |
| 3 | 7-4 | `dribbleSpeed` (Vel. com bola) | velocidade máxima conduzindo a bola |
| 3 | 3-0 | `number` (camisa - 1) | número da camisa (×2) |
| 4 | 7-4 | `attack` (Disputa no ataque) | força na disputa de bola no campo **adversário** |
| 4 | 3-0 | `defense` (Disputa na defesa) | força na disputa de bola no **próprio** campo |
| 5 | 7-6 | `isSpecial` | tipo de cor (normal/especial) |
| 5 | 5-4 | — | sempre 0 |
| 5 | 3-0 | `hairStyle` | estilo de cabelo |

**Goleiro e cabelo:** na ROM original todo goleiro titular (jogador 1) tem o byte 5 = `00` (cabelo 0, cor
normal). Testado no emulador (Italia x Brasil a partir do menu pre-jogo): com o goleiro em `hairStyle` 5, ele
aparece como um amontoado de pedaços de sprites quando entra em cena; com o goleiro "especial" (bit 6) ou com
os jogadores de linha usando os 11 estilos, nada quebra. O jogo so tem o desenho do goleiro com o cabelo 0. O
editor avisa (`valKeeperHair`) e a geracao por IA sempre grava 0 no jogador 1.

Na UI os campos de 4 bits usam a escala 1-16 (nibble + 1, como a stamina). Os de 3 bits (chute, técnica e
chute do goleiro) usam a escala 1, 3, ..., 15 (`SHOOTING_VALUES`).

**Correção importante:** o campo que o editor chamava de "Velocidade" (byte 1, nibble baixo) **não é
velocidade**. Ele só é lido nos estados do goleiro (ver abaixo). A velocidade de verdade são três nibbles,
b0.lo, b0.hi e b3.hi.

## Como o jogo usa (engenharia reversa)

### 1. Cópia para a RAM — `$05:A8EB`

Antes da partida, `$05:A8D0` chama `$05:A8EB` para os dois times (ponteiro do time via `$DED7,Y`, onde Y é
o time em `$1720`/`$1770`). Ela expande os 6 bytes em uma "ficha" de `0x60` bytes por jogador:
`$7E:A010 + n*0x60` (time 1) e `$7E:A5B0 + n*0x60` (time 2).

| Ficha | Valor |
|-------|-------|
| +0 | b0.lo + `0x1C` |
| +1 | b0.hi + `0x1C` |
| +2 | b1.lo |
| +3 | b1 >> 4 |
| +4 | b2.lo × 2 |
| +5 | b2.hi × 2 |
| +6 | b3.lo × 2 |
| +7 | b3.hi + `0x1C` |
| +8 | b4.lo |
| +9 | b4.hi |
| +A / +B | b5.lo / b5.hi |
| +C (word) | `$81:A46D[stamina]` × 16 |

### 2. Objetos em campo e condição — `$05:A709`

Os 22 jogadores em campo são objetos de `0xA0` bytes em `$0520 + i*0xA0` (time 1 até `$0C00`). A rotina
`$05:A709` copia a ficha para `obj+$50..$59`. Depois `$05:A7CB` soma a **condição** do dia,
`(cond & 7) - 5` (os rostinhos da tela de substituição; cond vem do byte alto da escalação em
`$1870`/`$188E`). Ela soma em +0, +1, +2, +3, +4, +7, +8 e +9. Stamina e número ficam iguais. Os três
campos de velocidade têm piso de `0x1C`; os outros, piso de 0.

| Objeto | Campo |
|--------|-------|
| `$50` | arranque (b0.lo) |
| `$51` | vel. sem bola (b0.hi) |
| `$52` | chute do goleiro (b1.lo) |
| `$53` | chute (b1.hi) |
| `$54` | técnica × 2 |
| `$55` | stamina × 2 |
| `$56` | camisa × 2 |
| `$57` | vel. com bola (b3.hi) |
| `$58` | defesa (b4.lo) |
| `$59` | ataque (b4.hi) |
| `$5A` | word da stamina |

### 3. Leituras na partida (banco 03)

- **Velocidade** (`$03:85F4`, `$03:8ADA`, `$03:A962`, ...): ao começar a correr,
  `vel_atual($66) = max(vel_atual, $50)` e o teto (`$44`) vira `$51` sem a bola ou `$57` com a bola. Em
  `$03:86CB` a velocidade sobe 1 a cada 16 quadros até o teto. Confirmado no emulador: o dono da bola
  (`$0502`) usa `$44 = $57` no estado `0x0B`, e os outros usam `$44 = $51` no estado `5`.
- **Chute** (`$03:B953`): força = `min(0x12, 0x0B + $53)` (ou `0x0D + $53` num caso especial). O
  valor 7 já bate no teto.
- **Técnica** (`$03:B8D7`): índice = `rand(0..15) + $54` na tabela `$81:A5A2`. Ali, os índices 0-14 erram e,
  de 15 a 29, os ímpares acertam. A chance de o chute ir para onde foi mirado é `(técnica+1)/16`. Se erra,
  o alvo é desviado ±`0x10` ou ±`0x30`. Técnica > 7 lê lixo depois da tabela.
- **Disputa de bola** (`$03:CF6A`, chamada pelo desarme em `$03:AC63`): o lado do campo vem de
  `[$7E,X]+6` e do Y da bola (`$04B6` comparado com `$0380`).
  - Bola no campo de defesa de quem desarma: `índice = atacante.$59 (ataque) + 15 - defensor.$58 (defesa)`.
  - Bola no campo de ataque de quem desarma: `índice = portador.$58 (defesa) + 15 - desarmador.$59
    (ataque)`. Essa tabela é 4 linhas mais favorável a quem tem a bola.
  - O resultado sai de `$81:AB92`/`$81:ABA2` com `índice*4 + rand(0..3)`. **0** = o desarmador ganha a
    bola. **1** = o portador vai para o estado `0x32`. **2-3** = o portador escapa (estado `0x8C`). Com os
    dois valores iguais, o desarmador ganha 25% das vezes.
- **Chute do goleiro** (`$03:CAD8`, só nos estados `0xC2-0xC4` e `0xC8-0xCA` do goleiro):
  força = `min(0x0B - carga, $52 + 4)`. Os estados `0xC8-0xCA` são o chute com A (bola na mão). Os estados
  `0xCB-0xCD` são o arremesso com B.

### 4. Barra SPEED do jogo — `$00:EAD0`

O quadro **DATA** da tela *Substituting* (menu antes do jogo) desenha 4 barras. A rotina lê o bloco da ROM
direto:

- TECHNIQUE = b2 & 7
- SHOOT = (b1 >> 4) & 7
- **SPEED = (2 × b0.lo + b0.hi + b3.hi) / 4**
- STAMINA = b2.hi

O editor mostra essa SPEED como `speed` (só leitura, `gameSpeed()` em `src/rom/playerStats.js`).

## Testes no emulador

Feitos com o frontend libretro (`research/tools/libretro-emu.cjs`), que agora tem `poke()` para escrever na
WRAM:

- **Chute do goleiro:** goleiro da Itália com a bola na mão, segurando A por 40 quadros. Com
  `obj+$52 = 0 / 4 / 7 / 15`, a bola foi a **694 / 868 / 1038 / 1038** unidades. Com toque curto (5
  quadros), foi a 606 em todos os casos. Isso confirma o teto em 7.
- **Velocidade:** em 3000 quadros de CPU x CPU, o dono da bola usa `$57` como teto e quem corre sem a bola
  usa `$51`. A velocidade começa em `$50` e fica parada por 16 quadros antes de subir.
- **Super Star** (time 26): todos com `FF 77 F7 F? FF`, ou seja, todos os campos no máximo.
- **Barra SPEED:** fiz ROMs com os 15 jogadores da Itália tendo só um nibble em 15 e os outros em 0. A tela
  DATA mostrou **8 marcas** com só o arranque, **4** com só a vel. sem bola e **4** com só a vel. com bola.
  Com tudo em 0 aparece 1 marca; com tudo em 15, 16 marcas. Isso confere com `(2a + t + d) / 4`, com
  "marcas = valor + 1".

## Pontos em aberto

- O resultado **1** da disputa (estado `0x32` do portador) parece ser "os dois disputam/bola solta". Falta
  confirmar.
- A **condição** do jogador (byte alto da escalação em `$1870`) é sorteada antes da partida. Dá para fixar
  num patch de código, mas isso não está no editor.

## Formato JSON

O formato `iss-forge-team` v2 exporta `acceleration`, `topSpeed`, `dribbleSpeed`, `attack`, `defense` e
`gkKickIndex`, além do bloco `raw`. O campo `speed` vai junto só para leitura e é ignorado no import.
Arquivos **v1** usavam `speed` para o nibble b1.lo; no import ele vira `gkKickIndex = min(7, speed - 1)`.
Na IA, `speed` continua significando "velocidade de corrida" e preenche as três velocidades.

## Scripts usados

- Disassembler: `research/tools/disasm65816.mjs` (ex.: `$05:A8EB`, `$03:CF6A`, `$00:EAD0`).
- Emulador: `research/tools/emu-seq.cjs` e `libretro-emu.cjs`. Os scripts de log de estado e o `press` com
  `poke` foram temporários. Para refazer: ler `wram()` a cada quadro e observar `obj+$14` (estado), `$44`,
  `$66` e `$0502` (dono da bola).
- Caminho no menu até a tela DATA: `wait:300 START(hold) wait:250 START(hold) A(hold)` → Open Game → 1P x
  CPU → times → menu pré-jogo → `DOWN A` (*Substituting*).
