import { describe, it, expect } from 'vitest';
import { generateTeamNameData } from '../TeamNameGenerator';

describe('TeamNameGenerator', () => {
  it('should generate valid data for simple text', () => {
    const data = generateTeamNameData('BRAZIL');
    expect(data.length).toBeGreaterThan(0);
    // First byte is count
    const count = data[0];
    expect(count).toBeGreaterThan(0);
    // Total size should be 1 + count * 4
    expect(data.length).toBe(1 + count * 4);
  });

  it('should handle text with dot', () => {
    const data = generateTeamNameData('S.KOREA');
    expect(data[0]).toBeGreaterThan(0);
  });

  it('should handle text with spaces', () => {
    const data = generateTeamNameData('U S A');
    expect(data[0]).toBeGreaterThan(0);
  });

  it('should produce valid part types (0xF1 or 0xF9)', () => {
    const data = generateTeamNameData('ABC');
    const count = data[0];
    for (let i = 0; i < count; i++) {
      const type = data[1 + i * 4];
      expect(type === 0xf1 || type === 0xf9).toBe(true);
    }
  });

  it('should handle empty text gracefully', () => {
    const data = generateTeamNameData('');
    expect(data[0]).toBe(0); // zero parts
  });

  it('should sanitize invalid characters', () => {
    const data = generateTeamNameData('BR@Z!L');
    expect(data[0]).toBeGreaterThan(0);
    // Should still generate something (invalid chars become spaces/ignored)
  });

  it('should generate centered positions (mix of negative and positive)', () => {
    const data = generateTeamNameData('ABCDEF');
    const count = data[0];
    let hasNegative = false;
    let hasPositive = false;
    for (let i = 0; i < count; i++) {
      const pos = data[1 + i * 4 + 1];
      const signed = pos > 127 ? pos - 256 : pos;
      if (signed < 0) hasNegative = true;
      if (signed > 0) hasPositive = true;
    }
    expect(hasNegative).toBe(true);
    expect(hasPositive).toBe(true);
  });
});
