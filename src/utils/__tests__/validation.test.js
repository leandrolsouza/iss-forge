import { describe, it, expect } from 'vitest';
import { validateRom, getValidationSummary } from '../validation';

function makePlayer(overrides = {}) {
  return {
    name: 'PLAYER',
    number: 1,
    shooting: 7,
    speed: 8,
    stamina: 10,
    ...overrides,
  };
}

function makeTeam(overrides = {}) {
  return {
    name: 'TestTeam',
    players: Array.from({ length: 15 }, (_, i) => makePlayer({ number: i + 1 })),
    uniforms: {
      home: {
        shirt: [
          { r: 248, g: 0, b: 0 },
          { r: 200, g: 0, b: 0 },
          { r: 150, g: 0, b: 0 },
        ],
      },
    },
    ...overrides,
  };
}

describe('validateRom', () => {
  describe('Player Name Validation', () => {
    it('should return no warnings for a valid team', () => {
      const teams = [makeTeam()];
      const warnings = validateRom(teams);
      expect(warnings).toHaveLength(0);
    });

    it('should detect empty player name', () => {
      const teams = [makeTeam({ players: [makePlayer({ name: '' })] })];
      const warnings = validateRom(teams);
      expect(warnings.some((w) => w.type === 'error' && w.message.includes('sem nome'))).toBe(true);
    });

    it('should detect whitespace-only player name', () => {
      const teams = [makeTeam({ players: [makePlayer({ name: '   ' })] })];
      const warnings = validateRom(teams);
      expect(warnings.some((w) => w.type === 'error' && w.message.includes('sem nome'))).toBe(true);
    });

    it('should detect name exceeding 8 characters', () => {
      const teams = [makeTeam({ players: [makePlayer({ name: 'ABCDEFGHI' })] })];
      const warnings = validateRom(teams);
      expect(
        warnings.some((w) => w.type === 'error' && w.message.includes('excede 8 caracteres')),
      ).toBe(true);
    });

    it('should accept name with exactly 8 characters', () => {
      const teams = [makeTeam({ players: [makePlayer({ name: 'ABCDEFGH' })] })];
      const warnings = validateRom(teams);
      expect(warnings.filter((w) => w.message.includes('excede'))).toHaveLength(0);
    });
  });

  describe('Duplicate Numbers', () => {
    it('should detect duplicate player numbers in same team', () => {
      const players = [
        makePlayer({ number: 10, name: 'PLAYER1' }),
        makePlayer({ number: 10, name: 'PLAYER2' }),
      ];
      const teams = [makeTeam({ players })];
      const warnings = validateRom(teams);
      expect(warnings.some((w) => w.type === 'warning' && w.message.includes('duplicado'))).toBe(
        true,
      );
    });

    it('should not flag unique numbers', () => {
      const players = [
        makePlayer({ number: 7, name: 'PLAYER1' }),
        makePlayer({ number: 10, name: 'PLAYER2' }),
      ];
      const teams = [makeTeam({ players })];
      const warnings = validateRom(teams);
      expect(warnings.filter((w) => w.message.includes('duplicado'))).toHaveLength(0);
    });
  });

  describe('Stats Out of Range', () => {
    it('should detect shooting below 1', () => {
      const teams = [makeTeam({ players: [makePlayer({ shooting: 0 })] })];
      const warnings = validateRom(teams);
      expect(warnings.some((w) => w.type === 'error' && w.message.includes('chute invalido'))).toBe(
        true,
      );
    });

    it('should detect shooting above 15', () => {
      const teams = [makeTeam({ players: [makePlayer({ shooting: 16 })] })];
      const warnings = validateRom(teams);
      expect(warnings.some((w) => w.type === 'error' && w.message.includes('chute invalido'))).toBe(
        true,
      );
    });

    it('should accept shooting at boundaries (1 and 15)', () => {
      const players = [makePlayer({ shooting: 1 }), makePlayer({ shooting: 15, number: 2 })];
      const teams = [makeTeam({ players })];
      const warnings = validateRom(teams);
      expect(warnings.filter((w) => w.message.includes('chute'))).toHaveLength(0);
    });

    it('should detect speed below 1', () => {
      const teams = [makeTeam({ players: [makePlayer({ speed: 0 })] })];
      const warnings = validateRom(teams);
      expect(
        warnings.some((w) => w.type === 'error' && w.message.includes('velocidade invalida')),
      ).toBe(true);
    });

    it('should detect speed above 16', () => {
      const teams = [makeTeam({ players: [makePlayer({ speed: 17 })] })];
      const warnings = validateRom(teams);
      expect(
        warnings.some((w) => w.type === 'error' && w.message.includes('velocidade invalida')),
      ).toBe(true);
    });

    it('should accept speed at boundaries (1 and 16)', () => {
      const players = [makePlayer({ speed: 1 }), makePlayer({ speed: 16, number: 2 })];
      const teams = [makeTeam({ players })];
      const warnings = validateRom(teams);
      expect(warnings.filter((w) => w.message.includes('velocidade'))).toHaveLength(0);
    });

    it('should detect stamina below 1', () => {
      const teams = [makeTeam({ players: [makePlayer({ stamina: 0 })] })];
      const warnings = validateRom(teams);
      expect(
        warnings.some((w) => w.type === 'error' && w.message.includes('stamina invalida')),
      ).toBe(true);
    });

    it('should detect stamina above 16', () => {
      const teams = [makeTeam({ players: [makePlayer({ stamina: 17 })] })];
      const warnings = validateRom(teams);
      expect(
        warnings.some((w) => w.type === 'error' && w.message.includes('stamina invalida')),
      ).toBe(true);
    });
  });

  describe('Uniform Color Warnings', () => {
    it('should warn when all home shirt colors are black (0,0,0)', () => {
      const teams = [
        makeTeam({
          uniforms: {
            home: {
              shirt: [
                { r: 0, g: 0, b: 0 },
                { r: 0, g: 0, b: 0 },
                { r: 0, g: 0, b: 0 },
              ],
            },
          },
        }),
      ];
      const warnings = validateRom(teams);
      expect(warnings.some((w) => w.type === 'warning' && w.message.includes('pretas'))).toBe(true);
    });

    it('should not warn when at least one shirt color is not black', () => {
      const teams = [
        makeTeam({
          uniforms: {
            home: {
              shirt: [
                { r: 0, g: 0, b: 0 },
                { r: 255, g: 0, b: 0 },
                { r: 0, g: 0, b: 0 },
              ],
            },
          },
        }),
      ];
      const warnings = validateRom(teams);
      expect(warnings.filter((w) => w.message.includes('pretas'))).toHaveLength(0);
    });

    it('should not crash if uniforms are missing', () => {
      const teams = [makeTeam({ uniforms: undefined })];
      expect(() => validateRom(teams)).not.toThrow();
    });
  });

  describe('Multiple teams', () => {
    it('should report warnings with correct team index and name', () => {
      const teams = [
        makeTeam({ name: 'TeamA' }),
        makeTeam({ name: 'TeamB', players: [makePlayer({ name: '' })] }),
      ];
      const warnings = validateRom(teams);
      const teamBWarning = warnings.find((w) => w.teamName === 'TeamB');
      expect(teamBWarning).toBeDefined();
      expect(teamBWarning.teamIndex).toBe(1);
    });

    it('should accumulate warnings from all teams', () => {
      const teams = [
        makeTeam({ players: [makePlayer({ shooting: 0 })] }),
        makeTeam({ players: [makePlayer({ speed: 0 })] }),
      ];
      const warnings = validateRom(teams);
      expect(warnings.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('getValidationSummary', () => {
  it('should return isValid=true when no errors', () => {
    const warnings = [{ type: 'warning', message: 'minor issue' }];
    const summary = getValidationSummary(warnings);
    expect(summary.isValid).toBe(true);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(1);
    expect(summary.total).toBe(1);
  });

  it('should return isValid=false when errors exist', () => {
    const warnings = [
      { type: 'error', message: 'critical issue' },
      { type: 'warning', message: 'minor issue' },
    ];
    const summary = getValidationSummary(warnings);
    expect(summary.isValid).toBe(false);
    expect(summary.errors).toBe(1);
    expect(summary.warnings).toBe(1);
    expect(summary.total).toBe(2);
  });

  it('should return isValid=true for empty warnings array', () => {
    const summary = getValidationSummary([]);
    expect(summary.isValid).toBe(true);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.total).toBe(0);
  });

  it('should count multiple errors correctly', () => {
    const warnings = [
      { type: 'error', message: 'err1' },
      { type: 'error', message: 'err2' },
      { type: 'error', message: 'err3' },
    ];
    const summary = getValidationSummary(warnings);
    expect(summary.errors).toBe(3);
    expect(summary.isValid).toBe(false);
  });
});
