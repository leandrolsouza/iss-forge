/**
 * ROM edit handlers hook
 * All write operations that modify ROM data and update React state
 */
import { useCallback } from 'react';
import { openRomWeb, saveRomWeb, isElectron, getModifiedFilename } from '../utils/fileHelpers';
import { validateRom, getValidationSummary } from '../utils/validation';
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
import { buildPatch, getPatchFilename } from '../rom/patches';
import { withDerivedStats } from '../rom/playerStats';
import { exportTexts, applyTexts } from '../utils/textsExport';

export default function useRomHandlers({
  romParser,
  romInfo,
  teams,
  setTeams,
  markModified,
  markSaved,
  setStatusMessage,
  requestLoadRom,
  setLoading,
  pushSnapshot,
  setScenarios,
  setMatchPalettes,
  setTournamentDraws,
  setGameTexts,
  setMenuScreens,
  setScreenTexts,
  setTitleScreen,
}) {
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

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
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

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
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

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
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

  const handleFlagDesignChange = useCallback(
    (teamIndex, row, col, colorIdx) => {
      if (!romParser) return;
      pushSnapshot(teams);

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const flagDesign = { ...team.flagDesign };
        const grid = flagDesign.grid.map((r) => [...r]);
        grid[row][col] = colorIdx;
        flagDesign.grid = grid;
        flagDesign.dirty = true;
        team.flagDesign = flagDesign;
        newTeams[teamIndex] = team;
        return newTeams;
      });

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  const handleFlagDesignBulkChange = useCallback(
    (teamIndex, newGrid) => {
      if (!romParser) return;
      pushSnapshot(teams);

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const flagDesign = { ...team.flagDesign };
        flagDesign.grid = newGrid.map((r) => [...r]);
        flagDesign.dirty = true;
        team.flagDesign = flagDesign;
        newTeams[teamIndex] = team;
        return newTeams;
      });

      markModified();
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  const handleTeamNameGenerate = useCallback(
    (teamIndex, text) => {
      if (!romParser) return;
      pushSnapshot(teams);

      const success = romParser.writeTeamNameText(teamIndex, text);
      if (success) {
        const newName = romParser.readTeamNameText(teamIndex);
        setTeams((prev) => {
          const newTeams = [...prev];
          const team = { ...newTeams[teamIndex] };
          team.teamNameText = newName;
          newTeams[teamIndex] = team;
          return newTeams;
        });
        markModified();
        setStatusMessage(`Generated: ${text}`);
      } else {
        setStatusMessage(`Error: "${text}" too long`);
      }
    },
    [romParser, teams, markModified, setTeams, setStatusMessage, pushSnapshot],
  );

  const handleTeamNameMenuSave = useCallback(
    (teamIndex, text) => {
      if (!romParser) return;
      pushSnapshot(teams);

      const success = romParser.writeTeamNameMenu(teamIndex, text);
      if (success) {
        const newName = romParser.readTeamNameText(teamIndex);
        setTeams((prev) => {
          const newTeams = [...prev];
          const team = { ...newTeams[teamIndex] };
          team.teamNameText = newName;
          newTeams[teamIndex] = team;
          return newTeams;
        });
        markModified();
        setStatusMessage(`Menu name: ${text}`);
      } else {
        setStatusMessage(`Error: "${text}" too long`);
      }
    },
    [romParser, teams, markModified, setTeams, setStatusMessage, pushSnapshot],
  );

  const handleTeamNameInGameGenerate = useCallback(
    (teamIndex, text) => {
      if (!romParser) return;
      pushSnapshot(teams);

      const success = romParser.writeTeamNameInGame(teamIndex, text);
      if (success) {
        setTeams((prev) => {
          const newTeams = [...prev];
          const team = { ...newTeams[teamIndex] };
          team.teamNameInGame = text;
          newTeams[teamIndex] = team;
          return newTeams;
        });
        markModified();
        setStatusMessage(`In-game: ${text}`);
      } else {
        setStatusMessage(`Error: "${text}" failed`);
      }
    },
    [romParser, teams, markModified, setTeams, setStatusMessage, pushSnapshot],
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
      const updates = typeof idOrMap === 'string' ? { [idOrMap]: colors } : idOrMap;
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
      setTitleScreen(romParser.readTitleScreen());
      if (result.ok) markModified();
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, setTitleScreen],
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
      setTitleScreen(romParser.readTitleScreen());
      // the blocks are placed like menu screens and may move them
      setMenuScreens(romParser.readMenuScreens());
      if (result.ok) markModified();
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, setTitleScreen, setMenuScreens],
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
      // a failed write may still have moved blocks around: always re-read
      setTitleScreen(romParser.readTitleScreen());
      setMenuScreens(romParser.readMenuScreens());
      if (result.ok) markModified();
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, setTitleScreen, setMenuScreens],
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
      }
      return res;
    },
    [romParser, teams, markModified, setTeams, pushSnapshot],
  );

  /**
   * Copy (or swap) a whole team to another slot — one undo step.
   */
  const handleCopyTeam = useCallback(
    (from, to, swap = false) => {
      if (!romParser || from === to) return;
      pushSnapshot(teams);
      const wanted = [teams[from]?.teamNameText, swap ? teams[to]?.teamNameText : null];
      copyTeam(romParser, from, to, { swap });
      const fresh = romParser.readAllTeams();
      setTeams(fresh);
      setMatchPalettes(romParser.readMatchPalettes());
      markModified();
      const truncated =
        (wanted[0] && fresh[to].teamNameText !== wanted[0]) ||
        (swap && wanted[1] && fresh[from].teamNameText !== wanted[1]);
      setStatusMessage(
        truncated ? 'copyTeamNameTruncated' : swap ? 'swapTeamDone' : 'copyTeamDone',
      );
    },
    [romParser, teams, markModified, setTeams, setMatchPalettes, setStatusMessage, pushSnapshot],
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
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, setScenarios],
  );

  /**
   * Replace tournament draws. `changes` maps draw index -> 24 TEAMS indexes.
   */
  const handleTournamentDrawsChange = useCallback(
    (changes) => {
      if (!romParser || !changes) return;
      pushSnapshot(teams);
      Object.entries(changes).forEach(([index, draw]) =>
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
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, setGameTexts],
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
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, setMenuScreens],
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
      }
      return result;
    },
    [romParser, teams, markModified, pushSnapshot, setScreenTexts, setMenuScreens],
  );

  /** Export every translatable text as one JSON file */
  const handleExportTexts = useCallback(() => {
    if (!romParser) return;
    const base = (romInfo?.fileName || 'iss')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_');
    downloadJson(exportTexts(romParser), `${base}_texts.json`);
    setStatusMessage(`Exported: ${base}_texts.json`);
  }, [romParser, romInfo, setStatusMessage]);

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
   * Flush pending (deferred) writes into the ROM buffer and repair the SNES
   * internal checksum. Must run before any save or patch export so the output
   * is complete and passes checksum checks in emulators/flashcarts.
   */
  const prepareRomForWrite = useCallback(() => {
    // Write dirty flag designs (they are compressed only at save time)
    teams.forEach((team, idx) => {
      if (team.flagDesign && team.flagDesign.dirty) {
        romParser.writeFlagDesign(idx, team.flagDesign.grid);
        team.flagDesign.dirty = false;
      }
    });

    try {
      romParser.fixChecksum();
    } catch (err) {
      console.warn('[Checksum] Could not fix internal checksum:', err.message);
    }
  }, [romParser, teams]);

  /** @returns {Promise<boolean>} true when the ROM was written */
  const handleSave = useCallback(async () => {
    if (!romParser) return false;

    // Validate
    const warnings = validateRom(teams);
    const summary = getValidationSummary(warnings);
    if (summary.errors > 0) {
      console.warn('[Validation] Errors:', warnings.filter((w) => w.type === 'error').slice(0, 5));
    }

    if (isElectron()) {
      // No file on disk yet (restored backup, dropped file without a path): ask where to save.
      // The dialog answers through 'rom:save-as-path' -> handleSaveToPath.
      const currentPath = await electronBridge.getCurrentPath();
      if (!currentPath) {
        electronBridge.saveRomAs();
        return false;
      }
      prepareRomForWrite();
      const data = Array.from(romParser.getRomData());
      const result = await electronBridge.saveRom(data);
      if (result.success) {
        markSaved(result.path);
        electronBridge.notifySaveComplete();
        return true;
      }
      setStatusMessage(result.error);
      return false;
    }

    prepareRomForWrite();
    const data = romParser.getRomData();
    const fileName = getModifiedFilename(romInfo?.fileName);
    saveRomWeb(data, fileName);
    markSaved(fileName);
    return true;
  }, [romParser, romInfo, teams, markSaved, setStatusMessage, prepareRomForWrite]);

  const handleSaveToPath = useCallback(
    async (filePath) => {
      if (!romParser || !isElectron()) return;
      prepareRomForWrite();
      const data = Array.from(romParser.getRomData());
      const result = await electronBridge.saveRom(data, filePath);
      if (result.success) {
        markSaved(result.path);
        electronBridge.notifySaveComplete();
      } else {
        setStatusMessage(result.error);
      }
    },
    [romParser, markSaved, setStatusMessage, prepareRomForWrite],
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
      return { success: false, error: 'emulatorDesktopOnly' };
    }
    prepareRomForWrite();
    const ext = /\.smc$/i.test(romInfo?.fileName || '') ? '.smc' : '.sfc';
    const res = await electronBridge.testInEmulator(Array.from(romParser.getRomData()), ext);
    setStatusMessage(res.success ? `emulatorStarted` : res.error || 'emulatorError');
    return res;
  }, [romParser, romInfo, setStatusMessage, prepareRomForWrite]);

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
      if (!romParser) return { success: false, error: 'No ROM loaded' };

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

        setStatusMessage(`Patch ${format.toUpperCase()}: ${saved.path}`);
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
        setStatusMessage(`Error: ${reader.error?.message || file.name}`);
      };
      reader.readAsArrayBuffer(file);
    },
    [requestLoadRom, setLoading, setStatusMessage],
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
      setStatusMessage(`Exported: ${filename}`);
    },
    [teams, setStatusMessage],
  );

  const handleExportAllTeams = useCallback(() => {
    if (teams.length === 0) return;
    const data = exportAllTeams(teams);
    downloadJson(data, 'iss-forge-all-teams.json');
    setStatusMessage('Exported all teams');
  }, [teams, setStatusMessage]);

  const handleImportTeam = useCallback(
    async (teamIndex) => {
      if (!romParser) return;
      pushSnapshot(teams);

      const data = await readJsonFile();
      if (!data) return;

      const validation = validateImport(data);
      if (!validation.valid) {
        setStatusMessage(`Import error: ${validation.error}`);
        return;
      }

      const teamData = validation.type === 'single' ? data : null;
      if (!teamData) {
        setStatusMessage('Import error: select a single team file');
        return;
      }

      applyImportedTeam(romParser, teamIndex, teamData);

      // Reload team from ROM to get fresh state
      const updatedTeam = romParser.readTeam(teamIndex);
      setTeams((prev) => {
        const newTeams = [...prev];
        newTeams[teamIndex] = updatedTeam;
        return newTeams;
      });

      markModified();
      setStatusMessage(
        `Imported: ${teamData.name || teamData.teamNameText || 'team'} → slot ${teamIndex + 1}`,
      );
    },
    [romParser, teams, markModified, setTeams, setStatusMessage, pushSnapshot],
  );

  return {
    handlePlayerChange,
    handleUniformChange,
    handleHairSkinChange,
    handleHairSkinTemplateApply,
    handleSpecialHairSkinChange,
    handleFlagColorChange,
    handleFlagColorBulkChange,
    handleFlagDesignChange,
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
