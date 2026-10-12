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
| Tela inicial: cores (logo, brilho do logo, pincelada, TM, céu, gramado, textos), times dos dois jogadores, copyright e PRESS START (dígitos e pontuação desenhados no estilo sombreado), importar logo de imagem (PNG) e esconder a pincelada; pincelada e gramado: remover ou trocar por imagem/textura; pose dos dois jogadores (864 quadros das animações); mover/esconder a bola, as sombras e os jogadores; prévia desenhada a partir da ROM; textos no JSON | aba Tela Inicial | `title-screen.md` |
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
  - "1P"/"2P" e "TYPE A" na tela de controles; "VS" entre os nomes antes da partida;
  - textos da partida (placar, GOAL, posições na barra inferior).
  O PRESS START, o copyright e o logo da tela inicial já têm editor (aba Tela Inicial).
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
  posições da partida, "Referee" e árbitros. Exigem editar tiles (Tile Explorer). A técnica de
  corromper fatias da ROM e ver o que estraga (`game-texts.md`, seção 5) acha rápido de onde vêm.
- **Ponteiros extras** que reaproveitam textos do treino (ver `game-texts.md`): conferir se alguma tela usa.
- **Acentos:** não existem nas fontes. Seria preciso desenhar tiles novos na fonte 8x8 e na 8x16 e mapear
  códigos livres.

### 3. Outras ideias da lista original
- Comparar duas ROMs (diff por time/campo).
- Importar planilha CSV de elencos.
- Gerador aleatório de times (com seed).
- Exportar "projeto" completo (JSON com cenários, paletas, torcidas, torneios, textos e tela inicial, além
  dos times).
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

### 4. Gráficos e espaço (ideias novas, out/2026)
- **Visualizador de telas** (o "Tile Explorer" que o README anuncia não existe no código): generalizar a
  prévia da tela inicial (`renderTitleScreen`: listas de carga `$82` → VRAM, paletas, BG/OBJ) para montar
  qualquer tela do jogo. Serve para conferir traduções sem emulador e para achar os gráficos da seção 2.
  Alternativa mínima: tirar a menção do README.
- **Fundos das outras telas:** o fundo azul do menu ("SUPER STAR SOCCER" repetido) e o da seleção de times
  têm a mesma estrutura do BG1 da tela inicial; reaproveitar `titleBackground.js` (importar imagem/textura,
  cores) e `quantize.js`.
- **Expandir a ROM para 2 MB:** resolveria a falta de espaço (logo importado maior/com mais cores, gramado
  em imagem inteira, telas traduzidas longas). Mexe no cabeçalho, checksum, validação e patches; só fazer
  quando o espaço virar problema.
- **Tela inicial, o que ficou de fora** (`title-screen.md`): desenhar quadros novos para os jogadores
  (exige espaço e um registro novo no banco `$82`; os quadros atuais são da partida); usar as poses que
  dependem de tiles deixados por outro quadro (hoje descartadas).

## Melhorias nas abas existentes (revisão de código, out/2026)

Achados de leitura do código (não reproduzidos no app; confirmar cada bug antes de corrigir). Ordem
sugerida: 5.1 → 5.2 (com testes do desfazer) → prévia real do jogador (5.3) → resto.

### 5.1 Bugs que podem perder ou estragar dados (prioridade máxima)
- **Bandeiras gravadas só ao salvar** (`dirty`, `useRomHandlers.js` ~268-310):
  - copiar/trocar time recarrega todos os times da ROM (`handleCopyTeam`) e perde desenhos pendentes de
    qualquer time; `copyTeam` lê a bandeira de origem da ROM (`teamExport.js` ~238), sem o desenho novo;
  - o backup automático grava a ROM sem as bandeiras pendentes (`useAutoSave.js` ~24);
  - `prepareRomForWrite` ignora o `false` de `writeFlagDesign` quando a bandeira não cabe (só
    `console.error` em `FlagDesignWriter.js` ~176-182) e muda `dirty` direto no estado do React.
  - Correção: gravar ao terminar cada traço (o undo já restaura os bytes exatos via `flagBytes`) e avisar
    quando não couber.
- **Nome do Time grava no time errado:** os refs dos campos não são reiniciados ao trocar de time
  (`TeamNameEditor.jsx` ~15-33, editor sem `key` por time em `App.jsx`); o `onBlur` grava mesmo sem
  mudança. Também: o campo aceita sempre 10 letras, mas `getSlotMaxChars` existe e não é usado; quando o
  nome é cortado, a barra de status mostra o texto pedido, não o gravado.
- **Nome do placar (3 letras) nunca é lido da ROM:** `readTeam` não lê `teamNameInGame`; `exportTeam` usa
  as 3 primeiras letras do nome do menu, e copiar/trocar/exportar JSON sobrescreve os tiles reais do placar.
  Correção: ler os tiles 2bpp de volta (inverso de `TeamNameTileFont`) ou exportar/copiar os bytes crus.
- **Gerador IA cria 2 passos de desfazer** (`AIGeneratorPanel.jsx` ~201-205: snapshot + 
  `handleFlagDesignBulkChange`, que faz outro): um Ctrl+Z deixa o time pela metade. `applyImportedTeam`
  já grava a bandeira; tirar a chamada extra.
- **Restaurar o backup automático vira o "original":** `BackupBanner.jsx` carrega o backup como ROM nova
  (`originalData` = backup), então "Restaurar original" e a base do patch usam dados editados, e
  `modified=false` desliga o aviso ao fechar. Também: `performUndo` usa `canUndo` desatualizado para
  `modified`, sem ponto de "salvo"; a troca modified→false limpa o backup (`RomContext.jsx`). Correção:
  guardar os bytes/caminho originais no backup, marcar como modificado, controlar uma revisão salva.

### 5.2 Desfazer e padrão de edição
- **Seletores de cor** (Uniformes, Cabelo e Pele, Cores da Bandeira) gravam e criam um passo de desfazer a
  cada movimento (`onChange`); Cabelo e Pele grava 2 vezes por movimento (1º e 2º uniforme). O campo hex
  não aceita digitação parcial. Usar `ColorSwatch.jsx` (grava ao fechar o seletor / blur / Enter), um
  handler em lote para os dois uniformes e mostrar a cor arredondada para 15 bits.
- **Design da Bandeira:** um passo por pixel; Preencher/Limpar fazem 384 passos e o histórico (50,
  `useHistory.js`) perde tudo o que havia antes. Juntar o traço num grid local e gravar no mouseup com
  `onFlagDesignBulkChange`.
- **Jogadores e Formação** gravam a cada tecla (`PlayerEditor.jsx` ~165-206, `FormationEditor.jsx`
  ~267-327); o número da camisa não pode ficar vazio (vazio vira 1). Gravar no blur/Enter ou juntar
  edições do mesmo campo em ~500 ms. `TeamPreview` rotula posições pelo índice da lista e o PlayerEditor
  pela formação.
- **Ctrl+Z dentro de caixas de texto** vai para o desfazer global (`electron/main.mjs`, `App.jsx`) e os
  rascunhos são refeitos quando o estado muda (Cenários, Textos do Jogo, Outras telas, Menus): perde o
  texto não aplicado. Trocar de cenário/sorteio/tela também descarta o rascunho sem aviso. Deixar o Ctrl+Z
  nativo quando um input tem foco e guardar rascunhos por item (ou perguntar).
- **Passos de desfazer vazios:** importar time tira o snapshot antes de abrir o arquivo (cancelar deixa um
  passo); gravações recusadas (nomes, cenário, menu, descrição, treino) também. Tirar o snapshot depois de
  validar ou descartar quando falhar.
- **Testes:** `useHistory`, `useRomState.applySnapshot`/`performUndo` e `useRomHandlers` não têm testes
  (onde estão quase todos os bugs acima). Casos: copiar time com bandeira pendente, goleiro Super
  Star/Bélgica, IA aplicar + desfazer, `reloadTeams` além da formação.

### 5.3 Prévias aproximadas → desenho real
- Hoje são SVG/aproximações: gramado e bola (`MatchPaletteEditor.jsx`), camisa (`UniformEditor.jsx`),
  mini-uniformes (`TeamPreview.jsx`), cores da bandeira em 4 listras (`FlagColorEditor.jsx`), cores
  aproximadas na descrição (`TeamDescriptionPanel.jsx`); Cabelo e Pele não tem prévia; textos de
  cenário/treino/outras telas em texto monoespaçado; menus sem prévia.
- Plano: separar as partes genéricas de `titleScreen.js` (`buildVram`, `tilePixel`, `drawBg`,
  `drawSprites`, `setPixel`, CGRAM) num módulo `snesRender` compartilhado.
  - Uniformes e Cabelo/Pele: jogador real com `playerSprites`/`renderPoseSheet` e a paleta do time (M).
  - Cores da Bandeira: desenhar a bandeira real (`team.flagDesign` já está carregado) (S).
  - Textos e menus: fonte do jogo + tilemaps dos menus descomprimidos (M).
  - Gramado da partida real: precisa pesquisar as listas de carga da tela da partida (L).

### 5.4 Acabamento
- **Textos fora do i18n:** "Camisa 1/Calcao/Meiao" (`UniformEditor.jsx`), "Fechar" (`TabBar.jsx`),
  "Recolher" (`Sidebar.jsx`), mensagens de `validation.js`, menus do Electron (em português);
  "Export JSON"/"Import JSON" (`TeamPreview.jsx`), rótulos de `MODES` (`GameTextEditor.jsx`), títulos de
  botões (`App.jsx`), mensagens de status em `useRomHandlers.js` (em inglês); letras C/V/S/T
  (`TeamPreview.jsx`). Nomes das abas são guardados ao abrir (`'Players'` fixo em `useRomState.js`) e não
  mudam com o idioma: guardar a chave i18n. 13 `console.log` em `TeamNameWriter.js`.
- **Validação e configurações:** `validateRom` roda ao salvar mas só vai para o console; o editor de
  jogadores não marca número repetido nem nome vazio. `confirmBeforeSave`, `autoBackupBeforeSave` e
  `defaultExportPath` (`SettingsPage.jsx`) não são usados: ligar ou remover.
- **Dados compartilhados sem aviso:** uniforme e cabelo/pele do goleiro do Super Star usam os endereços da
  Bélgica (`UniformReader.js`); blocos de bandeira podem ser compartilhados (`FlagDesignWriter.js`, não
  confirmado na ROM original). Copiar o aviso da torcida (`MatchPaletteEditor.jsx`).
- **Dados não editáveis / restaurar:** cor predominante do time (`0x8DB2`, decide o 2º uniforme quando os
  dois times têm a mesma cor) não aparece na aba Uniformes. Modelos e ajustes do gramado partem sempre da
  paleta original e descartam edições manuais. Falta "Restaurar original" em Uniformes, Cabelo e Pele,
  Cores e Design da Bandeira, Nome do Time, Jogador, textos de menu e descrição (um helper comum lendo de
  `new RomParser(getOriginalData())`, como em Cenários). "Aplicar" da descrição não é desabilitado com
  caracteres inválidos.
- **Listas e navegação:** seletor de times sem busca nem setas (`TeamSelector.jsx`, opções são `div`);
  barra lateral com `div` clicável (sem foco), lista escrita duas vezes (recolhida/expandida) e sem
  destaque da aba aberta; sem busca nos textos; Comparar Times só compara as 4 médias e casa jogadores pela
  posição na lista.
- **Testes faltando:** `quantize.js`, `playerStats.js`, `flagTemplates.js`, `hairSkinTemplates.js`,
  `imageToFlag.js`, `imageToLogo.js`, `fileHelpers.js`; testados só de forma indireta: `menuSprites.js`,
  `titleScreens.js`, `titleScreenText.js`, `titlePlayers.js`. Conferir se `FlagDesignReadWrite.test.js`
  cobre os caminhos de mover blocos e "não cabe".

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
- O README anuncia um "Tile Explorer" que não existe (ver seção 4).
