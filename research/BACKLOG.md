# Backlog do editor (próximas sessões)

Resumo do que **já existe** e do que **falta**, com o contexto necessário para continuar.
Pesquisas detalhadas estão nos outros arquivos de `research/`; as ferramentas, em `research/tools/`.

## Feito (out/2026)

| Recurso | Onde | Pesquisa |
|---------|------|----------|
| Exportar patch BPS/IPS + checksum automático | barra de título / Ctrl+E | — |
| Formação padrão e escalação | aba Formação | `src/rom/constants.js` (FORMATION_DATA) |
| Descrição dos times na tela de seleção | aba Formação | `team-descriptions.md` |
| Modo Scenario | aba Cenários | `scenario-mode.md` |
| Gramado (tipo × clima), bola, árbitro | aba Campo e Bola | `match-palettes.md` |
| Estádio (muro/rede, fotógrafos) e torcida por time | aba Campo e Bola | `match-palettes.md` |
| Copiar/trocar time inteiro de lugar | aba Visão Geral | — |
| Testar no emulador (F5) | barra de título / menu | Configurações > Editor |
| Undo/redo byte a byte (nomes, descrições, bandeiras, formação, jogadores) | — | snapshots em `useRomState` |
| JSON leva atributos ocultos, formação, descrição, bandeira, cabelo/pele especial | Visão Geral | — |

## Pendente — prioridade sugerida

### 1. Atributos ocultos dos jogadores
- Pesquisa inicial em `hidden-player-attributes.md` (bytes 0 e 4 e nibble alto do byte 3; estatística por
  posição).
- Plano: com `research/tools/emu-seq.cjs`, rodar partidas CPU x CPU com um nibble zerado/maximizado num
  time inteiro e medir efeito (gols, chutes, desarmes). Achar a rotina que copia o bloco para a RAM
  (breakpoint/leitura na WRAM).
- Junto: limitar **velocidade** a 0-7 na UI (o jogo só usa 3 bits; a UI aceita 1-16).

### 2. Torneios e ordem dos times
- Grupos da International Cup / World Series e a ordem dos times na seleção: **não pesquisado**.
- Pista: o menu de cenários usa a tabela de times `0x9CAE` com ordinal×2; os torneios devem usar
  estruturas parecidas. O menu de seleção também usa ordinais.

### 3. Textos do jogo / tradução PT-BR
- Já mapeado: textos de cenário (`0x114AF`), descrições dos times (`0x1202C`), dicas do treino e
  mensagens (`0x10D00`-`0x11300`, ASCII, mesma fonte), fonte `$82:8C80`.
- Falta: tabela dos **menus** (letras A=`0x61`, ex. `0x11661` "PENALTY"); mapear e criar um editor de
  strings com controle de espaço.
- Acentos não existem na fonte: seria preciso desenhar tiles novos (Tile Explorer + compressor Konami).

### 4. Tela título e logos
- Usar o Tile Explorer + `KonamiCodec`. Falta localizar tilemap/paleta da tela título.

### 5. Nome do time sem truncar ao copiar
- A área de nomes do menu (`0x43ED5`-`0x44486`) fica cheia e nomes longos são cortados (ex.: copiar
  Alemanha para o lugar da Itália gera "GERMA"). Ideia: realocar a área para espaço livre e
  atualizar os ponteiros (`0x39DAE`).

### 6. Outras ideias da lista original
- Comparar duas ROMs (diff por time/campo).
- Importar planilha CSV de elencos.
- Gerador aleatório de times (com seed).
- Exportar "projeto" completo (JSON com cenários, paletas e torcidas, além dos times).
- Regras (duração, árbitro), nomes > 8 letras, áudio: exigem patch de código 65816.
- Separar uma paleta de torcida compartilhada (precisa de espaço livre para um blob novo).

## Dívida técnica observada
- ~300 avisos de lint antigos (o ESLint não reconhece o uso de componentes em JSX: falta o
  `eslint-plugin-react`; `console.log` nos writers de nome/bandeira).
- Bundle > 500 kB (aviso do Vite): considerar code-splitting das abas.
- `docs/` está no `.gitignore`; a documentação técnica foi para `research/`.
