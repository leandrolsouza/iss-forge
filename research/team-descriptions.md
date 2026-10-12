# Pesquisa: descrições dos times (tela de seleção)

> Status: **implementado** (aba "Formação" → "Descrição na tela de seleção") e **validado em jogo**.
> ROM de referência: *International Superstar Soccer (Europe)*, CRC32 `6CD568A9`.

## Onde estão

| O quê | Arquivo | SNES | Formato |
|-------|---------|------|---------|
| Ponteiros | `0x38000` | `$87:8000` | 27 words, ordem ordinal da ROM (Escócia = 5), banco `$02` |
| Textos | `0x1202C`-`0x12A93` | `$82:A02C` | ASCII, 2664 bytes no total |

A tabela de ponteiros vem logo antes dos ponteiros dos cenários (`0x38036`). Na tela de seleção
(`$00:E07C`) o jogo lê, na mesma rotina, o ponteiro da formação (`$87:82E4`) e o da descrição (`$87:8000`).

## Formato

- Caixa de **15 colunas × 8 linhas** (medido nos textos originais, que são completados com espaços para
  quebrar exatamente em 15 colunas, e conferido por screenshot).
- `FE xx` = troca de cor/atributo (paleta `(xx >> 2) & 7` do blob `0x2F3DB`): `FE 2C` (rosa, títulos
  "Offensive"), `FE 24` (verde-claro, "Defensive"; conferido por screenshot da Alemanha, out/2026),
  `FE 20` (normal: branco com contorno azul). Quatro originais também colorem nomes no corpo com `FE 28`
  (amarelo) e `FE 30` (violeta), ex.: `0x1241E` "GK FE30 Van Riet FE20".
- `FD` = nova linha (limpa o resto da linha); `FF` = fim.
- Layout original: título na linha 1, uma linha em branco, corpo com até 6 linhas.
- Como nos cenários, alguns originais se sobrepõem: um texto "entra" no próximo e é só cortado em 8
  linhas. O editor regrava os 27 textos em sequência. A aparência fica igual, mas os bytes mudam; por isso
  o Desfazer usa um snapshot dos bytes. Desde out/2026, as descrições não editadas que têm cores no corpo
  são regravadas com os bytes exatos (`readTeamDescriptionRaw`); antes, editar qualquer descrição apagava
  essas cores.

## Fonte

A mesma dos textos de cenário (tabela `$82:8C80`): `` !"',-.0-9:?A-Za-z``, sem acentos.
