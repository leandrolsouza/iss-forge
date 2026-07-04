/**
 * RomParser - Thin facade for ISS ROM operations
 * Low-level byte access + delegates to specialized reader/writer modules
 */
import { TEAMS, TEAM_COUNT } from './constants';
import { readPlayerNames, readPlayerData } from './readers/PlayerReader';
import {
  readUniformColors,
  readHairSkinColors,
  readFlagColors,
  readSpecialHair,
  readSpecialSkin,
} from './readers/UniformReader';
import { readFlagDesign } from './readers/FlagDesignReader';
import { readTeamNameText } from './readers/TeamNameReader';
import { writePlayerName, writePlayerData } from './writers/PlayerWriter';
import {
  writeUniformColor,
  writeHairSkinColor,
  writeFlagColor,
  writeSpecialHair,
  writeSpecialSkin,
} from './writers/UniformWriter';
import { writeFlagDesign } from './writers/FlagDesignWriter';
import {
  writeTeamNameText,
  writeTeamNameMenu,
  writeTeamNameInGame,
  getSlotMaxChars,
} from './writers/TeamNameWriter';

import { quickValidate } from './romValidator';

export default class RomParser {
  constructor(romData) {
    this.data = new Uint8Array(romData);
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
  readTeamNameText(teamIndex) {
    return readTeamNameText(this, teamIndex);
  }

  // === Delegated Writers ===

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

  // === Composite Readers ===

  readTeam(teamIndex) {
    const teamInfo = TEAMS[teamIndex];
    const names = this.readPlayerNames(teamIndex);
    const playerData = this.readPlayerData(teamIndex);
    const uniforms = this.readUniformColors(teamIndex);
    const hairSkin = this.readHairSkinColors(teamIndex);
    const flagColors = this.readFlagColors(teamIndex);
    const specialHair = this.readSpecialHair(teamIndex);
    const specialSkin = this.readSpecialSkin(teamIndex);
    const flagDesignData = this.readFlagDesign(teamIndex);
    const teamNameText = this.readTeamNameText(teamIndex);

    const players = names.map((name, i) => ({ name, ...playerData[i] }));

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
   * Re-write all team data into the ROM buffer from a teams state snapshot.
   * Used after undo/redo to keep the buffer in sync with React state.
   * @param {Array} teams - full teams array as returned by readAllTeams
   */
  reloadTeams(teams) {
    teams.forEach((team, teamIndex) => {
      // Players
      team.players.forEach((player, playerIndex) => {
        writePlayerName(this, teamIndex, playerIndex, player.name);
        writePlayerData(this, teamIndex, playerIndex, player);
      });

      // Uniforms
      if (team.uniforms) {
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
      if (team.hairSkin) {
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
      if (team.flagColors) {
        team.flagColors.forEach((color, colorIndex) => {
          writeFlagColor(this, teamIndex, colorIndex, color);
        });
      }

      // Special Hair & Skin
      if (team.specialHair !== undefined) {
        writeSpecialHair(this, teamIndex, team.specialHair);
      }
      if (team.specialSkin !== undefined) {
        writeSpecialSkin(this, teamIndex, team.specialSkin);
      }

      // Flag Design
      if (team.flagDesign && team.flagDesign.grid) {
        writeFlagDesign(this, teamIndex, team.flagDesign.grid);
      }
    });
  }
}
