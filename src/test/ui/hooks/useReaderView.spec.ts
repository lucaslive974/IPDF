import { isImmersiveBackgroundClick } from '@hooks/useReaderView';
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
});
