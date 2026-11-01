import { beforeEach, describe, expect, it } from 'vitest';
import { AnnotationWorkbenchService } from '../../../core/services/AnnotationWorkbenchService';
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

describe('AnnotationWorkbenchService (Direct Highlight & Note Management)', () => {
  let backend: MockBackend;
  let service: AnnotationWorkbenchService;

  beforeEach(() => {
    backend = new MockBackend();
    service = new AnnotationWorkbenchService(backend);
  });

  it('should create a highlight, persist via gateway, and merge overlapping selections', async () => {
    const selection = {
      text: 'Phenomenology of Spirit',
      surroundingContext: 'Preface to the Phenomenology of Spirit.',
      anchor: { format: 'epub' as const, pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/2)' },
      clientRect: createEmptyRect(),
    };

    const created = await service.createFromSelection(
      'book_1',
      selection,
      '#FFEB3B',
      'Initial note'
    );
    expect(service.getForPage(1)).toHaveLength(1);

    const merged = await service.createFromSelection(
      'book_1',
      selection,
      '#4CAF50',
      'Updated note'
    );
    expect(merged.id).toBe(created.id);
    expect(merged.color).toBe('#4CAF50');
    expect(merged.note).toBe('Updated note');
    expect(service.getForPage(1)).toHaveLength(1);
  });

  it('should update highlight note directly and persist', async () => {
    const hl = await service.createFromSelection(
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

    const updated = await service.updateHighlightNote(hl.id, 'Thesis Antithesis Synthesis');
    expect(updated.note).toBe('Thesis Antithesis Synthesis');

    const colorUpdated = await service.updateHighlightColor(hl.id, '#0284c7');
    expect(colorUpdated.color).toBe('#0284c7');

    await service.removeHighlight(hl.id);
    expect(service.getForPage(2)).toHaveLength(0);
  });

  it('should reload book highlights from gateway and guard invalid IDs', async () => {
    const hl = await service.createFromSelection('book_reload', {
      text: 'Reloadable',
      surroundingContext: 'Context',
      anchor: { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/4)' },
      clientRect: createEmptyRect(),
    });

    const reloaded = await service.loadBookHighlights('book_reload');
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]?.id).toBe(hl.id);

    await expect(service.updateHighlightNote('missing_id', 'Fail')).rejects.toThrow(
      'Highlight not found'
    );
    await expect(service.updateHighlightColor('missing_id', '#ff0000')).rejects.toThrow(
      'Highlight not found'
    );
  });
});
