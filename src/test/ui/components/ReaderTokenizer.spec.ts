import { describe, expect, it } from 'vitest';
import { Highlight } from '../../../core/domain/Highlight';
import { tokenizeTextWithHighlights } from '../../../ui/components/reader/ReaderPageParagraphs';
import { DEFAULT_HIGHLIGHT_COLORS } from '../../../ui/components/ui/ColorPicker';

describe('ReaderTokenizer & UI Constants', () => {
  it('returns whole paragraph when no highlights exist', () => {
    const chunks = tokenizeTextWithHighlights('Hello world', []);
    expect(chunks).toEqual([{ text: 'Hello world' }]);
  });

  it('tokenizes paragraph with inline highlight matches', () => {
    const mockHighlight = new Highlight('hl-1', 'book-1', 'world', '#FFEB3B', {
      format: 'epub',
      pageNumber: 1,
      epubCfi: 'epubcfi(/6/2)',
    });

    const chunks = tokenizeTextWithHighlights('Hello world today', [mockHighlight]);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ text: 'Hello ' });
    expect(chunks[1]).toEqual({ text: 'world', highlight: mockHighlight });
    expect(chunks[2]).toEqual({ text: ' today' });
  });

  it('provides default highlight color options', () => {
    expect(DEFAULT_HIGHLIGHT_COLORS.length).toBeGreaterThan(0);
    expect(DEFAULT_HIGHLIGHT_COLORS[0]?.value).toBe('#FFEB3B');
  });
});
