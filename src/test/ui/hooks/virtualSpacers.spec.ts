import { calculateVirtualSpacers, estimatePageFromScrollTop } from '@hooks/virtualSpacers';
import { describe, expect, it } from 'vitest';

describe('virtualSpacers logic', () => {
  it('returns zeroes for invalid totalPages or defaultPageHeight', () => {
    expect(
      calculateVirtualSpacers({
        firstLoadedPage: 1,
        lastLoadedPage: 10,
        totalPages: 0,
        defaultPageHeight: 1000,
      })
    ).toEqual({
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      totalEstimatedHeight: 0,
    });

    expect(
      calculateVirtualSpacers({
        firstLoadedPage: 1,
        lastLoadedPage: 10,
        totalPages: 100,
        defaultPageHeight: 0,
      })
    ).toEqual({
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      totalEstimatedHeight: 0,
    });
  });

  it('calculates spacers correctly when at the start of the book (page 1 loaded)', () => {
    // Pages 1..10 loaded out of 100 with 1000px height each
    const result = calculateVirtualSpacers({
      firstLoadedPage: 1,
      lastLoadedPage: 10,
      totalPages: 100,
      defaultPageHeight: 1000,
    });

    // Page 1 is first -> topSpacer is 0
    expect(result.topSpacerHeight).toBe(0);
    // Pages 11..100 (90 pages) -> bottomSpacer is 90 * 1000 = 90,000
    expect(result.bottomSpacerHeight).toBe(90000);
    // Total estimated height for 100 pages
    expect(result.totalEstimatedHeight).toBe(100000);
  });

  it('calculates spacers correctly when at the end of the book', () => {
    // Pages 91..100 loaded out of 100
    const result = calculateVirtualSpacers({
      firstLoadedPage: 91,
      lastLoadedPage: 100,
      totalPages: 100,
      defaultPageHeight: 1000,
    });

    // Pages 1..90 (90 pages) -> topSpacer is 90 * 1000 = 90,000
    expect(result.topSpacerHeight).toBe(90000);
    // Last page is 100 -> bottomSpacer is 0
    expect(result.bottomSpacerHeight).toBe(0);
    expect(result.totalEstimatedHeight).toBe(100000);
  });

  it('calculates spacers correctly in the middle of the book', () => {
    // Pages 21..30 loaded out of 50
    const result = calculateVirtualSpacers({
      firstLoadedPage: 21,
      lastLoadedPage: 30,
      totalPages: 50,
      defaultPageHeight: 800,
    });

    // Pages 1..20 (20 pages) -> 20 * 800 = 16,000
    expect(result.topSpacerHeight).toBe(16000);
    // Pages 31..50 (20 pages) -> 20 * 800 = 16,000
    expect(result.bottomSpacerHeight).toBe(16000);
    // 50 * 800 = 40,000
    expect(result.totalEstimatedHeight).toBe(40000);
  });

  describe('estimatePageFromScrollTop', () => {
    it('returns page 1 for zero or negative values', () => {
      expect(estimatePageFromScrollTop(0, 100, 1000)).toBe(1);
      expect(estimatePageFromScrollTop(-500, 100, 1000)).toBe(1);
      expect(estimatePageFromScrollTop(500, 0, 1000)).toBe(1);
      expect(estimatePageFromScrollTop(500, 100, 0)).toBe(1);
    });

    it('estimates page accurately within totalPages bounds', () => {
      // 0..999 -> page 1
      expect(estimatePageFromScrollTop(500, 100, 1000)).toBe(1);
      // 1000..1999 -> page 2
      expect(estimatePageFromScrollTop(1000, 100, 1000)).toBe(2);
      expect(estimatePageFromScrollTop(1500, 100, 1000)).toBe(2);
      // 24,500 -> page 25
      expect(estimatePageFromScrollTop(24500, 100, 1000)).toBe(25);
      // Beyond totalPages -> clamped to 100
      expect(estimatePageFromScrollTop(150000, 100, 1000)).toBe(100);
    });
  });
});
