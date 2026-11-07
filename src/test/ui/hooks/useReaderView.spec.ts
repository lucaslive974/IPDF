import { calculateScrollTargetTop, isImmersiveBackgroundClick } from '@hooks/useReaderView';
import { describe, expect, it } from 'vitest';

describe('useReaderView pure logic', () => {
  describe('isImmersiveBackgroundClick', () => {
    it('returns false if overlays are open', () => {
      expect(isImmersiveBackgroundClick(null, false, true)).toBe(false);
    });

    it('returns false if user has active text selection', () => {
      expect(isImmersiveBackgroundClick(null, true, false)).toBe(false);
    });

    it('returns true for neutral clicks with no selection and no overlays', () => {
      expect(isImmersiveBackgroundClick(null, false, false)).toBe(true);
    });

    it('returns false when target is an interactive button or input', () => {
      const mockButtonTarget = {
        closest: (selector: string) => (selector.includes('button') ? {} : null),
      } as HTMLElement;

      expect(isImmersiveBackgroundClick(mockButtonTarget, false, false)).toBe(false);
    });
  });

  describe('calculateScrollTargetTop', () => {
    it('calculates target top when element is below viewport and offsetRatio is 0', () => {
      const targetTop = calculateScrollTargetTop(600, 1000, 200, 0);
      expect(targetTop).toBe(800);
    });

    it('calculates target top with positive offsetRatio inside the element', () => {
      const targetTop = calculateScrollTargetTop(400, 800, 100, 0.25);
      expect(targetTop).toBe(700);
    });

    it('calculates target top with negative offsetRatio down from viewport top', () => {
      // Element top is 500px, height is 1000px, scrollY is 100px, offsetRatio is -0.3
      // 100 + 500 + 1000 * (-0.3) = 600 - 300 = 300
      const targetTop = calculateScrollTargetTop(500, 1000, 100, -0.3);
      expect(targetTop).toBe(300);
    });

    it('clamps extreme negative offsetRatio to -1.0', () => {
      // Clamped to -1.0: 100 + 500 + 1000 * (-1.0) = 600 - 1000 = -400 -> clamped to 0
      const targetTop = calculateScrollTargetTop(500, 1000, 100, -1.5);
      expect(targetTop).toBe(0);
    });

    it('clamps total calculated target top to 0 when element rect produces negative coordinate', () => {
      const targetTop = calculateScrollTargetTop(-1000, 500, 100, 0.1);
      expect(targetTop).toBe(0);
    });

    it('uses default offsetRatio 0.0 if omitted', () => {
      const targetTop = calculateScrollTargetTop(300, 500, 50);
      expect(targetTop).toBe(350);
    });
  });
});
