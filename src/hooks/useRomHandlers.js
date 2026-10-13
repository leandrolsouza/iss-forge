/**
 * ROM edit handlers hook
 * All write operations that modify ROM data and update React state
 */
import { useCallback } from 'react';
import { openRomWeb, saveRomWeb, isElectron, getModifiedFilename } from '../utils/fileHelpers';
import { validateRom, getValidationSummary, validationText } from '../utils/validation';
import {
  exportTeam,
  exportAllTeams,
  validateImport,
  applyImportedTeam,
  downloadJson,
  readJsonFile,
  copyTeam,
} from '../utils/teamExport';
import * as electronBridge from '../services/electronBridge';
import { sharedKeeperTeams } from '../rom/readers/UniformReader';
import { restoreTeamPart } from '../rom/restoreOriginal';
import { buildPatch, getPatchFilename } from '../rom/patches';
import { withDerivedStats } from '../rom/playerStats';
import { exportTexts, applyTexts } from '../utils/textsExport';
import { changedPaletteUpdates } from '../rom/palettes';
import { changedDraws } from '../rom/tournament';

export default function useRomHandlers({
  toast,
  t,
  settings = {},
  confirm = null,
  romParser,
  romInfo,
  currentProject = null,
  setCurrentProject,
  setRomFile,
  teams,
  setTeams,
  markModified,
  markSaved,
  setStatusMessage,
  requestLoadRom,
  setLoading,
  pushSnapshot,
  cancelSnapshot,
  setScenarios,
  setMatchPalettes,
  setTournamentDraws,
  setGameTexts,
  setMenuScreens,
  setScreenTexts,
  setTitleScreen,
}) {
  /**
   * After a goalkeeper colour write: re-read the teams that store their goalkeeper at
   * the same place (Super Star uses Belgium's), so their tabs show the new colours.
   */
  const syncSharedKeepers = useCallback(
    (teamIndex) => {
      const partners = sharedKeeperTeams(teamIndex);
      if (!partners.length) return;
      setTeams((prev) =>
        prev.map((tm, i) =>
          partners.includes(i)
            ? {
                ...tm,
                uniforms: romParser.readUniformColors(i),
                hairSkin: romParser.readHairSkinColors(i),
              }
            : tm,
        ),
      );
    },
    [romParser, setTeams],
  );

  const handlePlayerChange = useCallback(
    (teamIndex, playerIndex, field, value) => {
      if (!romParser) return;
      pushSnapshot(teams);

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const players = [...team.players];
        const updated = { ...players[playerIndex], [field]: value };
        players[playerIndex] = field === 'name' ? updated : withDerivedStats(updated);
        team.players = players;
        newTeams[teamIndex] = team;
        return newTeams;
      });

      if (field === 'name') {
        romParser.writePlayerName(teamIndex, playerIndex, value);
      } else {
        const team = teams[teamIndex];
        const playerData = { ...team.players[playerIndex], [field]: value };
        romParser.writePlayerData(teamIndex, playerIndex, playerData);
      }

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  const handleUniformChange = useCallback(
    (teamIndex, kit, part, colorIndex, color) => {
      if (!romParser) return;
      pushSnapshot(teams);
      romParser.writeUniformColor(teamIndex, kit, part, colorIndex, color);

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const uniforms = { ...team.uniforms };
        const kitData = { ...uniforms[kit] };
        const partColors = [...(kitData[part] || [])];
        partColors[colorIndex] = {
          ...color,
          r5: Math.min(31, Math.round(color.r / 8)),
          g5: Math.min(31, Math.round(color.g / 8)),
          b5: Math.min(31, Math.round(color.b / 8)),
        };
        kitData[part] = partColors;
        uniforms[kit] = kitData;
        team.uniforms = uniforms;
        newTeams[teamIndex] = team;
        return newTeams;
      });
      if (kit === 'goalkeeper') syncSharedKeepers(teamIndex);

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot, syncSharedKeepers],
  );

  /** `kit` may be an array (e.g. ['first', 'second']) to write several kits as one undo step */
  const handleHairSkinChange = useCallback(
    (teamIndex, kit, part, colorIndex, color) => {
      if (!romParser) return;
      const kits = Array.isArray(kit) ? kit : [kit];
      pushSnapshot(teams);
      kits.forEach((k) => romParser.writeHairSkinColor(teamIndex, k, part, colorIndex, color));

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const hairSkin = { ...team.hairSkin };
        kits.forEach((k) => {
          const kitData = { ...hairSkin[k] };
          const partColors = [...(kitData[part] || [])];
          partColors[colorIndex] = {
            ...color,
            r5: Math.min(31, Math.round(color.r / 8)),
            g5: Math.min(31, Math.round(color.g / 8)),
            b5: Math.min(31, Math.round(color.b / 8)),
          };
          kitData[part] = partColors;
          hairSkin[k] = kitData;
        });
        team.hairSkin = hairSkin;
        newTeams[teamIndex] = team;
        return newTeams;
      });
      if (kits.includes('goalkeeper')) syncSharedKeepers(teamIndex);

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot, syncSharedKeepers],
  );

  /**
   * Put one part of a team back to the ROM as loaded (one undo step).
   * @param {string} part - see RESTORE_PARTS in rom/restoreOriginal.js, or `player:N`
   * @returns {boolean}
   */
  const handleRestoreOriginal = useCallback(
    (teamIndex, part) => {
      if (!romParser) return false;
      pushSnapshot(teams);
      const res = restoreTeamPart(romParser, teamIndex, part);
      if (!res.ok) {
        cancelSnapshot();
        toast.error(t(res.error || 'toastRestoreFailed'));
        return false;
      }
      const fresh = romParser.readTeam(teamIndex);
      setTeams((prev) => {
        const next = [...prev];
        next[teamIndex] = fresh;
        return next;
      });
      // flags and goalkeepers can be shared: refresh the teams that use them too
      if (part === 'flagDesign') {
        setTeams((prev) =>
          prev.map((tm, i) =>
            tm.flagDesign
              ? { ...tm, flagDesign: { ...tm.flagDesign, grid: romParser.readFlagDesign(i).grid } }
              : tm,
          ),
        );
      }
      if (part === 'uniform:goalkeeper' || part === 'hairSkin') syncSharedKeepers(teamIndex);
      markModified();
      setStatusMessage('toastRestored');
      return true;
    },
    [
      romParser,
      teams,
      pushSnapshot,
      cancelSnapshot,
      setTeams,
      syncSharedKeepers,
      markModified,
      setStatusMessage,
      toast,
      t,
    ],
  );

  /** Predominant colour (0-4): decides which team changes kit when both have the same */
  const handlePredominantColorChange = useCallback(
    (teamIndex, value) => {
      if (!romParser || teams[teamIndex]?.predominantColor === value) return;
      pushSnapshot(teams);
      romParser.writePredominantColor(teamIndex, value);
      setTeams((prev) => {
        const next = [...prev];
        next[teamIndex] = { ...next[teamIndex], predominantColor: value };
        return next;
      });
      markModified();
    },
    [romParser, teams, pushSnapshot, setTeams, markModified],
  );

  const handleSpecialHairSkinChange = useCallback(
    (teamIndex, field, typeId) => {
      if (!romParser) return;
      pushSnapshot(teams);

      if (field === 'specialHair') {
        romParser.writeSpecialHair(teamIndex, typeId);
      } else {
        romParser.writeSpecialSkin(teamIndex, typeId);
      }

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        team[field] = typeId;
        newTeams[teamIndex] = team;
        return newTeams;
      });

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  const handleHairSkinTemplateApply = useCallback(
    (teamIndex, template) => {
      if (!romParser) return;
      pushSnapshot(teams);

      const { outfield, goalkeeper } = template;

      // Write outfield hair+skin to both first and second kits
      ['first', 'second'].forEach((kit) => {
        outfield.hair.forEach((color, idx) => {
          romParser.writeHairSkinColor(teamIndex, kit, 'hair', idx, color);
        });
        outfield.skin.forEach((color, idx) => {
          romParser.writeHairSkinColor(teamIndex, kit, 'skin', idx, color);
        });
      });

      // Write goalkeeper hair+skin
      goalkeeper.hair.forEach((color, idx) => {
        romParser.writeHairSkinColor(teamIndex, 'goalkeeper', 'hair', idx, color);
      });
      goalkeeper.skin.forEach((color, idx) => {
        romParser.writeHairSkinColor(teamIndex, 'goalkeeper', 'skin', idx, color);
      });

      // Update React state for all 3 kits
      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const hairSkin = { ...team.hairSkin };

        const toState = (colors) =>
          colors.map((c) => ({
            ...c,
            r5: Math.min(31, Math.round(c.r / 8)),
            g5: Math.min(31, Math.round(c.g / 8)),
            b5: Math.min(31, Math.round(c.b / 8)),
          }));

        hairSkin.first = { hair: toState(outfield.hair), skin: toState(outfield.skin) };
        hairSkin.second = { hair: toState(outfield.hair), skin: toState(outfield.skin) };
        hairSkin.goalkeeper = { hair: toState(goalkeeper.hair), skin: toState(goalkeeper.skin) };

        team.hairSkin = hairSkin;
        newTeams[teamIndex] = team;
        return newTeams;
      });
      syncSharedKeepers(teamIndex);

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot, syncSharedKeepers],
  );

  const handleFlagColorChange = useCallback(
    (teamIndex, colorIndex, color) => {
      if (!romParser) return;
      pushSnapshot(teams);
      romParser.writeFlagColor(teamIndex, colorIndex, color);

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const flagColors = [...team.flagColors];
        flagColors[colorIndex] = {
          ...color,
          r5: Math.min(31, Math.round(color.r / 8)),
          g5: Math.min(31, Math.round(color.g / 8)),
          b5: Math.min(31, Math.round(color.b / 8)),
        };
        team.flagColors = flagColors;
        // Keep flagDesign.flagColors in sync
        if (team.flagDesign) {
          team.flagDesign = { ...team.flagDesign, flagColors };
        }
        newTeams[teamIndex] = team;
        return newTeams;
      });

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  const handleFlagColorBulkChange = useCallback(
    (teamIndex, colors) => {
      if (!romParser) return;
      pushSnapshot(teams);

      colors.forEach((color, colorIndex) => {
        romParser.writeFlagColor(teamIndex, colorIndex, color);
      });

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const flagColors = colors.map((color) => ({
          ...color,
          r5: Math.min(31, Math.round(color.r / 8)),
          g5: Math.min(31, Math.round(color.g / 8)),
          b5: Math.min(31, Math.round(color.b / 8)),
        }));
        team.flagColors = flagColors;
        if (team.flagDesign) {
          team.flagDesign = { ...team.flagDesign, flagColors };
        }
        newTeams[teamIndex] = team;
        return newTeams;
      });

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  /**
   * Replace a team's flag design (a brush stroke, fill, template, image...) as one
   * undo step. It is compressed into the ROM right away, so copying teams, backups and
   * the emulator always see it; when the compressed flag does not fit in the flag area
   * nothing changes and the user is told.
   * @returns {boolean} true when the design was written (or was already the same)
   */
  const handleFlagDesignBulkChange = useCallback(
    (teamIndex, newGrid) => {
      if (!romParser || !Array.isArray(newGrid)) return false;
      const current = teams[teamIndex]?.flagDesign?.grid;
      if (current && JSON.stringify(current) === JSON.stringify(newGrid)) return true;

      pushSnapshot(teams);
      const before = romParser.readFlagDesignBytes();
      if (!romParser.writeFlagDesign(teamIndex, newGrid)) {
        romParser.restoreFlagDesignBytes(before);
        cancelSnapshot();
        setStatusMessage('toastFlagNoSpace');
        toast.error(t('toastFlagNoSpace'), { detail: t('toastFlagNoSpaceDetail') });
        return false;
      }

      // Re-read every flag: blocks may be shared between teams
      setTeams((prev) =>
        prev.map((team, i) => {
          if (!team.flagDesign) return team;
          const { grid } = romParser.readFlagDesign(i);
          if (JSON.stringify(grid) === JSON.stringify(team.flagDesign.grid)) return team;
          return { ...team, flagDesign: { ...team.flagDesign, grid } };
        }),
      );

      markModified();
      return true;
    },
    [
      romParser,
      teams,
      markModified,
      setTeams,
      pushSnapshot,
      cancelSnapshot,
      setStatusMessage,
      toast,
      t,
    ],
  );

  /**
   * Write a team name as one undo step and refresh the team from the ROM.
   * `kind`: 'both' (menu + in-game graphic), 'menu' or 'inGame'. A rejected write
   * restores the name bytes and leaves no undo step. The menu name is shortened when
   * the selection-screen area is full: the status shows what was really written.
   */
  const writeTeamName = useCallback(
    (teamIndex, text, kind) => {
      if (!romParser) return false;
      pushSnapshot(teams);
      const before = romParser.readTeamNameBytes();
      const write = {
        both: () => romParser.writeTeamNameText(teamIndex, text),
        menu: () => romParser.writeTeamNameMenu(teamIndex, text),
        inGame: () => romParser.writeTeamNameInGame(teamIndex, text),
      }[kind];

      if (!write()) {
        romParser.restoreTeamNameBytes(before);
        cancelSnapshot();
        const key = kind === 'inGame' ? 'toastInGameNameNoSpace' : 'toastTeamNameNoSpace';
        setStatusMessage(key);
        toast.error(t(key), { detail: text });
        return false;
      }

      const teamNameText = romParser.readTeamNameText(teamIndex);
      const inGame = romParser.readTeamNameInGame(teamIndex);
      setTeams((prev) => {
        const next = [...prev];
        next[teamIndex] = {
          ...next[teamIndex],
          teamNameText,
          teamNameInGame: inGame.text,
          teamNameInGameTiles: inGame.tiles,
        };
        return next;
      });
      markModified();

      const written = kind === 'inGame' ? inGame.text || text : teamNameText;
      setStatusMessage({
        key: 'statusNameWritten',
        params: { field: { key: kind === 'inGame' ? 'nameInGame' : 'nameInMenu' }, name: written },
      });
      if (kind !== 'inGame' && teamNameText !== text) {
        toast.warning(t('toastTeamNameTruncated', { name: teamNameText }), { detail: text });
      }
      return true;
    },
    [
      romParser,
      teams,
      markModified,
      setTeams,
      setStatusMessage,
      pushSnapshot,
      cancelSnapshot,
      toast,
      t,
    ],
  );

  const handleTeamNameGenerate = useCallback(
    (teamIndex, text) => writeTeamName(teamIndex, text, 'both'),
    [writeTeamName],
  );
  const handleTeamNameMenuSave = useCallback(
    (teamIndex, text) => writeTeamName(teamIndex, text, 'menu'),
    [writeTeamName],
  );
  const handleTeamNameInGameGenerate = useCallback(
    (teamIndex, text) => writeTeamName(teamIndex, text, 'inGame'),
    [writeTeamName],
  );

  /**
   * Replace the default formation of a team (11 slots).
   */
  const handleFormationChange = useCallback(
    (teamIndex, slots) => {
      if (!romParser) return;
      pushSnapshot(teams);
      romParser.writeFormation(teamIndex, slots);
      const formation = romParser.readFormation(teamIndex);

      setTeams((prev) => {
        const newTeams = [...prev];
        newTeams[teamIndex] = {
          ...newTeams[teamIndex],
          formation: { slots: formation.slots, name: formation.name },
        };
        return newTeams;
      });

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  /**
   * Swap two squad positions (lineup change). The player moved into slot N
   * plays formation position N; slots 12-15 are the bench.
   */
  const handleSwapPlayers = useCallback(
    (teamIndex, a, b) => {
      if (!romParser || a === b) return;
      pushSnapshot(teams);
      romParser.swapPlayers(teamIndex, a, b);

      const players = romParser.readPlayers(teamIndex);
      setTeams((prev) => {
        const newTeams = [...prev];
        newTeams[teamIndex] = { ...newTeams[teamIndex], players };
        return newTeams;
      });

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  /**
   * Replace match palettes (pitch / ball / referee) as a single undo step.
   * @param {string|Object<string, number[]>} idOrMap - MATCH_PALETTES id, or { id: colors } batch
   * @param {number[]} [colors] - raw SNES colours (when an id is given)
   */
  const handleMatchPaletteChange = useCallback(
    (idOrMap, colors) => {
      if (!romParser) return;
      const updates = changedPaletteUpdates(
        romParser,
        typeof idOrMap === 'string' ? { [idOrMap]: colors } : idOrMap,
      );
      if (!Object.keys(updates).length) return; // nothing changes: no empty undo step
      pushSnapshot(teams);
      romParser.applyPaletteUpdates(updates);
      setMatchPalettes(romParser.readMatchPalettes());
      markModified();
    },
    [romParser, teams, markModified, pushSnapshot, setMatchPalettes],
  );

  /**
   * Edit the title screen (colours and/or the teams of the two players) as one undo step.
   * @param {Object} updates - { colourGroupId: rawColours[], 'team:left' | 'team:right': TEAMS index }
   */
  const handleTitleScreenChange = useCallback(
    (updates) => {
      if (!romParser || !updates || !Object.keys(updates).length) return;
      pushSnapshot(teams);
      romParser.applyTitleScreenUpdates(updates);
      setTitleScreen(romParser.readTitleScreen());
      markModified();
    },
    [romParser, teams, markModified, pushSnapshot, setTitleScreen],
  );

  /**
   * Import a logo built by buildLogo (or restore the original with `null`), one undo step.
   * @returns {{ ok: boolean, error?: string, size?: number, capacity?: number }}
   */
  const handleTitleLogoChange = useCallback(
    (built, options) => {
      if (!romParser) return { ok: false };
      pushSnapshot(teams);
      const result = built
        ? romParser.importTitleLogo(built, options)
        : romParser.restoreTitleLogo();
      if (!result.ok) {
        cancelSnapshot(); // puts back anything the failed import touched
        return result;
      }
      setTitleScreen(romParser.readTitleScreen());
      markModified();
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, cancelSnapshot, setTitleScreen],
  );

  /**
   * Replace the title screen background (brush stroke area / grass), one undo step.
   * @returns {{ ok: boolean, error?: string }}
   */
  const handleTitleBackgroundChange = useCallback(
    (built, modes) => {
      if (!romParser || !built) return { ok: false };
      pushSnapshot(teams);
      const result = romParser.importTitleBackground(built, modes);
      if (!result.ok) {
        cancelSnapshot();
        return result;
      }
      setTitleScreen(romParser.readTitleScreen());
      // the blocks are placed like menu screens and may move them
      setMenuScreens(romParser.readMenuScreens());
      markModified();
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, cancelSnapshot, setTitleScreen, setMenuScreens],
  );

  /**
   * Replace the title screen copyright lines and/or PRESS START (one undo step).
   * @param {{ copyright?: string, pressStart?: string }} texts
   * @returns {{ ok: boolean, error?: string, invalid?: string[] }}
   */
  const handleTitleTextsChange = useCallback(
    (texts) => {
      if (!romParser) return { ok: false };
      pushSnapshot(teams);
      const result = romParser.writeTitleTexts(texts);
      // a failed write may have moved blocks around: cancelSnapshot puts them back
      if (!result.ok) {
        cancelSnapshot();
        return result;
      }
      setTitleScreen(romParser.readTitleScreen());
      setMenuScreens(romParser.readMenuScreens());
      markModified();
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, cancelSnapshot, setTitleScreen, setMenuScreens],
  );

  /**
   * Update a team's selection-screen description.
   * @returns {{ ok: boolean, used?: number, capacity?: number }}
   */
  const handleTeamDescriptionChange = useCallback(
    (teamIndex, desc) => {
      if (!romParser) return { ok: false };
      pushSnapshot(teams);
      const res = romParser.writeTeamDescription(teamIndex, desc);
      if (res.ok) {
        const description = romParser.readTeamDescription(teamIndex);
        setTeams((prev) => {
          const next = [...prev];
          next[teamIndex] = { ...next[teamIndex], description };
          return next;
        });
        markModified();
      } else {
        cancelSnapshot();
      }
      return res;
    },
    [romParser, teams, markModified, setTeams, pushSnapshot, cancelSnapshot],
  );

  /**
   * Copy (or swap) a whole team to another slot — one undo step.
   */
  const handleCopyTeam = useCallback(
    (from, to, swap = false) => {
      if (!romParser || from === to) return;
      pushSnapshot(teams);
      const wanted = [teams[from]?.teamNameText, swap ? teams[to]?.teamNameText : null];
      const { warnings } = copyTeam(romParser, from, to, { swap });
      const fresh = romParser.readAllTeams();
      setTeams(fresh);
      setMatchPalettes(romParser.readMatchPalettes());
      markModified();
      const truncated =
        (wanted[0] && fresh[to].teamNameText !== wanted[0]) ||
        (swap && wanted[1] && fresh[from].teamNameText !== wanted[1]);
      const key = truncated ? 'copyTeamNameTruncated' : swap ? 'swapTeamDone' : 'copyTeamDone';
      setStatusMessage(key);
      toast[truncated ? 'warning' : 'success'](t(key));
      warnings.forEach((w) => toast.warning(t(w)));
    },
    [
      romParser,
      teams,
      markModified,
      setTeams,
      setMatchPalettes,
      setStatusMessage,
      pushSnapshot,
      toast,
      t,
    ],
  );

  /**
   * Update one Scenario mode situation.
   * @returns {{ ok: boolean, error?: string }}
   */
  const handleScenarioChange = useCallback(
    (index, scenario) => {
      if (!romParser) return { ok: false };
      pushSnapshot(teams);
      const result = romParser.writeScenario(index, scenario);
      if (result.ok) {
        setScenarios(romParser.readScenarios());
        markModified();
      } else {
        cancelSnapshot();
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, cancelSnapshot, setScenarios],
  );

  /**
   * Replace tournament draws. `changes` maps draw index -> 24 TEAMS indexes.
   */
  const handleTournamentDrawsChange = useCallback(
    (changes) => {
      if (!romParser || !changes) return;
      const changed = changedDraws(romParser, changes);
      if (!Object.keys(changed).length) return; // nothing changes: no empty undo step
      pushSnapshot(teams);
      Object.entries(changed).forEach(([index, draw]) =>
        romParser.writeTournamentDraw(Number(index), draw),
      );
      setTournamentDraws(romParser.readTournamentDraws());
      markModified();
    },
    [romParser, teams, markModified, pushSnapshot, setTournamentDraws],
  );

  /**
   * Replace all training texts.
   * @returns {{ ok: boolean, error?: string }}
   */
  const handleGameTextsChange = useCallback(
    (texts) => {
      if (!romParser) return { ok: false };
      pushSnapshot(teams);
      const result = romParser.writeTrainingTexts(texts);
      if (result.ok) {
        setGameTexts(romParser.readTrainingTexts());
        markModified();
      } else {
        cancelSnapshot();
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, cancelSnapshot, setGameTexts],
  );

  /**
   * Replace texts of one menu screen. `texts` maps run index -> new text.
   * @returns {{ ok: boolean, error?: string, size: number, capacity: number }}
   */
  const handleMenuScreenChange = useCallback(
    (offset, texts) => {
      if (!romParser) return { ok: false };
      pushSnapshot(teams);
      const result = romParser.writeMenuScreen(offset, texts);
      if (result.ok) {
        setMenuScreens(romParser.readMenuScreens());
        markModified();
      } else {
        cancelSnapshot();
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, cancelSnapshot, setMenuScreens],
  );

  /**
   * Replace the fixed texts drawn by code (joypad controls, scenario, ...).
   * @returns {{ ok: boolean, error?: string, issues?: object[] }}
   */
  const handleScreenTextsChange = useCallback(
    (texts) => {
      if (!romParser) return { ok: false };
      pushSnapshot(teams);
      const result = romParser.writeScreenTexts(texts);
      if (result.ok) {
        setScreenTexts(romParser.readScreenTexts());
        // titles are placed like the menu screens and may move them
        setMenuScreens(romParser.readMenuScreens());
        markModified();
      } else {
        cancelSnapshot();
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, cancelSnapshot, setScreenTexts, setMenuScreens],
  );

  /** Export every translatable text as one JSON file */
  const handleExportTexts = useCallback(() => {
    if (!romParser) return;
    const base = (romInfo?.fileName || 'iss')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_');
    downloadJson(exportTexts(romParser), `${base}_texts.json`);
    setStatusMessage({ key: 'toastExported', params: { file: `${base}_texts.json` } });
    toast.success(t('toastExported', { file: `${base}_texts.json` }));
  }, [romParser, romInfo, setStatusMessage, toast, t]);

  /**
   * Import a texts JSON file (all-or-nothing, one undo step).
   * @returns {Promise<null | { ok: boolean, errors: string[], warnings: string[], changed: object }>}
   */
  const handleImportTexts = useCallback(async () => {
    if (!romParser) return null;
    const data = await readJsonFile();
    if (!data) return null;
    const res = applyTexts(romParser, data, { beforeCommit: () => pushSnapshot(teams) });
    if (res.ok && Object.values(res.changed).some(Boolean)) {
      setGameTexts(romParser.readTrainingTexts());
      setMenuScreens(romParser.readMenuScreens());
      setScreenTexts(romParser.readScreenTexts());
      setScenarios(romParser.readScenarios());
      setTitleScreen(romParser.readTitleScreen());
      setTeams((prev) =>
        prev.map((t, i) => ({ ...t, description: romParser.readTeamDescription(i) })),
      );
      markModified();
    }
    return res;
  }, [
    romParser,
    teams,
    pushSnapshot,
    markModified,
    setGameTexts,
    setMenuScreens,
    setScreenTexts,
    setScenarios,
    setTitleScreen,
    setTeams,
  ]);

  /**
   * Repair the SNES internal checksum before any save, patch export or emulator run
   * so the output passes checksum checks in emulators/flashcarts. (Every edit is
   * already in the ROM buffer: nothing is deferred to save time.)
   */
  const prepareRomForWrite = useCallback(() => {
    try {
      romParser.fixChecksum();
    } catch (err) {
      console.warn('[Checksum] Could not fix internal checksum:', err.message);
    }
  }, [romParser]);

  /** Save-time checks are advisory: report them after the save, never block it */
  const reportValidation = useCallback(() => {
    const warnings = validateRom(teams);
    const summary = getValidationSummary(warnings);
    if (summary.total === 0) return;
    const shown = warnings.slice(0, 3).map((w) => `${w.teamName}: ${validationText(w, t)}`);
    if (warnings.length > 3) shown.push(t('toastValidationMore', { count: warnings.length - 3 }));
    toast[summary.errors > 0 ? 'error' : 'warning'](
      t('toastValidation', { errors: summary.errors, warnings: summary.warnings }),
      { detail: shown.join('\n') },
    );
  }, [teams, toast, t]);

  const fileNameOf = (p) => (p || '').split(/[\\/]/).pop();

  /**
   * Save over the ROM file (Electron) or download it (web).
   * @param {{ confirm?: boolean }} [options] - confirm: false skips the "overwrite?" question
   *   (the save was already chosen in another prompt)
   * @returns {Promise<boolean>} true when the ROM was written
   */
  const handleSave = useCallback(
    async (options = {}) => {
      if (!romParser) return false;

      // Project session: the ROM is saved inside the project (no file to overwrite)
      if (isElectron() && currentProject) {
        prepareRomForWrite();
        const result = await electronBridge.projectSave(currentProject.id, romParser.getRomData());
        if (result.success) {
          setCurrentProject?.(result.project);
          markSaved(result.project.name);
          electronBridge.notifySaveComplete();
          toast.success(t('toastProjectSaved', { name: result.project.name }));
          reportValidation();
          return true;
        }
        setStatusMessage(result.error);
        toast.error(t('toastSaveFailed'), { detail: t(result.error) });
        return false;
      }

      if (isElectron()) {
        // No file on disk yet (restored backup, dropped file without a path): ask where to save.
        // The dialog answers through 'rom:save-as-path' -> handleSaveToPath.
        const currentPath = await electronBridge.getCurrentPath();
        if (!currentPath) {
          electronBridge.saveRomAs();
          return false;
        }
        // Settings > Editor: ask before overwriting the file
        if (options?.confirm !== false && settings.confirmBeforeSave && confirm) {
          const ok = await confirm({
            message: t('confirmOverwriteRom', { file: fileNameOf(currentPath) }),
            confirmLabel: t('unsavedSave'),
          });
          if (!ok) return false;
        }
        prepareRomForWrite();
        const data = Array.from(romParser.getRomData());
        const result = await electronBridge.saveRom(data);
        if (result.success) {
          markSaved(result.path);
          setRomFile?.(result.path);
          electronBridge.notifySaveComplete();
          toast.success(t('toastSaved', { file: fileNameOf(result.path) }), {
            detail: result.path,
          });
          reportValidation();
          return true;
        }
        setStatusMessage(result.error);
        toast.error(t('toastSaveFailed'), { detail: t(result.error) });
        return false;
      }

      prepareRomForWrite();
      const data = romParser.getRomData();
      const fileName = getModifiedFilename(romInfo?.fileName);
      saveRomWeb(data, fileName);
      markSaved(fileName);
      toast.success(t('toastDownloaded', { file: fileName }));
      reportValidation();
      return true;
    },
    [
      romParser,
      romInfo,
      currentProject,
      setCurrentProject,
      markSaved,
      setRomFile,
      setStatusMessage,
      prepareRomForWrite,
      reportValidation,
      settings.confirmBeforeSave,
      confirm,
      toast,
      t,
    ],
  );

  const handleSaveToPath = useCallback(
    async (filePath) => {
      if (!romParser || !isElectron()) return;
      prepareRomForWrite();
      const data = Array.from(romParser.getRomData());
      const result = await electronBridge.saveRom(data, filePath);
      if (result.success && currentProject) {
        // "Save As" in a project exports a ROM file: the project itself is not saved
        toast.success(t('toastRomExported', { file: fileNameOf(result.path) }), {
          detail: result.path,
        });
        setStatusMessage({ key: 'toastRomExported', params: { file: result.path } });
      } else if (result.success) {
        markSaved(result.path);
        setRomFile?.(result.path);
        electronBridge.notifySaveComplete();
        toast.success(t('toastSaved', { file: fileNameOf(result.path) }), { detail: result.path });
        reportValidation();
      } else {
        setStatusMessage(result.error);
        toast.error(t('toastSaveFailed'), { detail: t(result.error) });
      }
    },
    [
      romParser,
      currentProject,
      markSaved,
      setRomFile,
      setStatusMessage,
      prepareRomForWrite,
      reportValidation,
      toast,
      t,
    ],
  );

  /**
   * Save the current ROM (with pending writes + checksum) to a temp file and
   * open it in the configured emulator. Desktop only.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const handleTestInEmulator = useCallback(async () => {
    if (!romParser) return { success: false };
    if (!isElectron()) {
      setStatusMessage('emulatorDesktopOnly');
      toast.info(t('emulatorDesktopOnly'));
      return { success: false, error: 'emulatorDesktopOnly' };
    }
    prepareRomForWrite();
    const ext = /\.smc$/i.test(romInfo?.fileName || '') ? '.smc' : '.sfc';
    const res = await electronBridge.testInEmulator(Array.from(romParser.getRomData()), ext);
    setStatusMessage(res.success ? `emulatorStarted` : res.error || 'emulatorError');
    if (res.success) toast.success(t('emulatorStarted'));
    else toast.error(t(res.error || 'emulatorError'));
    return res;
  }, [romParser, romInfo, setStatusMessage, prepareRomForWrite, toast, t]);

  /**
   * Export the current edits as an IPS/BPS patch.
   * @param {object} options
   * @param {'bps'|'ips'} options.format
   * @param {Uint8Array} [options.baseData] - clean ROM to diff against (defaults to the ROM as loaded)
   * @param {string} [options.metadata] - BPS free-text metadata
   * @returns {Promise<{success: boolean, canceled?: boolean, path?: string, error?: string, changedBytes?: number, size?: number}>}
   */
  const handleExportPatch = useCallback(
    async ({ format, baseData, metadata = '' }) => {
      if (!romParser) return { success: false, error: 'noRomLoaded' };

      try {
        prepareRomForWrite();
        const base = baseData || romParser.getOriginalData();
        const result = buildPatch({ format, base, modified: romParser.getRomData(), metadata });

        if (result.changedBytes === 0) {
          return { success: false, error: 'noChanges' };
        }

        const fileName = getPatchFilename(romInfo?.fileName, format);
        let saved;
        if (isElectron()) {
          saved = await electronBridge.savePatch(Array.from(result.patch), fileName, format);
          if (!saved.success) return saved;
        } else {
          saveRomWeb(result.patch, fileName);
          saved = { success: true, path: fileName };
        }

        setStatusMessage({
          key: 'statusPatchSaved',
          params: { format: format.toUpperCase(), path: saved.path },
        });
        return {
          ...saved,
          changedBytes: result.changedBytes,
          size: result.patch.length,
          baseCrc: result.baseCrc,
          targetCrc: result.targetCrc,
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [romParser, romInfo, setStatusMessage, prepareRomForWrite],
  );

  const handleOpenRom = useCallback(async () => {
    if (isElectron()) {
      setLoading(true);
      electronBridge.openRom();
    } else {
      const result = await openRomWeb();
      if (result) {
        requestLoadRom(result.data, result.name);
      }
    }
  }, [requestLoadRom, setLoading]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      if (!/\.(smc|sfc|bin)$/i.test(file.name)) {
        setStatusMessage('welcomeDropInvalid');
        toast.error(t('welcomeDropInvalid'), { detail: file.name });
        return;
      }
      const filePath = isElectron() ? electronBridge.getPathForFile(file) : null;
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target.result);
        requestLoadRom(data, file.name, filePath);
      };
      reader.onerror = () => {
        setLoading(false);
        setStatusMessage({
          key: 'statusError',
          params: { error: reader.error?.message || file.name },
        });
        toast.error(t('toastRomLoadFailed', { file: file.name }), {
          detail: reader.error?.message,
        });
      };
      reader.readAsArrayBuffer(file);
    },
    [requestLoadRom, setLoading, setStatusMessage, toast, t],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // === Import/Export ===

  const handleExportTeam = useCallback(
    (teamIndex) => {
      if (!teams[teamIndex]) return;
      const data = exportTeam(teams[teamIndex]);
      const filename = `${teams[teamIndex].name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      downloadJson(data, filename);
      setStatusMessage({ key: 'toastExported', params: { file: filename } });
      toast.success(t('toastExported', { file: filename }));
    },
    [teams, setStatusMessage, toast, t],
  );

  const handleExportAllTeams = useCallback(() => {
    if (teams.length === 0) return;
    const data = exportAllTeams(teams);
    downloadJson(data, 'iss-forge-all-teams.json');
    setStatusMessage({ key: 'toastExported', params: { file: 'iss-forge-all-teams.json' } });
    toast.success(t('toastExported', { file: 'iss-forge-all-teams.json' }));
  }, [teams, setStatusMessage, toast, t]);

  const handleImportTeam = useCallback(
    async (teamIndex) => {
      if (!romParser) return;

      const data = await readJsonFile();
      if (!data) return;

      const validation = validateImport(data);
      if (!validation.valid) {
        setStatusMessage({
          key: 'statusImportError',
          params: { error: { key: validation.error } },
        });
        toast.error(t('toastImportFailed'), { detail: t(validation.error) });
        return;
      }

      const teamData = validation.type === 'single' ? data : null;
      if (!teamData) {
        setStatusMessage({
          key: 'statusImportError',
          params: { error: { key: 'toastImportSingleTeam' } },
        });
        toast.error(t('toastImportFailed'), { detail: t('toastImportSingleTeam') });
        return;
      }

      // Snapshot only once there is something to apply (no empty undo steps)
      pushSnapshot(teams);
      const { warnings } = applyImportedTeam(romParser, teamIndex, teamData);

      // Reload team from ROM to get fresh state
      const updatedTeam = romParser.readTeam(teamIndex);
      setTeams((prev) => {
        const newTeams = [...prev];
        newTeams[teamIndex] = updatedTeam;
        return newTeams;
      });
      // a team sharing the goalkeeper (Super Star / Belgium) changed too
      syncSharedKeepers(teamIndex);

      markModified();
      const name = teamData.name || teamData.teamNameText || t('team');
      setStatusMessage({ key: 'toastTeamImported', params: { name, slot: teamIndex + 1 } });
      toast.success(t('toastTeamImported', { name, slot: teamIndex + 1 }));
      warnings.forEach((w) => toast.warning(t(w)));
    },
    [
      romParser,
      teams,
      markModified,
      setTeams,
      setStatusMessage,
      pushSnapshot,
      syncSharedKeepers,
      toast,
      t,
    ],
  );

  return {
    handlePlayerChange,
    handleUniformChange,
    handleHairSkinChange,
    handleHairSkinTemplateApply,
    handleSpecialHairSkinChange,
    handleRestoreOriginal,
    handlePredominantColorChange,
    handleFlagColorChange,
    handleFlagColorBulkChange,
    handleFlagDesignBulkChange,
    handleTeamNameGenerate,
    handleTeamNameMenuSave,
    handleTeamNameInGameGenerate,
    handleFormationChange,
    handleSwapPlayers,
    handleScenarioChange,
    handleTournamentDrawsChange,
    handleGameTextsChange,
    handleMenuScreenChange,
    handleScreenTextsChange,
    handleExportTexts,
    handleImportTexts,
    handleTeamDescriptionChange,
    handleCopyTeam,
    handleMatchPaletteChange,
    handleTitleScreenChange,
    handleTitleTextsChange,
    handleTitleLogoChange,
    handleTitleBackgroundChange,
    handleSave,
    handleSaveToPath,
    handleExportPatch,
    handleTestInEmulator,
    handleOpenRom,
    handleDrop,
    handleDragOver,
    handleExportTeam,
    handleExportAllTeams,
    handleImportTeam,
  };
}
