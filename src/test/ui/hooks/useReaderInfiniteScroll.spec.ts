import { calculateScrollOffsetCompensation } from '@hooks/useReaderInfiniteScroll';
import { describe, expect, it } from 'vitest';

describe('useReaderInfiniteScroll logic', () => {
  it('calculates scroll offset compensation for newly prepended pages', () => {
    // When previous pages are added, content grows from 1000 to 1600
    const diff = calculateScrollOffsetCompensation(1000, 1600);
    expect(diff).toBe(600);
  });

  it('returns 0 if content size did not change or shrank', () => {
    expect(calculateScrollOffsetCompensation(1000, 1000)).toBe(0);
    expect(calculateScrollOffsetCompensation(1200, 1000)).toBe(0);
  });
});
