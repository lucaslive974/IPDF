import { isImmersiveBackgroundClick, shouldSaveProgress } from '@hooks/useReaderView';
import { describe, expect, it } from 'vitest';

describe('useReaderView pure logic', () => {
  describe('shouldSaveProgress', () => {
    it('returns false when bookHash is missing', () => {
      expect(shouldSaveProgress(null, { bookHash: '', currentPage: 1, totalPages: 10 })).toBe(
        false
      );
    });

    it('returns true when there is no previously saved state', () => {
      expect(
        shouldSaveProgress(null, {
          bookHash: 'book-hash-1',
          currentPage: 1,
          totalPages: 10,
        })
      ).toBe(true);
    });

    it('returns false when current state is identical to last saved state', () => {
      const state = { bookHash: 'book-hash-1', currentPage: 5, totalPages: 20 };
      expect(shouldSaveProgress(state, state)).toBe(false);
    });

    it('returns true when current page or total pages changes', () => {
      const lastSaved = {
        bookHash: 'book-hash-1',
        currentPage: 5,
        totalPages: 20,
      };

      expect(
        shouldSaveProgress(lastSaved, {
          bookHash: 'book-hash-1',
          currentPage: 6,
          totalPages: 20,
        })
      ).toBe(true);

      expect(
        shouldSaveProgress(lastSaved, {
          bookHash: 'book-hash-1',
          currentPage: 5,
          totalPages: 25,
        })
      ).toBe(true);
    });

    it('returns true when book hash changes', () => {
      const lastSaved = {
        bookHash: 'book-hash-1',
        currentPage: 5,
        totalPages: 20,
      };
      expect(
        shouldSaveProgress(lastSaved, {
          bookHash: 'book-hash-2',
          currentPage: 5,
          totalPages: 20,
        })
      ).toBe(true);
    });

    it('returns true when pageOffsetRatio changes meaningfully', () => {
      const lastSaved = {
        bookHash: 'book-hash-1',
        currentPage: 5,
        totalPages: 20,
        pageOffsetRatio: 0.1,
      };

      // Negligible change (< 0.005)
      expect(
        shouldSaveProgress(lastSaved, {
          bookHash: 'book-hash-1',
          currentPage: 5,
          totalPages: 20,
          pageOffsetRatio: 0.102,
        })
      ).toBe(false);

      // Meaningful change (>= 0.005)
      expect(
        shouldSaveProgress(lastSaved, {
          bookHash: 'book-hash-1',
          currentPage: 5,
          totalPages: 20,
          pageOffsetRatio: 0.25,
        })
      ).toBe(true);

      // Negative offset ratio support
      const negativeSaved = {
        bookHash: 'book-hash-1',
        currentPage: 5,
        totalPages: 20,
        pageOffsetRatio: -0.25,
      };

      expect(
        shouldSaveProgress(negativeSaved, {
          bookHash: 'book-hash-1',
          currentPage: 5,
          totalPages: 20,
          pageOffsetRatio: -0.252,
        })
      ).toBe(false);

      expect(
        shouldSaveProgress(negativeSaved, {
          bookHash: 'book-hash-1',
          currentPage: 5,
          totalPages: 20,
          pageOffsetRatio: -0.1,
        })
      ).toBe(true);
    });
  });

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
