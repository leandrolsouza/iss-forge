/**
 * Every editor tab in one place: id, i18n label key, icon and scope.
 * Used by the sidebar, the tab bar (labels follow the current language) and
 * App (the team selector only shows on team-scoped tabs).
 */
import {
  IconPlayers,
  IconFormation,
  IconUniform,
  IconHairSkin,
  IconFlag,
  IconFlagDesign,
  IconTeamName,
  IconOverview,
  IconCompare,
  IconScenario,
  IconTrophy,
  IconGameText,
  IconPitch,
  IconTitleScreen,
  IconScreenViewer,
  IconSparkle,
  IconSettings,
  IconInfo,
} from './Icons';

/** scope 'team': edits the selected team; 'global': whole ROM / app */
export const EDITORS = [
  { id: 'players', labelKey: 'editorPlayers', Icon: IconPlayers, scope: 'team' },
  { id: 'formation', labelKey: 'editorFormation', Icon: IconFormation, scope: 'team' },
  { id: 'uniforms', labelKey: 'editorUniforms', Icon: IconUniform, scope: 'team' },
  { id: 'hairskin', labelKey: 'editorHairSkin', Icon: IconHairSkin, scope: 'team' },
  { id: 'flagcolors', labelKey: 'editorFlagColors', Icon: IconFlag, scope: 'team' },
  { id: 'flagdesign', labelKey: 'editorFlagDesign', Icon: IconFlagDesign, scope: 'team' },
  { id: 'teamname', labelKey: 'editorTeamName', Icon: IconTeamName, scope: 'team' },
  { id: 'preview', labelKey: 'editorPreview', Icon: IconOverview, scope: 'team' },
  { id: 'compare', labelKey: 'editorCompare', Icon: IconCompare, scope: 'global' },
  { id: 'scenarios', labelKey: 'editorScenarios', Icon: IconScenario, scope: 'global' },
  { id: 'tournaments', labelKey: 'editorTournaments', Icon: IconTrophy, scope: 'global' },
  { id: 'gameTexts', labelKey: 'editorGameTexts', Icon: IconGameText, scope: 'global' },
  { id: 'matchPalettes', labelKey: 'editorMatchPalettes', Icon: IconPitch, scope: 'global' },
  { id: 'titleScreen', labelKey: 'editorTitleScreen', Icon: IconTitleScreen, scope: 'global' },
  { id: 'screenViewer', labelKey: 'editorScreenViewer', Icon: IconScreenViewer, scope: 'global' },
  { id: 'ai', labelKey: 'editorAiGenerator', Icon: IconSparkle, scope: 'team', ai: true },
  { id: 'aiLeague', labelKey: 'editorAiLeague', Icon: IconSparkle, scope: 'global', ai: true },
];

/** Tabs that are not editors but can be open in the tab bar */
const EXTRA_TABS = [
  { id: 'settings', labelKey: 'settingsTitle', Icon: IconSettings, scope: 'global' },
  { id: 'about', labelKey: 'aboutTitle', Icon: IconInfo, scope: 'global' },
];

const BY_ID = Object.fromEntries([...EDITORS, ...EXTRA_TABS].map((e) => [e.id, e]));

export const getEditor = (id) => BY_ID[id];

/** Whether the team selector applies to this tab */
export const isTeamTab = (id) => BY_ID[id]?.scope === 'team';
