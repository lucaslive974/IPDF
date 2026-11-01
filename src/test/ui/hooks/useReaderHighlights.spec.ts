import { beforeEach, describe, expect, it } from 'vitest';
import { Highlight } from '../../../core/domain/Highlight';
import { createReaderHighlightsController } from '../../../ui/hooks/useReaderHighlights';
import { useHighlightStore } from '../../../ui/stores/useHighlightStore';
import { MockBackend } from '../../mocks/MockBackend';

const createEmptyRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    top: 0,
    right: 100,
    bottom: 20,
    left: 0,
    toJSON: () => ({}),
  }) as DOMRect;

describe('useReaderHighlights controller', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
    useHighlightStore.getState().reset();
  });

  it('loads book highlights from service and populates store', async () => {
    const hl = new Highlight('hl-pre', 'book-alpha', 'Socrates', '#FFEB3B', {
      format: 'epub',
      pageNumber: 1,
      epubCfi: 'epubcfi(/6/2!/4/2)',
    });
    await backend.saveHighlight(hl);

    const controller = createReaderHighlightsController(backend);
    const loaded = await controller.loadBookHighlights('book-alpha');

    expect(loaded).toHaveLength(1);
    expect(controller.highlights).toHaveLength(1);
    expect(useHighlightStore.getState().highlights).toHaveLength(1);
    expect(controller.getHighlightsForPage(1)).toHaveLength(1);
    expect(controller.getHighlightsForPage(2)).toHaveLength(0);
  });

  it('creates new highlight from selection and merges overlapping selections', async () => {
    const controller = createReaderHighlightsController(backend);

    const selection = {
      text: 'Phenomenology of Spirit',
      surroundingContext: 'Preface to the Phenomenology of Spirit.',
      anchor: { format: 'epub' as const, pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/2)' },
      clientRect: createEmptyRect(),
    };

    const created = await controller.createFromSelection(
      'book_1',
      selection,
      '#FFEB3B',
      'Initial note'
    );
    expect(created.text).toBe('Phenomenology of Spirit');
    expect(useHighlightStore.getState().highlights).toHaveLength(1);

    const merged = await controller.createFromSelection(
      'book_1',
      selection,
      '#4CAF50',
      'Updated note'
    );
    expect(merged.id).toBe(created.id);
    expect(merged.color).toBe('#4CAF50');
    expect(merged.note).toBe('Updated note');
    expect(useHighlightStore.getState().highlights).toHaveLength(1);
  });

  it('updates note and color and handles missing IDs', async () => {
    const controller = createReaderHighlightsController(backend);

    const hl = await controller.createFromSelection(
      'book_1',
      {
        text: 'Dialectics',
        surroundingContext: 'Hegelian dialectics.',
        anchor: { format: 'epub', pageNumber: 2, epubCfi: 'epubcfi(/6/4!/4/2)' },
        clientRect: createEmptyRect(),
      },
      '#FFEB3B',
      'Thesis'
    );

    const updatedNote = await controller.updateHighlightNote(hl.id, 'Thesis Antithesis Synthesis');
    expect(updatedNote.note).toBe('Thesis Antithesis Synthesis');

    const updatedColor = await controller.updateHighlightColor(hl.id, '#0284c7');
    expect(updatedColor.color).toBe('#0284c7');

    await expect(controller.updateHighlightNote('missing_id', 'Note')).rejects.toThrow(
      'Highlight not found'
    );
    await expect(controller.updateHighlightColor('missing_id', '#ff0000')).rejects.toThrow(
      'Highlight not found'
    );
  });

  it('deletes highlight from backend and store', async () => {
    const controller = createReaderHighlightsController(backend);

    const hl = await controller.createFromSelection(
      'book_1',
      {
        text: 'To be deleted',
        surroundingContext: 'Context',
        anchor: { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/6!/4/2)' },
        clientRect: createEmptyRect(),
      },
      '#FFEB3B'
    );

    expect(useHighlightStore.getState().highlights).toHaveLength(1);

    await controller.deleteHighlight(hl.id);
    expect(useHighlightStore.getState().highlights).toHaveLength(0);
  });
});
