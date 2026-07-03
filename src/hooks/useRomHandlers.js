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
} from '../utils/teamExport';
import * as electronBridge from '../services/electronBridge';

export default function useRomHandlers({
  romParser,
  romInfo,
  teams,
  setTeams,
  markModified,
  markSaved,
  setStatusMessage,
  loadRomData,
  setLoading,
  pushSnapshot,
}) {
  const handlePlayerChange = useCallback(
    (teamIndex, playerIndex, field, value) => {
      if (!romParser) return;
      pushSnapshot(teams);

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const players = [...team.players];
        players[playerIndex] = { ...players[playerIndex], [field]: value };
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
          r5: Math.round(color.r / 8),
          g5: Math.round(color.g / 8),
          b5: Math.round(color.b / 8),
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

  const handleHairSkinChange = useCallback(
    (teamIndex, kit, part, colorIndex, color) => {
      if (!romParser) return;
      pushSnapshot(teams);
      romParser.writeHairSkinColor(teamIndex, kit, part, colorIndex, color);

      setTeams((prev) => {
        const newTeams = [...prev];
        const team = { ...newTeams[teamIndex] };
        const hairSkin = { ...team.hairSkin };
        const kitData = { ...hairSkin[kit] };
        const partColors = [...(kitData[part] || [])];
        partColors[colorIndex] = {
          ...color,
          r5: Math.round(color.r / 8),
          g5: Math.round(color.g / 8),
          b5: Math.round(color.b / 8),
        };
        kitData[part] = partColors;
        hairSkin[kit] = kitData;
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
          r5: Math.round(color.r / 8),
          g5: Math.round(color.g / 8),
          b5: Math.round(color.b / 8),
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
          r5: Math.round(color.r / 8),
          g5: Math.round(color.g / 8),
          b5: Math.round(color.b / 8),
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

  const handleSave = useCallback(async () => {
    if (!romParser) return;

    // Validate
    const warnings = validateRom(teams);
    const summary = getValidationSummary(warnings);
    if (summary.errors > 0) {
      console.warn('[Validation] Errors:', warnings.filter((w) => w.type === 'error').slice(0, 5));
    }

    // Write dirty flag designs
    teams.forEach((team, idx) => {
      if (team.flagDesign && team.flagDesign.dirty) {
        romParser.writeFlagDesign(idx, team.flagDesign.grid);
        team.flagDesign.dirty = false;
      }
    });

    if (isElectron()) {
      const data = Array.from(romParser.getRomData());
      const result = await electronBridge.saveRom(data);
      if (result.success) {
        markSaved(result.path);
        electronBridge.notifySaveComplete();
      } else {
        setStatusMessage(result.error);
      }
    } else {
      const data = romParser.getRomData();
      const fileName = getModifiedFilename(romInfo?.fileName);
      saveRomWeb(data, fileName);
      markSaved(fileName);
    }
  }, [romParser, romInfo, teams, markSaved, setStatusMessage]);

  const handleSaveToPath = useCallback(
    async (filePath) => {
      if (!romParser || !isElectron()) return;
      const data = Array.from(romParser.getRomData());
      const result = await electronBridge.saveRom(data, filePath);
      if (result.success) {
        markSaved(result.path);
        electronBridge.notifySaveComplete();
      } else {
        setStatusMessage(result.error);
      }
    },
    [romParser, markSaved, setStatusMessage],
  );

  const handleOpenRom = useCallback(async () => {
    if (isElectron()) {
      setLoading(true);
      electronBridge.openRom();
    } else {
      const result = await openRomWeb();
      if (result) {
        loadRomData(result.data, result.name);
      }
    }
  }, [loadRomData, setLoading]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const data = new Uint8Array(ev.target.result);
          loadRomData(data, file.name);
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [loadRomData, setLoading],
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
    handleFlagColorChange,
    handleFlagColorBulkChange,
    handleFlagDesignChange,
    handleFlagDesignBulkChange,
    handleTeamNameGenerate,
    handleTeamNameMenuSave,
    handleTeamNameInGameGenerate,
    handleSave,
    handleSaveToPath,
    handleOpenRom,
    handleDrop,
    handleDragOver,
    handleExportTeam,
    handleExportAllTeams,
    handleImportTeam,
  };
}
