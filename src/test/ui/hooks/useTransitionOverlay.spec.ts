import {
  DEFAULT_TRANSITION_DURATION_MS,
  computeRemainingDelay,
  computeTransitionStyle,
} from '@hooks/useTransitionOverlay';
import { describe, expect, it } from 'vitest';

describe('useTransitionOverlay helpers', () => {
  describe('computeRemainingDelay', () => {
    it('returns 0 when minDisplayMs is 0 or negative', () => {
      expect(computeRemainingDelay(1000, 0, 1050)).toBe(0);
      expect(computeRemainingDelay(1000, -100, 1050)).toBe(0);
    });

    it('returns 0 when mountedAt is not initialized', () => {
      expect(computeRemainingDelay(0, 200, 1050)).toBe(0);
    });

    it('calculates remaining time accurately', () => {
      // Mounted at 1000, min 300, now 1100 -> elapsed 100 -> remaining 200
      expect(computeRemainingDelay(1000, 300, 1100)).toBe(200);

      // Elapsed matches or exceeds minDisplayMs -> 0
      expect(computeRemainingDelay(1000, 300, 1300)).toBe(0);
      expect(computeRemainingDelay(1000, 300, 1500)).toBe(0);
    });
  });

  describe('computeTransitionStyle', () => {
    it('generates 60fps GPU accelerated style when mounted', () => {
      const style = computeTransitionStyle(1, 250, true);
      expect(style.opacity).toBe(1);
      expect(style.transition).toBe('opacity 250ms cubic-bezier(0.16, 1, 0.3, 1)');
      expect(style.willChange).toBe('opacity');
      expect(style.pointerEvents).toBe('auto');
    });

    it('sets pointerEvents to none and willChange to auto when unmounted', () => {
      const style = computeTransitionStyle(0, 300, false);
      expect(style.opacity).toBe(0);
      expect(style.willChange).toBe('auto');
      expect(style.pointerEvents).toBe('none');
    });

    it('uses default duration constant when specified', () => {
      const style = computeTransitionStyle(1, DEFAULT_TRANSITION_DURATION_MS, true);
      expect(style.transition).toContain('300ms');
    });
  });
});
