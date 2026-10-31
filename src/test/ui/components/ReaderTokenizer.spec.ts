import { describe, expect, it } from 'vitest';
import { Highlight } from '../../../core/domain/Highlight';
import {
  findHighlightMatchesInParagraph,
  tokenizeTextWithHighlights,
} from '../../../ui/components/reader/ReaderPageParagraphs';
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

  it('matches highlight text containing newlines (\\n) against space-separated paragraph', () => {
    const mockHighlight = new Highlight('hl-nl', 'book-1', 'world\ntoday', '#4CAF50', {
      format: 'epub',
      pageNumber: 1,
      epubCfi: 'epubcfi(/6/4)',
    });

    const matches = findHighlightMatchesInParagraph(
      'Hello world today and tomorrow',
      'world\ntoday'
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.start).toBe(6);
    expect(matches[0]?.end).toBe(17);

    const chunks = tokenizeTextWithHighlights('Hello world today and tomorrow', [mockHighlight]);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ text: 'Hello ' });
    expect(chunks[1]).toEqual({ text: 'world today', highlight: mockHighlight });
    expect(chunks[2]).toEqual({ text: ' and tomorrow' });
  });

  it('matches multiline highlight segments across separate paragraphs', () => {
    const crossParagraphHl = new Highlight(
      'hl-cross',
      'book-1',
      'ends here.\n\nSecond paragraph begins',
      '#2196F3',
      {
        format: 'epub',
        pageNumber: 1,
        epubCfi: 'epubcfi(/6/6)',
      }
    );

    const para1 = 'First paragraph ends here.';
    const para2 = 'Second paragraph begins with this.';

    const chunks1 = tokenizeTextWithHighlights(para1, [crossParagraphHl]);
    expect(chunks1).toHaveLength(2);
    expect(chunks1[0]).toEqual({ text: 'First paragraph ' });
    expect(chunks1[1]).toEqual({ text: 'ends here.', highlight: crossParagraphHl });

    const chunks2 = tokenizeTextWithHighlights(para2, [crossParagraphHl]);
    expect(chunks2).toHaveLength(2);
    expect(chunks2[0]).toEqual({ text: 'Second paragraph begins', highlight: crossParagraphHl });
    expect(chunks2[1]).toEqual({ text: ' with this.' });
  });

  it('provides default highlight color options', () => {
    expect(DEFAULT_HIGHLIGHT_COLORS.length).toBeGreaterThan(0);
    expect(DEFAULT_HIGHLIGHT_COLORS[0]?.value).toBe('#FFEB3B');
  });
});
