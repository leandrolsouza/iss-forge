/**
 * RomParser - Thin facade for ISS ROM operations
 * Low-level byte access + delegates to specialized reader/writer modules
 */
import { TEAMS, TEAM_COUNT, PLAYER_NAMES } from './constants';
import { readPlayerNames, readPlayerData, bytesToIssText } from './readers/PlayerReader';
import {
  readUniformColors,
  readHairSkinColors,
  readFlagColors,
  readSpecialHair,
  readSpecialSkin,
} from './readers/UniformReader';
import { readFlagDesign } from './readers/FlagDesignReader';
import { readTeamNameText } from './readers/TeamNameReader';
import { writePlayerName, writePlayerData, swapPlayers } from './writers/PlayerWriter';
import {
  writeUniformColor,
  writeHairSkinColor,
  writeFlagColor,
  writeSpecialHair,
  writeSpecialSkin,
} from './writers/UniformWriter';
import {
  writeFlagDesign,
  readFlagDesignBytes,
  writeFlagDesignBytes,
} from './writers/FlagDesignWriter';
import {
  writeTeamNameText,
  writeTeamNameMenu,
  writeTeamNameInGame,
  getSlotMaxChars,
  readTeamNameBytes,
  writeTeamNameBytes,
} from './writers/TeamNameWriter';

import { quickValidate } from './romValidator';
import { fixChecksum, inspectChecksum } from './checksum';
import { readFormation, writeFormation, decodeFormation } from './formation';
import { readScenarios, writeScenario } from './scenario';
import { readDraws, writeDraw, readDrawBytes, restoreDrawBytes } from './tournament';
import {
  readTrainingTexts,
  writeTrainingTexts,
  readTrainingTextBytes,
  restoreTrainingTextBytes,
} from './gameTexts';
import {
  readMenuScreens,
  writeMenuScreen,
  readMenuScreenBytes,
  restoreMenuScreenBytes,
} from './menuScreens';
import {
  readScreenTexts,
  writeScreenTexts,
  readScreenTextBytes,
  restoreScreenTextBytes,
} from './screenTexts';
import {
  readTeamDescription,
  readTeamDescriptions,
  writeTeamDescription,
  readTeamDescriptionBytes,
  writeTeamDescriptionBytes,
} from './teamDescription';
import {
  readMatchPalettes,
  writeMatchPalette,
  applyPaletteUpdates,
  paletteStateToUpdates,
} from './palettes';

export default class RomParser {
  constructor(romData) {
    this.data = new Uint8Array(romData);
    // Pristine copy of the file as loaded — used as the default base for patch export
    this.originalData = new Uint8Array(this.data);
    this.hasHeader = this.data.length % 1024 === 512;
    this.headerOffset = this.hasHeader ? 512 : 0;
  }

  // === Low-level byte access ===

  offset(addr) {
    return addr + this.headerOffset;
  }
  readByte(addr) {
    return this.data[this.offset(addr)];
  }
  writeByte(addr, value) {
    this.data[this.offset(addr)] = value & 0xff;
  }

  readBytes(addr, length) {
    const start = this.offset(addr);
    return this.data.slice(start, start + length);
  }

  writeBytes(addr, bytes) {
    const start = this.offset(addr);
    for (let i = 0; i < bytes.length; i++) {
      this.data[start + i] = bytes[i] & 0xff;
    }
  }

  getRomData() {
    return this.data;
  }
  getRawData() {
    return this.data;
  }
  /** Bytes of the ROM exactly as it was when loaded (never mutated) */
  getOriginalData() {
    return this.originalData;
  }

  // === Internal checksum ===

  /** @returns {{ stored: number, storedComplement: number, calculated: number, valid: boolean }} */
  getChecksumInfo() {
    return inspectChecksum(this.data, this.headerOffset);
  }

  /**
   * Recalculate the SNES internal checksum/complement in the buffer.
   * Must be called after the last write and before saving/exporting.
   */
  fixChecksum() {
    return fixChecksum(this.data, this.headerOffset);
  }

  // === Delegated Readers ===

  readPlayerNames(teamIndex) {
    return readPlayerNames(this, teamIndex);
  }
  readPlayerData(teamIndex) {
    return readPlayerData(this, teamIndex);
  }
  readUniformColors(teamIndex) {
    return readUniformColors(this, teamIndex);
  }
  readHairSkinColors(teamIndex) {
    return readHairSkinColors(this, teamIndex);
  }
  readFlagColors(teamIndex) {
    return readFlagColors(this, teamIndex);
  }
  readSpecialHair(teamIndex) {
    return readSpecialHair(this, teamIndex);
  }
  readSpecialSkin(teamIndex) {
    return readSpecialSkin(this, teamIndex);
  }
  readFlagDesign(teamIndex) {
    return readFlagDesign(this, teamIndex);
  }
  /**
   * Players with names + data. `nameRaw` keeps the exact 8 name bytes (the
   * original ROM pads some names with leading spaces) so undo can restore
   * them byte-for-byte.
   */
  readPlayers(teamIndex) {
    const names = this.readPlayerNames(teamIndex);
    const data = this.readPlayerData(teamIndex);
    return names.map((name, i) => ({
      name,
      nameRaw: Array.from(
        this.readBytes(
          PLAYER_NAMES.OFFSET + teamIndex * PLAYER_NAMES.TEAM_LENGTH + i * PLAYER_NAMES.NAME_LENGTH,
          PLAYER_NAMES.NAME_LENGTH,
        ),
      ),
      ...data[i],
    }));
  }
  readTeamNameText(teamIndex) {
    return readTeamNameText(this, teamIndex);
  }
  readFormation(teamIndex) {
    return readFormation(this, teamIndex);
  }
  /** Formation slots as they were in the ROM when it was loaded */
  readOriginalFormation(teamIndex) {
    const { address } = readFormation(this, teamIndex);
    const start = this.offset(address);
    return decodeFormation(this.originalData.subarray(start, start + 44));
  }

  // === Delegated Writers ===

  /** Pitch / ball / referee / stadium palettes + crowds: { [id]: rawColor[], crowds, crowdMap } */
  readMatchPalettes() {
    return readMatchPalettes(this);
  }
  writeMatchPalette(id, colors) {
    writeMatchPalette(this, id, colors);
  }
  /** Batch edit: { paletteId: colours, 'crowd:N': colours, 'crowdMap:TEAM': n } */
  applyPaletteUpdates(updates) {
    applyPaletteUpdates(this, updates);
  }
  /** Restore palettes from a snapshot (undo/redo), writing only what changed */
  restoreMatchPalettes(palettes) {
    if (!palettes) return;
    applyPaletteUpdates(this, paletteStateToUpdates(palettes, readMatchPalettes(this)));
  }

  /** The 9 Scenario mode situations */
  readScenarios() {
    return readScenarios(this);
  }
  /** @returns {{ ok: boolean, error?: string }} */
  writeScenario(index, scenario) {
    return writeScenario(this, index, scenario);
  }
  /** Restore the scenarios from a snapshot (undo/redo), writing only what changed */
  restoreScenarios(scenarios) {
    if (!Array.isArray(scenarios)) return;
    const current = readScenarios(this);
    scenarios.forEach((sc, i) => {
      if (JSON.stringify(sc) !== JSON.stringify(current[i])) writeScenario(this, i, sc);
    });
  }

  /** International Cup / World Series draws: 32 x 24 TEAMS indexes */
  readTournamentDraws() {
    return readDraws(this);
  }
  writeTournamentDraw(index, teams) {
    writeDraw(this, index, teams);
  }
  readTournamentDrawBytes() {
    return readDrawBytes(this);
  }
  restoreTournamentDrawBytes(bytes) {
    restoreDrawBytes(this, bytes);
  }

  /** Training mode texts (intros, results, messages, titles) */
  readTrainingTexts() {
    return readTrainingTexts(this);
  }
  /** @returns {{ ok: boolean, error?: string }} */
  writeTrainingTexts(texts) {
    return writeTrainingTexts(this, texts);
  }
  readTrainingTextBytes() {
    return readTrainingTextBytes(this);
  }
  restoreTrainingTextBytes(snap) {
    restoreTrainingTextBytes(this, snap);
  }

  /** Menu screens (compressed tilemaps) and their texts */
  readMenuScreens() {
    return readMenuScreens(this);
  }
  writeMenuScreen(offset, texts) {
    return writeMenuScreen(this, offset, texts);
  }
  readMenuScreenBytes() {
    return readMenuScreenBytes(this);
  }
  restoreMenuScreenBytes(snap) {
    restoreMenuScreenBytes(this, snap);
  }

  /** Fixed texts drawn by code (joypad controls, scenario, cup group, ...) */
  readScreenTexts() {
    return readScreenTexts(this);
  }
  /** @returns {{ ok: boolean, error?: string, issues?: object[] }} */
  writeScreenTexts(texts) {
    return writeScreenTexts(this, texts);
  }
  readScreenTextBytes() {
    return readScreenTextBytes(this);
  }
  restoreScreenTextBytes(snap) {
    restoreScreenTextBytes(this, snap);
  }

  writeFormation(teamIndex, slots) {
    writeFormation(this, teamIndex, slots);
  }
  swapPlayers(teamIndex, a, b) {
    swapPlayers(this, teamIndex, a, b);
  }
  writePlayerName(teamIndex, playerIndex, name) {
    writePlayerName(this, teamIndex, playerIndex, name);
  }
  writePlayerData(teamIndex, playerIndex, data) {
    writePlayerData(this, teamIndex, playerIndex, data);
  }
  writeUniformColor(teamIndex, kit, part, colorIndex, color) {
    writeUniformColor(this, teamIndex, kit, part, colorIndex, color);
  }
  writeHairSkinColor(teamIndex, kit, part, colorIndex, color) {
    writeHairSkinColor(this, teamIndex, kit, part, colorIndex, color);
  }
  writeFlagColor(teamIndex, colorIndex, color) {
    writeFlagColor(this, teamIndex, colorIndex, color);
  }
  writeSpecialHair(teamIndex, typeId) {
    writeSpecialHair(this, teamIndex, typeId);
  }
  writeSpecialSkin(teamIndex, typeId) {
    writeSpecialSkin(this, teamIndex, typeId);
  }
  writeFlagDesign(teamIndex, grid) {
    return writeFlagDesign(this, teamIndex, grid);
  }
  writeTeamNameText(teamIndex, text) {
    return writeTeamNameText(this, teamIndex, text);
  }
  writeTeamNameMenu(teamIndex, text) {
    return writeTeamNameMenu(this, teamIndex, text);
  }
  writeTeamNameInGame(teamIndex, text) {
    return writeTeamNameInGame(this, teamIndex, text);
  }
  /** Raw snapshot of every team-name region (for undo/redo) */
  readTeamNameBytes() {
    return readTeamNameBytes(this);
  }
  /** Restore a team-name snapshot; returns true when something changed */
  restoreTeamNameBytes(snapshot) {
    if (!snapshot) return false;
    if (JSON.stringify(snapshot) === JSON.stringify(readTeamNameBytes(this))) return false;
    writeTeamNameBytes(this, snapshot);
    return true;
  }
  /** Selection-screen description ({ title, titleColor, body }) */
  readTeamDescription(teamIndex) {
    return readTeamDescription(this, teamIndex);
  }
  /** @returns {{ ok: boolean, used: number, capacity: number }} */
  writeTeamDescription(teamIndex, desc) {
    return writeTeamDescription(this, teamIndex, desc);
  }
  readTeamDescriptions() {
    return readTeamDescriptions(this);
  }
  readTeamDescriptionBytes() {
    return readTeamDescriptionBytes(this);
  }
  readFlagDesignBytes() {
    return readFlagDesignBytes(this);
  }
  restoreFlagDesignBytes(snapshot) {
    if (!snapshot) return false;
    if (JSON.stringify(snapshot) === JSON.stringify(readFlagDesignBytes(this))) return false;
    writeFlagDesignBytes(this, snapshot);
    return true;
  }
  restoreTeamDescriptionBytes(snapshot) {
    if (!snapshot) return false;
    if (JSON.stringify(snapshot) === JSON.stringify(readTeamDescriptionBytes(this))) return false;
    writeTeamDescriptionBytes(this, snapshot);
    return true;
  }

  // === Composite Readers ===

  readTeam(teamIndex) {
    const teamInfo = TEAMS[teamIndex];
    const players = this.readPlayers(teamIndex);
    const uniforms = this.readUniformColors(teamIndex);
    const hairSkin = this.readHairSkinColors(teamIndex);
    const flagColors = this.readFlagColors(teamIndex);
    const specialHair = this.readSpecialHair(teamIndex);
    const specialSkin = this.readSpecialSkin(teamIndex);
    const flagDesignData = this.readFlagDesign(teamIndex);
    const teamNameText = this.readTeamNameText(teamIndex);
    const formation = this.readFormation(teamIndex);
    const description = this.readTeamDescription(teamIndex);

    // Use ROM team name as display name if it clearly differs from the default
    // Original ROM names may vary slightly (e.g., "SWITZ" vs "Swiss", "DNMARK" vs "Denmark")
    // so we check if the ROM name contains ANY part of the default name (3+ chars)
    const defaultUpper = teamInfo.name.toUpperCase().replace(/[^A-Z]/g, '');
    const romUpper = (teamNameText || '').replace(/[^A-Z]/g, '');
    const isModified =
      teamNameText &&
      romUpper.length >= 3 &&
      !romUpper.includes(defaultUpper.substring(0, 3)) &&
      !defaultUpper.includes(romUpper.substring(0, 3));
    const displayName = isModified ? teamNameText : teamInfo.name;

    return {
      ...teamInfo,
      name: displayName,
      index: teamIndex,
      players,
      uniforms,
      hairSkin,
      specialHair,
      specialSkin,
      flagColors,
      flagDesign: {
        grid: flagDesignData.grid,
        flagColors,
        topAddr: flagDesignData.topAddr,
        bottomAddr: flagDesignData.bottomAddr,
      },
      teamNameText,
      formation: { slots: formation.slots, name: formation.name },
      description,
    };
  }

  readAllTeams() {
    const teams = [];
    for (let i = 0; i < TEAM_COUNT; i++) teams.push(this.readTeam(i));
    return teams;
  }

  // === Validation ===

  validate() {
    return quickValidate(this.data);
  }

  // === Slot Capacity ===

  getSlotMaxChars(teamIndex) {
    return getSlotMaxChars(this, teamIndex);
  }

  // === Undo/Redo Support ===

  /**
   * Re-write team data into the ROM buffer from a teams state snapshot.
   * Used after undo/redo to keep the buffer in sync with React state.
   *
   * When `currentTeams` is given only the fields that differ are written.
   * This matters: re-encoding untouched data is NOT lossless (names lose
   * their original padding, flag designs are recompressed and the flag
   * pointer table shifts), so a blind full rewrite would silently alter the
   * whole ROM on every undo.
   *
   * @param {Array} teams - full teams array as returned by readAllTeams
   * @param {Array} [currentTeams] - teams state before the undo/redo (for diffing)
   */
  reloadTeams(teams, currentTeams) {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    teams.forEach((team, teamIndex) => {
      const cur = currentTeams?.[teamIndex];
      const changed = (key) => !cur || !same(team[key], cur[key]);
      if (cur && same(team, cur)) return;

      // Players
      team.players.forEach((player, playerIndex) => {
        const curPlayer = cur?.players?.[playerIndex];
        const nameChanged =
          !curPlayer || player.name !== curPlayer.name || !same(player.nameRaw, curPlayer.nameRaw);
        if (nameChanged) {
          // Prefer the exact original bytes when they still match the name
          const raw = player.nameRaw;
          if (raw && bytesToIssText(raw).trim() === player.name) {
            this.writeBytes(
              PLAYER_NAMES.OFFSET +
                teamIndex * PLAYER_NAMES.TEAM_LENGTH +
                playerIndex * PLAYER_NAMES.NAME_LENGTH,
              raw,
            );
          } else {
            writePlayerName(this, teamIndex, playerIndex, player.name);
          }
        }
        const strip = (p) => {
          if (!p) return null;
          const copy = { ...p };
          delete copy.name;
          delete copy.nameRaw;
          return copy;
        };
        if (!curPlayer || !same(strip(player), strip(curPlayer))) {
          writePlayerData(this, teamIndex, playerIndex, player);
        }
      });

      // Uniforms
      if (team.uniforms && changed('uniforms')) {
        Object.entries(team.uniforms).forEach(([kit, parts]) => {
          Object.entries(parts).forEach(([part, colors]) => {
            if (Array.isArray(colors)) {
              colors.forEach((color, colorIndex) => {
                writeUniformColor(this, teamIndex, kit, part, colorIndex, color);
              });
            }
          });
        });
      }

      // Hair & Skin
      if (team.hairSkin && changed('hairSkin')) {
        Object.entries(team.hairSkin).forEach(([kit, parts]) => {
          Object.entries(parts).forEach(([part, colors]) => {
            if (Array.isArray(colors)) {
              colors.forEach((color, colorIndex) => {
                writeHairSkinColor(this, teamIndex, kit, part, colorIndex, color);
              });
            }
          });
        });
      }

      // Flag Colors
      if (team.flagColors && changed('flagColors')) {
        team.flagColors.forEach((color, colorIndex) => {
          writeFlagColor(this, teamIndex, colorIndex, color);
        });
      }

      // Special Hair & Skin
      if (team.specialHair !== undefined && changed('specialHair')) {
        writeSpecialHair(this, teamIndex, team.specialHair);
      }
      if (team.specialSkin !== undefined && changed('specialSkin')) {
        writeSpecialSkin(this, teamIndex, team.specialSkin);
      }

      // Flag Design (only the pixel grid matters; recompression is not lossless)
      if (team.flagDesign?.grid && (!cur || !same(team.flagDesign.grid, cur.flagDesign?.grid))) {
        writeFlagDesign(this, teamIndex, team.flagDesign.grid);
      }

      // Formation
      if (Array.isArray(team.formation?.slots) && changed('formation')) {
        writeFormation(this, teamIndex, team.formation.slots);
      }
    });
  }
}
