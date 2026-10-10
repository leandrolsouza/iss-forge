# Pesquisa: atributos ocultos dos jogadores

> Status: **pendente**. Anotado durante a pesquisa da formação (out/2026).
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

## Contexto

Cada jogador tem um bloco de **6 bytes** em `0x387EC + time*90 + jogador*6` (ordem de times de `TEAMS` em
`src/rom/constants.js`; 15 jogadores por time; os 11 primeiros são os titulares).

O editor hoje lê/escreve apenas parte desses bits (`src/rom/readers/PlayerReader.js` e
`src/rom/writers/PlayerWriter.js`):

| Byte | Bits | Uso atual no editor |
|------|------|---------------------|
| 0 | 7-4 | **não usado** |
| 0 | 3-0 | **não usado** |
| 1 | 6-4 | "Chute" (índice 0-7 → 1,3,…,15) |
| 1 | 3-0 | "Velocidade" (+1) |
| 2 | 7-4 | "Stamina" (+1) |
| 2 | 2-0 | "Técnica" (índice 0-7 → 1,3,…,15) |
| 3 | 7-4 | **não usado** |
| 3 | 3-0 | número da camisa (+1) |
| 4 | 7-4 | **não usado** |
| 4 | 3-0 | **não usado** |
| 5 | 7-6 | tipo de cor (normal/especial) |
| 5 | 3-0 | estilo de cabelo |

Ou seja, existem **5 nibbles sem uso no editor** (b0.hi, b0.lo, b3.hi, b4.hi, b4.lo) que quase certamente
são atributos de jogo.

## Evidências

### 1. Super Star (time 26) tem tudo no máximo

Todos os 15 jogadores do Super Star têm:

```
b0 = FF   b1 = 77   b2 = F7   b3 = F?   b4 = FF
```

Os nibbles "não usados" estão todos em `F`, igual aos atributos conhecidos no máximo. É um forte
indício de que são atributos de habilidade. Também mostra que chute, velocidade e técnica usam só
3 bits (máximo `7`).

### 2. Estatística por linha (titulares de 26 times, linha tirada da formação na ROM)

Média [mín-máx] de cada campo:

| Campo | GK | DEF | MID | FWD | Leitura provável |
|-------|----|-----|-----|-----|------------------|
| b0.hi | 6.8 [4-13] | 10.6 [8-14] | 10.7 [9-14] | 11.4 [9-15] | ? geral/físico (baixo no GK) |
| b0.lo | 5.5 [4-9] | 6.8 [4-10] | 7.5 [4-12] | 8.8 [5-15] | ? sobe para o ataque |
| b1.hi (chute) | 4.0 | 3.8 | 3.7 | 4.1 | conhecido (3 bits) |
| b1.lo ("velocidade") | 3.5 [0-7] | 4.0 [0-7] | 3.7 [0-7] | 3.6 [0-6] | conhecido, **só 0-7 no jogo** |
| b2.hi (stamina) | 11.8 | 11.0 | 10.4 | 10.4 | conhecido |
| b2.lo (técnica) | 2.8 | 2.6 | 3.3 | 3.6 | conhecido (3 bits) |
| b3.hi | 5.9 [4-11] | 8.1 [5-11] | 9.0 [5-14] | 10.7 [8-15] | ? drible/controle (sobe para o ataque) |
| **b4.hi** | **2.3** [2-10] | 4.8 [1-12] | 7.4 [2-15] | **9.7** [4-14] | **ataque/finalização?** cresce DEF→FWD |
| **b4.lo** | **11.2** [8-14] | **11.1** [6-15] | 8.0 [3-15] | **4.6** [2-9] | **defesa/marcação?** cai DEF→FWD |

Bits que estão **sempre 0** na ROM original (provavelmente sem uso ou com flag): `b1.bit7`, `b2.bit3`,
`b5.bits4-5`.

### 3. Correlações (jogadores de linha)

- `b0.lo × b3.hi = 0.79`: muito ligados, talvez dois aspectos de habilidade com bola
- `b0.hi × b3.hi = 0.64`, `b3.hi × b4.hi = 0.62`, `técnica × b4.hi = 0.59`
- `b4.hi` e `b4.lo` andam em sentidos opostos conforme a linha (ataque vs. defesa)

### 4. Goleiros

O jogador 1 de todo time tem `b4.hi` baixo (~2) e `b4.lo` alto, e `b0`/`b3.hi` mais baixos. É possível
que, para goleiros, algum desses nibbles seja reinterpretado (reflexo, saída do gol, etc.).

## Pontos de atenção no editor atual (verificar)

- **Velocidade**: a UI aceita 1-16 e o writer grava o nibble inteiro, mas no jogo só aparecem valores
  0-7 (máximo do Super Star = 7). Valores 9-16 podem não fazer efeito ou fazer algo inesperado.
- `writePlayerData` reaproveita `rawBytes` do estado e preserva b0/b4 e o nibble alto de b3. Isso está
  correto, mas a **importação JSON** força `rawBytes: null` e lê os bytes atuais do slot de destino. Ao
  importar um time, os atributos ocultos ficam os do time que estava no slot e não os do time importado.
  Os atributos ocultos precisam entrar no formato de export.

## Próximos passos sugeridos

1. **Achar o código que lê o bloco**: não há referência absoluta direta a `$07:87EC` no código. O acesso
   provavelmente é indireto, via ponteiro ou índice calculado. Caminho: no bsnes-plus, colocar um
   breakpoint de leitura em `$07:87EC-$07:8846` (Alemanha) ao iniciar uma partida e ver qual rotina copia
   os bytes para a RAM e para onde vai cada nibble.
2. **Testes A/B no emulador** (um nibble por vez, num jogador fácil de observar, ex.: atacante do Brasil):
   - `b4.hi` 0 vs 15 → chutes a gol / finalização?
   - `b4.lo` 0 vs 15 → desarmes / marcação?
   - `b3.hi`, `b0.hi`, `b0.lo` → drible, passe, aceleração, cabeceio?
   - Teste extremo: um time inteiro com todos os ocultos em 0 contra a CPU.
3. **Cruzar com a tela de jogadores do jogo**, se o modo de seleção mostrar barras/estrelas por atributo.
4. **Comparar com o Jikkyou World Soccer 2** (versão japonesa): a estrutura deve ser a mesma, e o manual
   japonês pode nomear os atributos.
5. Depois de nomear os campos: expor na `PlayerEditor`, limitar velocidade a 0-7 se confirmado, e
   incluir os campos no export/import JSON.

## Scripts usados

Disassembler 65816: `research/tools/disasm65816.mjs` (ver `research/scenario-mode.md`). Útil para o
passo 1 acima.

Os scripts de análise eram temporários (pasta temp). Para refazer:

- dump dos 6 bytes por jogador com nome: ler `0x387EC + t*90 + p*6` e `0x3B62C + t*120 + p*8`
  (nomes, tabela de caracteres em `ISS_CHAR_TABLE`);
- linha de cada jogador: tabela de formação via ponteiros em `0x382E4` (ver `src/rom/formation.js`).
