import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { Highlight } from '../../../core/domain/Highlight';
import {
  type LibraryAnnotationsController,
  createLibraryAnnotationsController,
  formatQuoteForClipboard,
} from '../../../ui/hooks/useLibraryAnnotations';
import { useReaderStore } from '../../../ui/stores/useReaderStore';
import { MockBackend } from '../../mocks/MockBackend';

describe('useLibraryAnnotations Controller', () => {
  let backend: MockBackend;
  let sampleBooks: BookMetadata[];
  let sampleHighlights: Highlight[];

  beforeEach(() => {
    useReaderStore.getState().reset();

    sampleBooks = [
      {
        bookHash: 'book-1',
        title: 'The Republic',
        author: 'Plato',
        format: 'epub',
        currentPage: 1,
        totalPages: 100,
        percentage: 1,
        tags: [],
        lastReadAt: new Date(),
        updatedAt: new Date(),
      },
      {
        bookHash: 'book-2',
        title: 'Meditations',
        author: 'Marcus Aurelius',
        format: 'pdf',
        currentPage: 5,
        totalPages: 200,
        percentage: 2,
        tags: [],
        lastReadAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    sampleHighlights = [
      new Highlight(
        'hl-1',
        'book-1',
        'The unexamined life is not worth living',
        '#FFEB3B',
        { format: 'epub', pageNumber: 7, epubCfi: 'epubcfi(/6/2)' },
        'Key epistemological principle',
        new Date('2026-03-01T10:00:00Z'),
        new Date('2026-03-01T10:00:00Z')
      ),
      new Highlight(
        'hl-2',
        'book-1',
        'Justice in the state is justice in the soul',
        '#4CAF50',
        { format: 'epub', pageNumber: 15, epubCfi: 'epubcfi(/6/4)' },
        '',
        new Date('2026-03-02T10:00:00Z'),
        new Date('2026-03-02T10:00:00Z')
      ),
      new Highlight(
        'hl-3',
        'book-2',
        'You have power over your mind - not outside events',
        '#2196F3',
        { format: 'pdf', pageNumber: 42 },
        'Core Stoic tenet',
        new Date('2026-03-03T10:00:00Z'),
        new Date('2026-03-03T10:00:00Z')
      ),
    ];

    backend = new MockBackend(sampleBooks, sampleHighlights);
  });

  it('loads all highlights from highlight service', async () => {
    const controller = createLibraryAnnotationsController({
      highlightService: backend,
      books: sampleBooks,
    });

    const loaded = await controller.loadHighlights();
    expect(loaded).toHaveLength(3);
    expect(controller.highlights).toHaveLength(3);
  });

  it('groups highlights by book correctly', async () => {
    const controller = createLibraryAnnotationsController({
      highlightService: backend,
      books: sampleBooks,
    });
    await controller.loadHighlights();

    const groups = controller.getGroupedByBook();
    expect(groups).toHaveLength(2);

    const republicGroup = groups.find((g) => g.bookHash === 'book-1');
    expect(republicGroup).toBeDefined();
    expect(republicGroup?.bookTitle).toBe('The Republic');
    expect(republicGroup?.highlights).toHaveLength(2);

    const meditationsGroup = groups.find((g) => g.bookHash === 'book-2');
    expect(meditationsGroup).toBeDefined();
    expect(meditationsGroup?.bookTitle).toBe('Meditations');
    expect(meditationsGroup?.highlights).toHaveLength(1);
  });

  it('filters highlights by search query across quote text, note, and book title', async () => {
    const controller = createLibraryAnnotationsController({
      highlightService: backend,
      books: sampleBooks,
    });
    await controller.loadHighlights();

    // Search by quote text
    controller.setSearchQuery('unexamined');
    let groups = controller.getGroupedByBook();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.highlights[0]?.id).toBe('hl-1');

    // Search by note text
    controller.setSearchQuery('Stoic');
    groups = controller.getGroupedByBook();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.bookTitle).toBe('Meditations');
    expect(groups[0]?.highlights[0]?.id).toBe('hl-3');

    // Search by book title
    controller.setSearchQuery('Republic');
    groups = controller.getGroupedByBook();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.bookHash).toBe('book-1');
    expect(groups[0]?.highlights).toHaveLength(2);
  });

  it('filters highlights by specific book hash', async () => {
    const controller = createLibraryAnnotationsController({
      highlightService: backend,
      books: sampleBooks,
    });
    await controller.loadHighlights();

    controller.setSelectedBookHash('book-2');
    const groups = controller.getGroupedByBook();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.bookHash).toBe('book-2');
  });

  it('filters highlights to show only items with notes', async () => {
    const controller = createLibraryAnnotationsController({
      highlightService: backend,
      books: sampleBooks,
    });
    await controller.loadHighlights();

    controller.setOnlyWithNotes(true);
    const groups = controller.getGroupedByBook();

    // Republic had 2 highlights, but only hl-1 has a note
    const republicGroup = groups.find((g) => g.bookHash === 'book-1');
    expect(republicGroup?.highlights).toHaveLength(1);
    expect(republicGroup?.highlights[0]?.id).toBe('hl-1');

    // Meditations had 1 highlight with a note
    const meditationsGroup = groups.find((g) => g.bookHash === 'book-2');
    expect(meditationsGroup?.highlights).toHaveLength(1);
  });

  it('deletes a highlight from backend and local list', async () => {
    const controller = createLibraryAnnotationsController({
      highlightService: backend,
      books: sampleBooks,
    });
    await controller.loadHighlights();

    await controller.deleteHighlight('hl-1');
    expect(controller.highlights).toHaveLength(2);
    expect(controller.highlights.some((h) => h.id === 'hl-1')).toBe(false);

    // Verify it is also gone from backend
    const backendAll = await backend.loadAllHighlights();
    expect(backendAll.some((h) => h.id === 'hl-1')).toBe(false);
  });

  it('jumps to reader setting reader store and opening book', async () => {
    const openReaderMock = vi.fn();
    const controller = createLibraryAnnotationsController({
      highlightService: backend,
      books: sampleBooks,
      openReader: openReaderMock,
    });
    await controller.loadHighlights();

    const targetHighlight = sampleHighlights[2];
    if (!targetHighlight) throw new Error('Expected highlight at index 2');
    controller.jumpToReader(targetHighlight); // Meditations, page 42

    expect(useReaderStore.getState().currentPage).toBe(42);
    expect(useReaderStore.getState().document.bookTitle).toBe('Meditations');
    expect(openReaderMock).toHaveBeenCalledTimes(1);
    expect(openReaderMock).toHaveBeenCalledWith(sampleBooks[1]);
  });

  it('formats quotes for clipboard with citation and note', () => {
    const firstHighlight = sampleHighlights[0];
    const firstBook = sampleBooks[0];
    if (!firstHighlight || !firstBook) throw new Error('Expected first highlight and book');
    const text = formatQuoteForClipboard(firstHighlight, firstBook);
    expect(text).toContain('The unexamined life is not worth living');
    expect(text).toContain('The Republic');
    expect(text).toContain('Plato');
    expect(text).toContain('p. 7');
    expect(text).toContain('Key epistemological principle');
  });

  it('formats quotes for clipboard when book is unknown and has no note', () => {
    const hlWithoutNote = new Highlight(
      'hl-nonote',
      'unknown-hash',
      'Plain quote text',
      '#FFEB3B',
      { format: 'epub', pageNumber: 1, epubCfi: 'cfi' },
      ''
    );
    const text = formatQuoteForClipboard(hlWithoutNote, undefined);
    expect(text).toBe('"Plain quote text"\n— Unknown Book (p. 1)');
  });
});
