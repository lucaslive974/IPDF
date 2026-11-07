import {
  type ArticleRect,
  calculatePageOffsetRatio,
  findFocalPageNumber,
  measureCurrentPageOffsetRatio,
} from '@hooks/useReaderFocalPageTracker';
import { describe, expect, it, vi } from 'vitest';

describe('useReaderFocalPageTracker logic', () => {
  it('calculates page offset ratio correctly with clamping', () => {
    // When page is at or below the viewport top
    expect(calculatePageOffsetRatio(0, 1000)).toBe(0.0);
    expect(calculatePageOffsetRatio(50, 1000)).toBe(0.0);

    // Invalid height
    expect(calculatePageOffsetRatio(-100, 0)).toBe(0.0);
    expect(calculatePageOffsetRatio(-100, -500)).toBe(0.0);

    // Partially scrolled inside page
    expect(calculatePageOffsetRatio(-250, 1000)).toBe(0.25);
    expect(calculatePageOffsetRatio(-500, 1000)).toBe(0.5);
    expect(calculatePageOffsetRatio(-750, 1000)).toBe(0.75);

    // Completely scrolled past page
    expect(calculatePageOffsetRatio(-1500, 1000)).toBe(1.0);
  });

  it('calculates negative page offset ratio when allowNegative is enabled', () => {
    // When page top is below the viewport top (e.g. intermediate pages)
    expect(calculatePageOffsetRatio(200, 1000, 0, true)).toBe(-0.2);
    expect(calculatePageOffsetRatio(350, 1000, 0, true)).toBe(-0.35);

    // Extreme negative offset clamped to -1.0
    expect(calculatePageOffsetRatio(2000, 1000, 0, true)).toBe(-1.0);

    // When allowNegative is false (e.g. page 1), remains clamped to 0.0
    expect(calculatePageOffsetRatio(200, 1000, 0, false)).toBe(0.0);
  });

  it('returns null when articles list is empty', () => {
    expect(findFocalPageNumber([], 350)).toBeNull();
  });

  it('identifies page directly intersecting the focal line', () => {
    const articles: ArticleRect[] = [
      { pageNumber: 1, top: -200, bottom: 200 },
      { pageNumber: 2, top: 200, bottom: 600 },
      { pageNumber: 3, top: 600, bottom: 1000 },
    ];

    // Focal line is at 350px -> inside page 2 (200..600)
    expect(findFocalPageNumber(articles, 350)).toBe(2);

    // Focal line is at 100px -> inside page 1 (-200..200)
    expect(findFocalPageNumber(articles, 100)).toBe(1);

    // Focal line is at 750px -> inside page 3 (600..1000)
    expect(findFocalPageNumber(articles, 750)).toBe(3);
  });

  it('selects closest page when focal line falls between gaps', () => {
    const articles: ArticleRect[] = [
      { pageNumber: 1, top: 0, bottom: 200 },
      // Gap between 200 and 300
      { pageNumber: 2, top: 300, bottom: 500 },
    ];

    // At 290px, page 2 top (300) is only 10px away vs page 1 top (0) 290px away
    expect(findFocalPageNumber(articles, 290)).toBe(2);
  });

  it('measures current page offset ratio on demand from DOM', () => {
    expect(measureCurrentPageOffsetRatio(0)).toBe(0.0);

    const mockElement = {
      getBoundingClientRect: () => ({
        top: -250,
        height: 1000,
      }),
    } as unknown as HTMLElement;

    const originalDocument = globalThis.document;
    globalThis.document = {
      querySelector: vi.fn((selector: string) =>
        selector === 'article[data-page-number="3"]' ? mockElement : null
      ),
    } as unknown as Document;

    try {
      expect(measureCurrentPageOffsetRatio(3)).toBe(0.25);
      expect(measureCurrentPageOffsetRatio(99)).toBe(0.0);
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
