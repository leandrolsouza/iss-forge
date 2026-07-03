export default {
  // App
  appTitle: 'ISS Forge',
  noRomLoaded: 'No ROM loaded',
  modified: 'MODIFIED',
  saved: 'Saved',
  error: 'Error',
  team: 'Team',
  teams: 'Teams',

  // Sidebar
  explorer: 'EXPLORER',
  editors: 'EDITORS',
  selections: 'TEAMS',
  openRomToSee: 'Open a ROM to see teams',

  // Editor names
  editorPlayers: 'Players',
  editorUniforms: 'Uniforms',
  editorHairSkin: 'Hair & Skin',
  editorFlagColors: 'Flag Colors',
  editorFlagDesign: 'Flag Design',
  editorTeamName: 'Team Name',
  editorPreview: 'Overview',
  editorCompare: 'Compare Teams',

  // Welcome
  welcomeTitle: 'ISS Forge',
  welcomeSubtitle: 'ROM Editor for International Superstar Soccer (SNES 1995)',
  welcomeOpenBtn: 'Open ROM (.smc / .sfc)',
  welcomeDrop: 'or drag the ROM file here',
  welcomeFeatures: 'What you can edit:',
  welcomePlayerNames: 'Player names',
  welcomeShirtNumbers: 'Shirt numbers',
  welcomeAttributes: 'Attributes (Shooting, Speed, Stamina, Technique)',
  welcomeHairStyle: 'Hair style and skin color',
  welcomeUniformColors: 'Uniform colors (home, away, goalkeeper)',
  welcomeCompatible: 'Compatible ROM:',
  welcomeCompatibleDesc: 'International Superstar Soccer (Europe) - .smc or .sfc',

  // Loading
  loadingTitle: 'Loading ROM...',
  loadingMessage: 'Reading and parsing team data',

  // Recent ROMs
  recentRoms: 'Recent ROMs',
  recentRomsEmpty: 'No recently opened ROMs',
  recentRomsClear: 'Clear',
  recentRomsRemove: 'Remove from list',
  recentRomsNotFound: 'File not found. Removed from list.',

  // Player Editor
  squad: 'Squad',
  players: 'players',
  num: 'Num',
  name: 'Name',
  shooting: 'Shot',
  speed: 'Spd',
  stamina: 'Stam',
  technique: 'Tech',
  hair: 'Hair',
  type: 'Type',
  normal: 'Normal',
  special: 'Special',
  unknown: 'Unknown',
  playerDetails: 'Player Details',
  attributes: 'Attributes',
  appearance: 'Appearance',
  listPosition: 'List Position',
  index: 'Index',
  of: 'of',
  goalkeeper: 'Goalkeeper (position 1)',
  defender: 'Defender',
  midfielder: 'Midfielder',
  forward: 'Forward',
  starting: 'Starting',
  substitutes: 'Substitutes',
  formation: 'Formation',

  // Uniforms
  uniforms: 'Uniforms',
  home: 'Home',
  away: 'Away',
  keeper: 'Goalkeeper',
  shirt: 'Shirt',
  shorts: 'Shorts',
  socks: 'Socks',
  shirtAndSocks: 'Shirt & Socks',
  color: 'Color',
  colors: 'colors',
  preview: 'Preview',
  snesInfo: 'SNES: 5 bits/channel (32 levels per color)',

  // Hair & Skin
  hairAndSkin: 'Hair & Skin Colors',
  hairColor: 'Hair',
  skinColor: 'Skin',
  hairSkinInfo: 'Hair and skin colors apply to players marked as "Normal".',

  // Flag Colors
  flagColors: 'Flag Colors',
  flagPalette: 'Colors (4 palette colors)',
  flagInfo: 'These are the 4 colors used in the team flag on the selection screen.',

  // Flag Design
  flagDesign: 'Flag Design',
  palette: 'Color Palette',
  transparent: 'Transparent',
  fill: 'Fill',
  clear: 'Clear',
  design: 'Design',
  pixels: 'pixels',
  flagDesignInfo:
    'Click or drag to paint. Each pixel uses one of the 4 flag palette colors or transparent.',

  // Team Name
  teamName: 'Team Name',
  currentName: 'Current Name in Game',
  generate: 'Generate',
  generated: 'Generated!',
  nameInGame: 'Name in Game (Scoreboard)',
  nameInGamePlaceholder: 'e.g. GER',
  nameInGameHint: 'Max 3 characters (A-Z, 0-9, dot). Shown on the scoreboard during matches.',
  nameInMenu: 'Text in Menu (Selection Screen)',
  nameInMenuPlaceholder: 'e.g. GERMANY',
  nameInMenuHint:
    'Max 10 characters (A-Z, 0-9, dot, space). Shown under the flag on the team selection screen.',
  teamNameHowTitle: 'How It Works',
  teamNameHowTwo1:
    'The team has two name displays: a short name on the scoreboard during matches (3 chars) and a full name on the selection screen (up to 10 chars).',
  teamNameHowTwo2:
    'Generate the in-game name first (e.g. GER), then type the full menu name (e.g. GERMANY) which saves automatically on blur.',
  teamNameHowTwo3: 'Examples: GER / GERMANY, BRA / BRAZIL, ITA / ITALY, ARG / ARGENTINA',

  // Preview
  overview: 'Squad Overview',

  // Compare
  compare: 'Compare Teams',
  selectTeamA: 'Select Team A',
  selectTeamB: 'Select Team B',
  avgShooting: 'Avg Shooting',
  avgSpeed: 'Avg Speed',
  avgStamina: 'Avg Stamina',
  avgTechnique: 'Avg Technique',
  difference: 'Difference',

  // Theme
  darkTheme: 'Dark Theme',
  lightTheme: 'Light Theme',

  // Menu
  menuFile: 'File',
  menuOpenRom: 'Open ROM...',
  menuSave: 'Save ROM',
  menuSaveAs: 'Save ROM As...',
  menuQuit: 'Quit',
  menuEdit: 'Edit',
  menuUndo: 'Undo',
  menuRedo: 'Redo',
  toolbarUndo: 'Undo (Ctrl+Z)',
  toolbarRedo: 'Redo (Ctrl+Y)',
  menuView: 'View',
  menuHelp: 'Help',
  menuAbout: 'About ISS Forge',

  // Unsaved Changes Dialog
  unsavedTitle: 'Unsaved Changes',
  unsavedMessage: 'The ROM has unsaved changes. Do you want to save before quitting?',
  unsavedSave: 'Save',
  unsavedDontSave: 'Don\'t Save',
  unsavedCancel: 'Cancel',

  // Help Tooltips - Player Editor
  helpShooting: 'Shot power. Higher values = stronger, more accurate shots. Range: 7-15.',
  helpSpeed: 'Player running speed. Range: 1-16.',
  helpStamina:
    'Physical endurance. Players with high stamina tire less during the match. Range: 1-16.',
  helpTechnique:
    'Technical skill (ball control, passing). Higher values = better control. Range: 7-15.',
  helpHair: 'Player hair style and color in-game.',
  helpType: 'Normal: uses team hair/skin colors. Special: uses unique individual colors.',
  helpNum: 'Shirt number displayed in-game (1-16). Does not define tactical position.',
  helpName: 'Player name (max 8 characters).',
  helpAttributes: "Attributes that define the player's performance on the field.",
  helpAppearance: "Controls the player's visual appearance during matches.",
  helpListPosition: "Tactical position based on the team's fixed formation. Defined by list order.",
  helpPos:
    "Tactical position based on the team's fixed formation (e.g. CB = Center Back, LB = Left Back, CM = Central Mid, ST = Striker, SUB = Substitute).",
  helpIcon: '?',
  pos: 'Pos',

  // Validation
  validationErrors: 'error(s) found',
  validationOk: 'Validation OK',

  // Auto-Updater
  updateAvailable: 'New version {version} is available!',
  updateDownload: 'Download',
  updateDismiss: 'Later',
  updateDownloading: 'Downloading update...',
  updateReady: 'Update ready to install.',
  updateInstallRestart: 'Restart & Install',
  updateLater: 'Later',
};
