import { clamp } from '@utils/math';
import { describe, expect, it } from 'vitest';

describe('math utilities', () => {
  describe('clamp', () => {
    it('returns value when within [min, max]', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('clamps to min when value is lower than min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(-1.5, -1.0, 1.0)).toBe(-1.0);
    });

    it('clamps to max when value is higher than max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(1.5, -1.0, 1.0)).toBe(1.0);
    });
  });
});
