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
| Visualizador de telas: 10 telas (menu principal, pré-jogo e pré-jogo dos torneios, substituições, seleção de times, opções, controles, digitar senha, treino: instruções e nome) + tela inicial, desenhadas da ROM atual (listas de carga ``, paletas ``, PPU dos save states: modo 1, colour math das caixas); camadas liga/desliga; clique mostra o tile, a paleta e o bloco da ROM de onde vêm o tile e a célula do mapa; tiles do bloco em grade com troca de paleta; textos desenhados pelo código onde a posição é conhecida | aba Visualizador de Telas | `screen-viewer.md` |
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
- **Sprites e gráficos:** "1P"/"2P" (são tiles do BG1 da tela de controles: `0x6AD98` em `$2100` e `0xBE7D3` em `$2180`, mapa `0x671D9`), "TYPE A", "VS" antes da partida, "TIME UP", "BONUS TIME", placar e
  posições da partida, "Referee" e árbitros. Exigem editar tiles (visualizador de telas, seção 4). A técnica de
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
- ~~**Visualizador de telas.**~~ Feito (out/2026): `src/rom/screenView.js` + aba Visualizador de Telas;
  receitas tiradas de save states (`research/tools/screen-recipe.mjs`) e conferidas contra screenshots
  (`screen-check.mjs`: ≥ 96% nas telas sem listas de jogadores). Detalhes em `screen-viewer.md`.
  **Falta:** sprites fora do menu principal (cursor, rostos, bandeiras, "TYPE A"), listas de nomes de
  jogadores, mais telas (cenário, grupo da Copa, tabela da fase, World Series, Parabéns, títulos dos
  modos); usar o inspetor para localizar os gráficos da seção 2.
- **Fundos das outras telas:** o fundo azul do menu ("SUPER STAR SOCCER" repetido) e o da seleção de times
  têm a mesma estrutura do BG1 da tela inicial; reaproveitar `titleBackground.js` (importar imagem/textura,
  cores) e `quantize.js`. Localizado com o visualizador: é o BG2 de todos os menus (tiles `0xADECC` em
  `$3000`, mapas `0xD45D8`/`0xD4724` em `$1000`/`$1400`, lista `$82:86DC`), compartilhado entre as telas.
- **Expandir a ROM para 2 MB:** resolveria a falta de espaço (logo importado maior/com mais cores, gramado
  em imagem inteira, telas traduzidas longas). Mexe no cabeçalho, checksum, validação e patches; só fazer
  quando o espaço virar problema.
- **Tela inicial, o que ficou de fora** (`title-screen.md`): desenhar quadros novos para os jogadores
  (exige espaço e um registro novo no banco `$82`; os quadros atuais são da partida); usar as poses que
  dependem de tiles deixados por outro quadro (hoje descartadas).

## Melhorias nas abas existentes (revisão de código, out/2026)

Achados de leitura do código (não reproduzidos no app; confirmar cada bug antes de corrigir). Ordem
sugerida: ~~5.1~~ → ~~5.2~~ → prévia real do jogador (5.3) → resto.

### 5.1 Bugs que podem perder ou estragar dados (feito, out/2026)
- **Bandeiras:** cada traço (e Preencher/Limpar/modelo/imagem) é comprimido na ROM ao soltar o mouse, como
  um passo de desfazer (`handleFlagDesignBulkChange`); não existe mais `dirty` nem gravação adiada no
  salvar. Se não couber, nada muda e aparece um aviso (`toastFlagNoSpace`); `applyImportedTeam` devolve
  `warnings` com o mesmo aviso.
- **Nome do placar:** não são 3 letras: é um desenho de 32x8 pixels (4 tiles 2bpp) com o nome inteiro
  (GERMANY, ITALY...). `readTeamNameInGame` (`TeamNameReader.js`) lê os tiles (`teamNameInGameTiles`) e o
  texto quando o desenho é feito com a fonte do editor (`recognizeTextPixels`; aceita o espaçamento
  mais apertado do original, como LY em ITALY). 15 dos 27 originais são reconhecidos; os outros têm letras
  ajustadas a mão (HOLLAND, ARGENTINA, SUPER STAR...) e ficam com texto `null`. O original de RUSSIA usa um
  U em forma de V e é lido como "RVSSIA". Copiar/trocar e o JSON (v3) levam os tiles exatos; JSON antigo
  (v1/v2), cujo nome do placar era sempre as 3 primeiras letras do menu, desenha o nome do menu inteiro.
  O editor mostra o desenho atual e o novo, e limita pela largura em pixels (`textPixelWidth`).
- **Nome do Time:** o campo do menu avisa quando o nome vai ser encurtado (`fitTeamNameMenu`, que agora usa
  o espaço livre da área em vez de só o tamanho atual do nome); o status mostra o nome gravado; gravação
  recusada restaura os bytes e não deixa passo de desfazer. O último nome da área podia passar do limite.
- **Gerador IA:** um passo de desfazer só.
- **Backup:** guarda também a ROM original (`autosave-original.bin`, enviada uma vez por sessão);
  restaurar carrega com `originalData` = original e `modified` ligado, e o backup só é apagado quando a
  sessão volta a ser igual ao arquivo salvo. O histórico (`createHistoryStack` em `useHistory.js`, com
  testes) controla o ponto salvo: desfazer até o último save desliga "modificado".
  `cancelSnapshot` descarta o passo de uma gravação recusada (bandeira e nomes já usam).
- **Ainda a conferir no emulador:** onde o desenho do nome do placar aparece na partida e se um nome de 7
  letras gerado pelo editor aparece inteiro lá.

### 5.2 Desfazer e padrão de edição (feito, out/2026)
- **Seletores de cor:** `ColorEditorCard.jsx` grava ao fechar/blur/Enter; Cabelo e Pele em lote.
- **Design da Bandeira:** um passo por traço, gravado no mouseup.
- **Jogadores e Formação:** os campos numéricos da Formação (lateral, profundidade, comportamento A/B) usam
  `DraftInput` como os Jogadores: gravam no Enter/blur, campo vazio mantém o valor, valor igual não cria
  passo. Clicar outro jogador no campo confirma antes o número que está sendo digitado (senão ia para o
  slot novo). `TeamPreview` já rotulava pela formação.
- **Desfazer e rascunhos:** `restoreSnapshot` (`src/hooks/snapshotRestore.js`) grava e relê só as partes
  que mudaram, e os times (e campos) iguais mantêm o mesmo objeto. Desfazer uma edição de outra aba não
  refaz mais os rascunhos de Cenários, Textos, Menus, Outras telas, Sorteios, Descrição e Tela Inicial.
  O Ctrl+Z dentro de um campo já ia para o desfazer nativo.
- **Passos de desfazer vazios:** `cancelSnapshot` descarta o passo e restaura da própria snapshot o que a
  gravação recusada tenha mexido (blocos movidos). Usado em descrição, cenário, treino, menu, outras
  telas, logo, fundo e textos da tela inicial, além de nomes e bandeira.
- **Testes:** `useHistory.test.js` e `snapshotRestore.test.js` (ROM real: desfazer troca de times e
  importação no Super Star byte a byte, desfazer sem relação não relê nada, cenário). `useRomHandlers`
  continua sem teste direto (o projeto não tem renderizador de hooks).
- **Sobrou:** ~~sorteios e paletas ainda criam passo quando a "mudança" é igual ao que já está gravado~~.
  Feito: `changedDraws` (`tournament.js`) e `changedPaletteUpdates` (`palettes.js`) filtram o que não muda;
  sem nada a gravar, não há passo de desfazer nem "modificado".

### 5.3 Prévias aproximadas → desenho real
- Hoje são SVG/aproximações: gramado e bola (`MatchPaletteEditor.jsx`), camisa (`UniformEditor.jsx`),
  mini-uniformes (`TeamPreview.jsx`), cores da bandeira em 4 listras (`FlagColorEditor.jsx`), cores
  aproximadas na descrição (`TeamDescriptionPanel.jsx`); Cabelo e Pele não tem prévia; textos de
  cenário/treino/outras telas em texto monoespaçado; menus sem prévia.
- Plano: separar as partes genéricas de `titleScreen.js` (`buildVram`, `tilePixel`, `drawBg`,
  `drawSprites`, `setPixel`, CGRAM) num módulo `snesRender` compartilhado.
  - ~~Uniformes e Cabelo/Pele: jogador real com `playerSprites`/`renderPoseSheet` e a paleta do time (M).~~
    Feito (out/2026): `src/rom/snesRender.js` (tilePixel, setPixel, drawSprites, renderIndexed,
    colorToRaw) e `src/rom/playerPreview.js` (paletas do time + `renderTeamKit`, quadros de frente/costas
    e goleiro). `PlayerKitPreview.jsx` em Uniformes (kit da aba), Cabelo e Pele (titular + goleiro),
    Cores da Bandeira e Visão Geral (os 3 kits). As cores vêm do estado, então a prévia segue cada edição.
    Achado: o escudo no peito usa as 4 cores da bandeira (`title-screen.md`, "Escudo no peito").
  - ~~Cores da Bandeira: desenhar a bandeira real (S).~~ Feito: `FlagCanvas.jsx` (também na Visão Geral e
    na miniatura do Design da Bandeira).
  - Mini-uniformes dos cartões de jogador na Visão Geral continuam em SVG (cada jogador tem cabelo/número
    próprios: daria para desenhar o quadro com o cabelo dele, falta saber como o jogo troca o cabelo).
  - ~~Cores aproximadas na descrição.~~ Feito: a prévia usa a fonte 8x8 e as paletas da seleção de times
    (`textRender.js`). Correções junto: o título "Defensive" é **verde**, não amarelo (screenshot); editar
    uma descrição apagava as cores dentro do corpo de 4 originais (nomes de jogadores): agora as não
    editadas mantêm os bytes exatos; "Aplicar" fica desabilitado com caracteres inválidos.
  - ~~Textos e menus: fonte do jogo.~~ Feito: `src/rom/textRender.js` (lista de fontes `0x10300`, tabela
    8x8 `0x10C80`, pares 8x16, paletas `0x2E2DD`/`0x2F3DB`), `GameTextPreview.jsx` em Treino, Cenários,
    Outras telas e descrição; prévia da camada de texto da tela inteira em Menus. ~~Falta: molduras/fundos dos
    menus.~~ A configuração de BG1/BG2 está em `screen-viewer.md` e as telas inteiras aparecem no Visualizador de Telas (a prévia da aba Menus ainda é só a camada de texto). Falta: títulos dos modos (fonte 4bpp + textura) e paletas do
    cenário e do resultado do treino (sem dump; usam a do treino). Detalhes em `game-texts.md`, seção 6.
  - ~~Gramado da partida real.~~ Feito em parte: `src/rom/pitchPreview.js` desenha a grama com os tiles
    da partida (lista `0x1006C`) e o padrão de corte lido da VRAM; as linhas são um esquema (o jogo monta o
    tilemap em perspectiva por código). Falta: tiles dos tipos A/C (sem dump), linhas reais, bola e árbitro
    com sprites. Detalhes em `match-palettes.md`, "Gráficos do gramado".
  - ~~Conferir no emulador que editar as cores da bandeira muda o escudo da camisa.~~ Conferido.

### 5.4 Acabamento (feito em grande parte, out/2026)
- **Textos fora do i18n:** feito: a barra de status aceita `{ key, params }` (segue a troca de idioma,
  inclusive o "ROM OK" do `romValidator`, que agora tem `messageKey`); avisos de `validation.js` viraram
  chaves + parâmetros (`validationText`); erros de importação de time e do Electron (`noSavePath`,
  `fileNotFound`) são códigos traduzidos; modos do treino, painel Sobre, região das notificações e botões
  de fechar traduzidos; menus e diálogos nativos do Electron seguem o idioma (`MAIN_I18N`, guardado em
  `settingsStore.language`); `console.log` do `TeamNameWriter` removidos. As abas já eram rotuladas pela
  chave (`TabBar` usa `editors.js`). ~~Falta: relatório da importação de textos, erros da IA e siglas de
  posição.~~ Feito: o relatório de `applyTexts` é `{ path, key, params }` (chaves `tx*`, traduzidas por
  `importMessageText`; o caminho no arquivo, como `menus.rules`, não é traduzido). Erros da IA são
  `{ code, detail }` (`aiError`/`fetchErrorToAi`/`responseErrorToAi` em `src/services/aiProviders.js` e no
  espelho `electron/aiProviders.mjs`); o painel e o teste de conexão mostram `t(aiErrorKey(e))` e o
  detalhe técnico à parte. Siglas de posição: `positionText(code, t)` (`formation.js`, chaves `pos_*`:
  GOL, ZAG, LE, LD, VOL, MEI, ATA, RES...).
- **Validação e configurações:** feito: o editor de jogadores marca número repetido e nome vazio (borda e
  dica); o aviso de validação aparece depois de salvar (antes dizia "salva" mesmo se falhasse).
  `confirmBeforeSave` pergunta antes de gravar por cima do arquivo (não no "Salvar" do aviso de sair),
  `autoBackupBeforeSave` guarda `<arquivo>.bak` com a versão anterior, `defaultExportPath` é a pasta
  sugerida dos patches (os JSON são baixados pelo navegador interno, sem diálogo).
- **Dados compartilhados:** feito: aviso do goleiro do Super Star/Bélgica (Uniformes e Cabelo e Pele, e o
  outro time é atualizado junto); a ROM original **compartilha os desenhos de bandeira** em 4 grupos (ITA+BEL,
  GER+HOL+AUT+RUS, FRA+IRL, ENG+DEN+SWE+NOR): editar um mudava os outros sem aviso. Agora o time editado
  ganha uma cópia própria no fim da área (`flagSharedWith`), e a aba avisa.
- **Restaurar original:** feito para Uniformes (por kit), Cabelo e Pele, Cores e Design da Bandeira, Nome
  do Time (menu + desenho do placar), jogador (painel de detalhes), descrição e textos de menu (estes dois
  vão para o rascunho). `src/rom/restoreOriginal.js` + `RestoreOriginalButton.jsx`. **Cor predominante**
  editável na aba Uniformes (`readPredominantColor`, vai no JSON e na cópia de time; nomes das cores
  deduzidos dos uniformes originais). "Aplicar" da descrição desabilitado com caracteres inválidos.
  ~~Falta: modelos e ajustes do gramado partem sempre da paleta original.~~ Feito: os controles de
  matiz/saturação/brilho ajustam as cores atuais (opção "Ajustar as cores atuais", ligada por padrão; volta
  ao neutro depois de aplicar). Os modelos continuam partindo da paleta original.
- **Listas e navegação:** o seletor de times já tinha busca e setas e a barra lateral já usava botões com
  destaque. Feito: busca nos textos do treino (nome e texto, sem acentos); Comparar Times mostra também
  ataque e defesa, posição e número (os jogadores já eram casados pela vaga da formação).
- **Testes:** feito: `helpers.test.js` (quantize, playerStats, modelos de bandeira e cabelo/pele,
  fileHelpers, imageToFlag, imageToLogo), `restoreOriginal.test.js`, mover blocos e "não cabe" em
  `FlagDesignReadWrite.test.js`. ~~Faltam `menuSprites.js`, `titleScreens.js`, `titleScreenText.js` e
  `titlePlayers.js` diretos.~~ Feito: testes diretos dos quatro (142 testes). Correções que saíram deles:
  `writePose`/`playerSprites` recusam lado inválido (antes `'toString'` passava e `playerSprites` quebrava
  com TypeError); `readFrame` não lê além do banco `$82` (registro tem 10 bytes); títulos e copyright
  ignoram linhas vazias no fim (um Enter depois da 3ª linha dava "linhas demais").
- **Observações dos testes (não corrigidas):** sem `getOriginalData`, `writeTitleFont`/`writeMenuFont`
  partem do bloco atual (letras desenhadas antes não são limpas; o `RomParser` sempre tem o original);
  `titleLineWidths` conta 0 colunas para caractere sem desenho e `buildTitleWords` conta 1 (só sem
  `checkTitleText`); `listPoseFrames` guarda cache por buffer (editar os registros no lugar não atualiza);
  PRESS START curto preenche `0xFFDD-0xFFFF` com `FF` sem conferir, o longo confere (`noSpace`).

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
- ~~O README anuncia um "Tile Explorer" que não existe.~~ Feito: tirado (o roadmap lista o visualizador de
  telas como pendente); o README também passou a citar `research/` e `game-translations/` na estrutura.
  Agora o visualizador existe (aba Visualizador de Telas).
- `readCgramBlob` (`textRender.js`) lia a word de tamanho dos blobs de paleta como número de cores (é bytes − 1)
  e entrava no blob seguinte; corrigido junto com o visualizador (só mudava linhas não usadas pelas prévias).
