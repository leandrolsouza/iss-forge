# Pesquisa: torneios (International Cup / World Series) e ordem dos times

> Status: **implementado no editor** (aba Torneios, out/2026). Validado no emulador.
> ROM de referência: *International Superstar Soccer (Europe)*, 1 MB, sem header, CRC32 `6CD568A9`.

## Ids dos times

O jogo identifica cada time pelo **ordinal** da ROM. A Escócia é o 5 e o Super Star, o 26 (é a mesma
ordem de `FLAG_DESIGN_ORDINALS`). Em `$1720` (time 1) e `$1770` (time 2) o valor fica guardado como
`ordinal × 2`.

| Tabela | Ordem |
|--------|-------|
| Nomes dos jogadores (`0x3B62C`) | `TEAMS` (Escócia = 24) |
| Atributos dos jogadores (`0x387EC`, ponteiros em `$01:DED7`) | **ordinal** (Escócia = 5) |
| Bandeiras, descrições, paletas, cenários, sorteios | ordinal |

**Bug corrigido:** o editor lia os atributos pela ordem `TEAMS`. Por isso os times 5 a 24 mostravam os
números, cabelos e atributos do time vizinho; a Gales, por exemplo, aparecia com os da Escócia.
Confirmei no emulador: jogando com a Escócia (id 5) e com Gales (id 6), as fichas em `$7E:A010` batem
com os blocos 5 e 6. Agora `playerDataAddress()`, em `src/rom/readers/PlayerReader.js`, segue a tabela
de ponteiros.

## Ordem na tela de seleção

Não existe tabela. Com ↑/↓ o id em `$1720` anda de 1 em 1, de 0 a 25, e dá a volta (o Super Star fica de
fora). A ordem é `Germany, Italy, Holland, Spain, England, Scotland, Wales, France, ..., Cameroon,
S.Korea`. O time que aparece primeiro no 1P é a Itália (id 1). Mudar a ordem exigiria patch de código.

## Sorteios dos torneios — `$87:A17B` (arquivo `0x3A17B`)

São **32 sorteios × 24 bytes**, cada byte = `ordinal × 2`. Cada sorteio tem 6 grupos de 4 (A-F) na
ordem dos bytes.

### Como o jogo usa

1. `$05:8A95` monta, em `$041C`, a lista dos sorteios que contêm o time do jogador (`$1720`). A busca é
   feita por `$05:8AC4`.
2. `$05:8AE1` sorteia um deles: `rand & 31` até cair num índice válido. Guarda o índice em `$1FAC`
   (usado na senha/continuação por `$05:8AD8`) e copia os 24 bytes para o destino.
   - **International Cup** (`$05:89D4`): o destino é `$7E:9090`. Depois disso:
     - `$1A1C` = grupo sorteado (`rand & 7` até ser < 6);
     - `$87:D89B` embaralha as 4 posições desse grupo;
     - o time do jogador vai para a primeira vaga do grupo, e o time que estava ali vai para a vaga
       original do jogador.
     - Na prática, o grupo do jogador é **sorteado**, não é o do sorteio.
   - **World Series** (`$06:C8F3`): o destino é `$7E:9128`. A liga de 24 times é o sorteio tal como
     está. A tabela de jogos (pares de vagas × 2) fica logo depois, em `$87:A47B`, e é lida em
     `$06:C93D`/`$06:CA26`.
3. Se o time escolhido **não estiver em nenhum sorteio**, a lista fica vazia e o laço em `$05:8AE4`
   nunca termina: o jogo trava. O editor bloqueia esse caso.

### Dados originais

- Cada time selecionável aparece em 26 a 32 sorteios. O Super Star não aparece em nenhum.
- O sorteio 4 tem Camarões duas vezes (Holanda, Suécia e Brasil ficam de fora). O editor avisa, mas
  preserva.

### Validação no emulador

- Com a Itália, o jogo escolheu o sorteio 32. O grupo B mostrou Itália, Romênia, Suécia e Brasil, o grupo
  B desse sorteio fora de ordem. `$7E:9090` tinha os 24 ids do sorteio.
- Com a Alemanha, saiu outro sorteio (grupo B: Alemanha, Espanha, Suíça, Noruega).
- Gravei os 32 sorteios iguais a `[ITA, SS, BRA, ARG | GER, ENG, FRA, HOL | ...]`. Com a Itália, ela foi
  para o grupo B e trocou de lugar com a França. O Super Star apareceu no grupo A sem problema.
- World Series com a Itália: a liga em `$7E:9128` era exatamente o sorteio 26.

## Fase final

A classificação e o mata-mata da International Cup são definidos no código (não há tabela de times).
Não foram mapeados.

## Editor

- `src/rom/tournament.js` tem `readDraws`, `writeDraw`, `validateDraws` e `drawCoverage`.
- Aba **Torneios**: 32 sorteios, 6 grupos editáveis, aviso de time repetido, bloqueio quando um time
  selecionável some de todos os sorteios, contagem de presença por time, embaralhar e restaurar.
- O undo guarda os 768 bytes dos sorteios.
