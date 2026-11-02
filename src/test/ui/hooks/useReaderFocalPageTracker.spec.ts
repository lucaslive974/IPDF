import { describe, expect, it } from 'vitest';
import { type ArticleRect, findFocalPageNumber } from '../../../ui/hooks/useReaderFocalPageTracker';

describe('useReaderFocalPageTracker logic', () => {
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
});
