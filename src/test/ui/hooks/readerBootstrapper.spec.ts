import { EpubViewerAdapter } from '@adapters/viewers/EpubViewerAdapter';
import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import {
  bootstrapEpubReaderSession,
  bootstrapPdfReaderSession,
  bootstrapReaderBook,
  calculateInitialPageWindow,
  createStudyDocumentDescriptor,
  resolveDocumentViewer,
} from '@hooks/readerBootstrapper';
import type { IDocumentViewer } from '@ports/IDocumentViewer';
import type { IPdfViewer } from '@ports/IPdfViewer';
import { EMPTY_DOCUMENT, useReaderStore } from '@stores/useReaderStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('readerBootstrapper', () => {
  let backend: MockBackend;
  let viewer: EpubViewerAdapter;

  beforeEach(() => {
    backend = new MockBackend();
    viewer = new EpubViewerAdapter();
    useReaderStore.getState().reset();
  });

  it('bootstraps empty document when book is null', async () => {
    const loadHighlightsSpy = vi.spyOn(backend, 'loadBookHighlights');
    const doc = await bootstrapReaderBook(
      {
        readerService: backend,
        epubViewer: viewer,
        highlightService: backend,
      },
      null
    );

    expect(doc.bookHash).toBe('');
    expect(loadHighlightsSpy).not.toHaveBeenCalled();
    expect(useReaderStore.getState().currentPage).toBe(1);
    expect(useReaderStore.getState().totalPages).toBe(1);
  });

  it('bootstraps custom book and loads pages from readerService', async () => {
    const customBook: BookMetadata = {
      bookHash: 'hash-socrates',
      title: 'Republic',
      author: 'Plato',
      format: BookFormat.EPUB,
      totalPages: 300,
      currentPage: 10,
      percentage: 3,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    const getBookPagesSpy = vi.spyOn(backend, 'getBookPages').mockResolvedValueOnce([
      {
        pageNumber: 8,
        chapterTitle: 'Book VI - Philosophers',
        paragraphs: ['Paragraph from page 8.'],
        cfiBase: '/6/8!',
      },
      {
        pageNumber: 9,
        chapterTitle: 'Book VI - Sun and Line',
        paragraphs: ['Paragraph from page 9.'],
        cfiBase: '/6/9!',
      },
      {
        pageNumber: 10,
        chapterTitle: 'Book VII - Cave Allegory',
        paragraphs: ['Behold! Human beings living in an underground den.'],
        cfiBase: '/6/10!',
      },
      {
        pageNumber: 11,
        chapterTitle: 'Book VII - The Ascent',
        paragraphs: ['Paragraph from page 11.'],
        cfiBase: '/6/11!',
      },
    ]);

    const updatePresenceSpy = vi.spyOn(backend, 'updateReadingPresence');
    const updateProgressSpy = vi.spyOn(backend, 'updateBookProgress');
    const loadHighlightsSpy = vi.spyOn(backend, 'loadBookHighlights');

    await bootstrapReaderBook(
      {
        readerService: backend,
        presenceService: backend,
        epubViewer: viewer,
        highlightService: backend,
      },
      customBook
    );

    expect(loadHighlightsSpy).toHaveBeenCalledWith('hash-socrates');

    // Initial load should fetch backward margin (pages 5..19) with 5, 5, 5 layout
    expect(getBookPagesSpy).toHaveBeenCalledWith('hash-socrates', 5, 15);

    const state = useReaderStore.getState();
    expect(state.document.bookTitle).toBe('Republic');
    expect(state.currentPage).toBe(10);
    expect(state.totalPages).toBe(300);
    expect(state.loadedPages).toHaveLength(4);
    expect(state.loadedPages.map((p) => p.pageNumber)).toEqual([8, 9, 10, 11]);
    expect(state.chapterTitle).toBe('Book VII - Cave Allegory');
    expect(updatePresenceSpy).toHaveBeenCalledWith({
      bookHash: 'hash-socrates',
      bookTitle: 'Republic',
      bookAuthor: 'Plato',
      chapterTitle: 'Book VII - Cave Allegory',
      currentPage: 10,
      totalPages: 300,
    });
    expect(updateProgressSpy).not.toHaveBeenCalled();
    expect(state.isLoadingPages).toBe(false);
  });

  it('bootstraps PDF book and attempts page 1 cover extraction when missing', async () => {
    const pdfBook: BookMetadata = {
      bookHash: 'hash-pdf-book',
      title: 'PDF Document',
      author: 'Author',
      format: BookFormat.PDF,
      totalPages: 50,
      currentPage: 1,
      percentage: 2,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPdfViewer = {
      render: vi.fn().mockResolvedValue(undefined),
      setPages: vi.fn(),
      getPagesChunk: vi.fn().mockReturnValue([]),
      getCurrentPage: vi.fn().mockReturnValue({ pageNumber: 1, totalPages: 50 }),
      getPageProxy: vi.fn().mockResolvedValue(null),
      renderPageCanvas: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
      renderPageTextLayer: vi.fn().mockResolvedValue(undefined),
    };

    const doc = await bootstrapReaderBook(
      {
        readerService: backend,
        libraryService: backend,
        getViewer: () => mockPdfViewer as unknown as IDocumentViewer,
        pdfViewer: mockPdfViewer as unknown as IPdfViewer,
      },
      pdfBook
    );
    expect(doc.bookHash).toBe('hash-pdf-book');
    expect(mockPdfViewer.render).toHaveBeenCalled();
    expect(mockPdfViewer.getPageProxy).toHaveBeenCalledWith(1);
  });

  describe('pure readerBootstrapper helpers', () => {
    it('creates descriptor from book metadata or falls back to empty', () => {
      expect(createStudyDocumentDescriptor(null)).toEqual(EMPTY_DOCUMENT);

      const book: BookMetadata = {
        bookHash: 'book-1',
        title: 'Title',
        author: 'Author',
        currentPage: 5,
        totalPages: 20,
        percentage: 25,
        format: BookFormat.EPUB,
        tags: [],
        lastReadAt: new Date(),
        updatedAt: new Date(),
      };
      const desc = createStudyDocumentDescriptor(book);
      expect(desc.bookHash).toBe('book-1');
      expect(desc.bookTitle).toBe('Title');
      expect(desc.chapterTitle).toBe('Chapter 5 &mdash; Reading Session');
    });

    it('calculates initial page window', () => {
      expect(calculateInitialPageWindow(1, 100)).toEqual({
        startPage: 1,
        count: 10,
      });

      expect(calculateInitialPageWindow(15, 100)).toEqual({
        startPage: 10,
        count: 15,
      });
    });

    it('resolves viewer or throws when missing', () => {
      const epubViewer = new EpubViewerAdapter();
      expect(resolveDocumentViewer({ readerService: backend, epubViewer }, BookFormat.EPUB)).toBe(
        epubViewer
      );

      expect(() => resolveDocumentViewer({ readerService: backend }, BookFormat.EPUB)).toThrow(
        'No document viewer available in dependencies'
      );
    });
  });

  describe('extracted format session bootstrappers', () => {
    it('bootstrapEpubReaderSession populates pages and stream readiness', async () => {
      vi.spyOn(backend, 'getBookPages').mockResolvedValueOnce([
        { pageNumber: 1, chapterTitle: 'Intro', paragraphs: ['P1'], cfiBase: '/6/2!' },
      ]);

      const doc = {
        bookHash: 'epub-hash',
        bookTitle: 'Epub Book',
        bookAuthor: 'Author',
        chapterTitle: 'Ch 1',
        sampleParagraph: 'Sample',
      };

      await bootstrapEpubReaderSession(
        { readerService: backend },
        viewer,
        doc,
        { startPage: 1, count: 5 },
        1,
        {
          bookHash: 'epub-hash',
          title: 'Epub Book',
          author: 'Author',
          format: BookFormat.EPUB,
          totalPages: 10,
          currentPage: 1,
          percentage: 10,
          tags: [],
          lastReadAt: new Date(),
          updatedAt: new Date(),
        }
      );

      expect(useReaderStore.getState().loadedPages).toHaveLength(1);
      expect(useReaderStore.getState().isStreamReady).toBe(true);
      expect(useReaderStore.getState().chapterTitle).toBe('Intro');
    });

    it('bootstrapPdfReaderSession loads chunk from pdfViewer and sets totalPages', async () => {
      const mockPdfViewer = {
        render: vi.fn().mockResolvedValue(undefined),
        setPages: vi.fn(),
        getPagesChunk: vi
          .fn()
          .mockReturnValue([
            { pageNumber: 1, chapterTitle: 'PDF Page 1', paragraphs: ['Text'], cfiBase: '' },
          ]),
        getCurrentPage: vi.fn().mockReturnValue({ pageNumber: 1, totalPages: 40 }),
        getPageProxy: vi.fn().mockResolvedValue(null),
        renderPageCanvas: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
        renderPageTextLayer: vi.fn().mockResolvedValue(undefined),
      };

      const doc = {
        bookHash: 'pdf-hash',
        bookTitle: 'PDF Book',
        bookAuthor: 'Author',
        chapterTitle: 'PDF Page 1',
        sampleParagraph: 'Sample',
      };

      await bootstrapPdfReaderSession(
        {
          readerService: backend,
          pdfViewer: mockPdfViewer as unknown as IPdfViewer,
        },
        mockPdfViewer as unknown as IDocumentViewer,
        doc,
        { startPage: 1, count: 5 },
        1
      );

      expect(useReaderStore.getState().totalPages).toBe(40);
      expect(useReaderStore.getState().loadedPages).toHaveLength(1);
      expect(useReaderStore.getState().chapterTitle).toBe('PDF Page 1');
    });
  });
});
