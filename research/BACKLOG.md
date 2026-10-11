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
| Todos os atributos dos jogadores (3 velocidades, disputa no ataque/defesa, chute do goleiro); barra SPEED igual à do jogo; JSON v2 | aba Jogadores | `hidden-player-attributes.md` |
| Correção: atributos/número/cabelo lidos na ordem ordinal (times 5-24 estavam trocados) | aba Jogadores | `tournaments.md` |
| Sorteios da International Cup / World Series (32 × 6 grupos), com trava contra o freeze | aba Torneios | `tournaments.md` |

## Pendente — prioridade sugerida

### 1. Textos do jogo / tradução PT-BR
- Já mapeado: textos de cenário (`0x114AF`), descrições dos times (`0x1202C`), dicas do treino e
  mensagens (`0x10D00`-`0x11300`, ASCII, mesma fonte), fonte `$82:8C80`.
- Falta: tabela dos **menus** (letras A=`0x61`, ex. `0x11661` "PENALTY"); mapear e criar um editor de
  strings com controle de espaço.
- Acentos não existem na fonte: seria preciso desenhar tiles novos (Tile Explorer + compressor Konami).

### 2. Tela título e logos
- Usar o Tile Explorer + `KonamiCodec`. Falta localizar tilemap/paleta da tela título.

### 3. Nome do time sem truncar ao copiar
- A área de nomes do menu (`0x43ED5`-`0x44486`) fica cheia e nomes longos são cortados (ex.: copiar
  Alemanha para o lugar da Itália gera "GERMA"). Ideia: realocar a área para espaço livre e
  atualizar os ponteiros (`0x39DAE`).

### 4. Outras ideias da lista original
- Comparar duas ROMs (diff por time/campo).
- Importar planilha CSV de elencos.
- Gerador aleatório de times (com seed).
- Exportar "projeto" completo (JSON com cenários, paletas e torcidas, além dos times).
- Regras (duração, árbitro), nomes > 8 letras, áudio: exigem patch de código 65816.
- Separar uma paleta de torcida compartilhada (precisa de espaço livre para um blob novo).
- Condição dos jogadores (rostinhos): é sorteada antes da partida (`$1870`, `$05:A7CB`). Fixar exige patch de
  código.
- Torneios, o que ficou de fora:
  - tabela de jogos da World Series (`$87:A47B`, pares de vagas × 2);
  - mata-mata da International Cup (no código);
  - patch para deixar o Super Star selecionável. Hoje o id vai de 0 a 25 na seleção, e o Super Star
    precisaria estar em algum sorteio, senão o jogo trava.
- Auditar outras tabelas por time que o editor indexa pela ordem `TEAMS` (só os nomes usam essa ordem;
  atributos, bandeiras etc. usam o ordinal).

## Dívida técnica observada
- ~300 avisos de lint antigos (o ESLint não reconhece o uso de componentes em JSX: falta o
  `eslint-plugin-react`; `console.log` nos writers de nome/bandeira).
- Bundle > 500 kB (aviso do Vite): considerar code-splitting das abas.
- `docs/` está no `.gitignore`; a documentação técnica foi para `research/`.
