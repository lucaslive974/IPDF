import { beforeEach, describe, expect, it } from 'vitest';
import { createReaderHighlightsController } from '../../../ui/hooks/useReaderHighlights';
import {
  createEmptyRect,
  createReaderTextSelectionController,
} from '../../../ui/hooks/useReaderTextSelection';
import { useHighlightStore } from '../../../ui/stores/useHighlightStore';
import { MockBackend } from '../../mocks/MockBackend';

describe('useReaderTextSelection / createReaderTextSelectionController', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
    useHighlightStore.getState().reset();
  });

  it('creates an empty rect with default properties', () => {
    const rect = createEmptyRect();
    expect(rect.width).toBe(120);
    expect(rect.height).toBe(20);
    expect(rect.top).toBe(0);
    expect(rect.left).toBe(0);
  });

  it('returns null when selected text is empty or only whitespace', async () => {
    const highlightsController = createReaderHighlightsController(backend);
    const controller = createReaderTextSelectionController({
      bookHash: 'book-hash',
      sampleParagraph: 'Context',
      readerHighlights: highlightsController,
    });

    const result = await controller.createHighlight('#FFEB3B', '   ', 1);
    expect(result).toBeNull();
  });

  it('creates a highlight with anchor and saves to store', async () => {
    const highlightsController = createReaderHighlightsController(backend);
    const controller = createReaderTextSelectionController({
      bookHash: 'book-hash',
      sampleParagraph: 'Surrounding philosophical context.',
      readerHighlights: highlightsController,
    });

    const highlight = await controller.createHighlight(
      '#FFEB3B',
      'Categorical Imperative',
      3,
      'Kant ethics'
    );

    expect(highlight).not.toBeNull();
    expect(highlight?.text).toBe('Categorical Imperative');
    expect(highlight?.anchor.pageNumber).toBe(3);
    expect(highlight?.note).toBe('Kant ethics');
    expect(useHighlightStore.getState().highlights).toHaveLength(1);
  });

  it('creates a highlight with empty note when initialNote is omitted', async () => {
    const highlightsController = createReaderHighlightsController(backend);
    const controller = createReaderTextSelectionController({
      bookHash: 'book-hash',
      sampleParagraph: 'Surrounding philosophical context.',
      readerHighlights: highlightsController,
    });

    const highlight = await controller.createHighlight('#4CAF50', 'Pure text highlight', 2);

    expect(highlight).not.toBeNull();
    expect(highlight?.text).toBe('Pure text highlight');
    expect(highlight?.note).toBe('');
  });
});
