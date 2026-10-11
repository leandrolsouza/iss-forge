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
| Textos do treino (instruções, comentários, recorde, mensagens, títulos) e textos de 19 telas de menu; compressor Konami com parse ótimo | aba Textos do Jogo | `game-texts.md` |
| Exportar/importar todos os textos em JSON (importa o que couber, lista o resto; tira acentos); telas de menu que não cabem são movidas/reorganizadas no espaço livre | aba Textos do Jogo | `game-texts.md` |
| Textos desenhados pelo código: tela de controles (títulos, ajudas, rótulos), cenário (placar, relógio, resultado), "NEXTGAME" do grupo, ordinais da World Series, "LEVEL" do treino; Senha, Grupo da Cup e Treino: pontuação agora podem ser movidas | aba Textos do Jogo > Outras telas | `game-texts.md` (seção 4) |
| Menu principal (listas de sprites montadas com a fonte grande do menu) e os 7 títulos dos modos (tilemaps com a fonte dos títulos, realocáveis como as telas de menu) | aba Textos do Jogo > Outras telas | `game-texts.md` (seção 5) |
| Alfabeto completo nas fontes grandes: no menu, B F J montadas e H Q V X Z desenhadas (ocupam letras 16x16 não usadas); nos títulos, B J montadas e K Q V X Y Z desenhadas (tiles novos no bloco da fonte) | aba Textos do Jogo > Outras telas | `game-texts.md` (seção 5) |

## Tradução PT-BR — estado (para continuar)

- **Arquivos:** `game-translations/EN.json` (exportado da ROM original) e `game-translations/PT-BR.json`
  (tradução em andamento), versionados no git. Os dois já têm a seção `screens` (Outras telas).
- **Como retomar:**
  1. Abrir a ROM original no editor.
  2. Ir em Textos do Jogo > Importar JSON e escolher `PT-BR.json`.
  3. Hoje entra tudo: 0 textos de fora e só o aviso de acentos. São movidas 8 telas de menu (pré-jogo,
     Regras, Táticas, Senha, Tabela da fase, World Series: jogos e resultados, Treino: nome) e 5 títulos
     (Copa, Copa final, Série Mundial 1ª e 2ª, Partida especial).
  4. O arquivo foi reexportado: os `max` dos menus são os atuais e o `original` é o texto da ROM original.
- **Nomes escolhidos:** menu AMISTOSO, COPA INTERNACIONAL, SERIE MUNDIAL, TREINO, CENARIOS, PENALTIS,
  SENHA (o H foi desenhado no lugar do K), OPCOES. Títulos: COPA / INTERNACIONAL (+ FINAL,
  TORNEIO), CAMPEONATO, SERIE MUNDIAL / TEMPORADA 1 e 2, PARTIDA ESPECIAL. "WORLD SERIES" nas telas da
  World Series também virou SERIE MUNDIAL (antes "COPA DO MUNDO").
- **Teste automático:** `src/utils/__tests__/textsExport.test.js` importa o `PT-BR.json` quando ele existe,
  inclusive por cima de uma importação anterior.
- **Conferido no emulador com a tradução:**
  - menu principal (ligando o jogo do zero) e os títulos da Copa e da Série Mundial 1ª temporada;
  - menus: pré-jogo (Open Game e torneios), 1P x CPU, Regras, Táticas, Opções, Grupo da Cup, World Series:
    jogos, Treino: menu e nome, Senha e Digitar senha;
  - outras telas: controles do joypad (todas as 10 ajudas), cenário antes da partida ("GOLS 0-0
    HORA 02:00"), "PROXIMO: [bandeira] VS [bandeira]" no grupo, "1a. TEMPORAD" / "1a. FASE PARTIDAS" na
    World Series, "NIVEL 1" no treino.
- **Ainda não vistas no jogo:** pré-jogo curto, Som, Tabela da fase, World Series: resultados, Parabéns,
  Treino: níveis e pontuação; os títulos FINAL, TORNEIO, CAMPEONATO, TEMPORADA 2 e PARTIDA ESPECIAL; no
  cenário, "EXTRA TIME" e as mensagens de vitória/derrota (a partida não terminou no emulador: o relógio
  chega a 0:00 e o jogo continua até uma parada). Caminhos de menu em `research/tools/README.md`
  (botões com `hold:BTN:10`; o menu principal começa em OPEN GAME, ↑ vai para OPTIONS e ↑↑ para
  PASSWORD).
- **Na tradução atual:** o texto do cenário 1 termina com "XXX" (veio assim do arquivo anterior; parece
  marcador de teste).
- **Textos vistos em inglês que ainda não têm editor** (todos são sprites ou gráficos, não texto):
  - tela de táticas por linha ("Defensive | Offensive", DF/MF/FW), que é outra tela;
  - "Referee" e os nomes dos árbitros na tela de Regras;
  - "TIME NAME SCORE NAME" no ranking do treino, "BONUS TIME", "TIME", "TIME UP" no exercício;
  - "1P"/"2P" e "TYPE A" na tela de controles; "VS" entre os nomes antes da partida; "PRESS START";
  - textos da partida (placar, GOAL, posições na barra inferior);
  - logotipo da tela título.
  Os nomes dos times nos quadros (ITALY, ROMANIA...) são editados na aba Nome do Time.

## Pendente — prioridade sugerida

### 1. Fontes grandes: alfabeto completo (feito)
- Menu principal e títulos têm as 26 letras (`game-texts.md`, seção 5). Limites: no menu, cada letra
  desenhada (H Q V X Z) precisa de uma letra 16x16 que nenhum item use; nos títulos, cabem 3 das letras
  desenhadas (K Q V X Y Z) ao mesmo tempo.
- Faltam os dígitos 0 e 3-9 nos títulos e acentos nas duas fontes.
- Para caber mais letras nos títulos: mover o bloco de 14 bytes em `0x97E50` (ponteiro `0x103D4`) libera
  14 bytes logo depois do bloco da fonte (4 letras passariam).
### 2. Restante da tradução
O que sobrou em inglês são gráficos/sprites (lista acima) e alguns textos achados sem tela conhecida.
Sugestão de ordem:
- **Conferir no jogo** o que foi editado mas ainda não visto: mensagens de vitória/derrota e "EXTRA TIME"
  do cenário, Treino: pontuação (agora móvel), Senha (agora móvel e movida pela importação), Som, Tabela
  da fase, World Series: resultados, Parabéns.
- **Textos sem leitor achado** (em `game-texts.md`, seção 4): títulos "ASIAN LEAGUE" / "INTERNATIONAL CUP"
  / "WORLD SERIES 1ST STAGE" (`0x17621`, tabela `$87:A86A`), "NEXT GAME      VS" (`0x12A94`), "OK"/"NO"
  (`0x12B05`). Nenhum código lê esses endereços (nem `LDY #`/`LDA` direto, nem a tabela), e "ASIAN LEAGUE"
  não existe nesta versão: provavelmente sobraram da versão asiática da qual esta foi adaptada. Fora do
  editor; só voltar a isso se aparecer uma tela que os use.
- **Rótulos curtos do cenário:** "SCORE" (5) e "TIME" (4) têm o número em posição fixa. Para caber
  "PLACAR"/"TEMPO" seria preciso mudar o `LDX` em `$87:D464`/`$87:D4F4` e os textos juntos (patch de código).
- **Sprites e gráficos:** "1P"/"2P", "TYPE A", "VS" antes da partida, "TIME UP", "BONUS TIME", placar e
  posições da partida, "Referee" e árbitros, logotipo. Exigem editar tiles (Tile Explorer). A técnica de
  corromper fatias da ROM e ver o que estraga (`game-texts.md`, seção 5) acha rápido de onde vêm.
- **Ponteiros extras** que reaproveitam textos do treino (ver `game-texts.md`): conferir se alguma tela usa.
- **Acentos:** não existem nas fontes. Seria preciso desenhar tiles novos na fonte 8x8 e na 8x16 e mapear
  códigos livres.

### 3. Outras ideias da lista original
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

## Descartado

- **Nome do time sem truncar ao copiar** (ex.: Alemanha no lugar da Itália vira "GERMA"). Não é limite
  do jogo, que mostra até ~9 letras (ARGENTINA): os 27 nomes do menu são listas de sprites coladas em
  `0x43ED5`-`0x44486` (1458 bytes, 1443 usados no original), e os ponteiros (`0x39DAE`) são de 16 bits no
  banco `$88`, onde só sobram 91 bytes livres. Daria para tentar uma codificação mais compacta (mais
  pares de letras num sprite só), mas não vale o esforço agora.

## Dívida técnica observada
- ~300 avisos de lint antigos (o ESLint não reconhece o uso de componentes em JSX: falta o
  `eslint-plugin-react`; `console.log` nos writers de nome/bandeira).
- Bundle > 500 kB (aviso do Vite): considerar code-splitting das abas.
- `docs/` está no `.gitignore`; a documentação técnica foi para `research/`.
