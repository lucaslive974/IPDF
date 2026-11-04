import { EpubViewerAdapter } from '@adapters/viewers/EpubViewerAdapter';
import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import {
  calculateInitialPageWindow,
  createStudyDocumentDescriptor,
  resolveDocumentViewer,
} from '@hooks/readerBootstrapper';
import {
  calculateNextPageWindow,
  calculatePrevPageWindow,
  calculateTargetPageWindow,
  clampPageNumber,
  createReaderPaginationController,
  determinePrefetchDirection,
} from '@hooks/useReaderPagination';
import type { IDocumentViewer } from '@ports/IDocumentViewer';
import type { IPdfViewer } from '@ports/IPdfViewer';
import type { DocumentPage } from '@ports/IReaderService';
import { EMPTY_DOCUMENT, useReaderStore } from '@stores/useReaderStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('useReaderPagination / createReaderPaginationController', () => {
  let backend: MockBackend;
  let viewer: EpubViewerAdapter;

  beforeEach(() => {
    backend = new MockBackend();
    viewer = new EpubViewerAdapter();
    useReaderStore.getState().reset();
  });

  it('bootstraps empty document when book is null', async () => {
    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    let loadedHash = 'initial';
    const doc = await controller.bootstrapBook(null, (hash) => {
      loadedHash = hash;
    });

    expect(doc.bookHash).toBe('');
    expect(loadedHash).toBe('initial');
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

    const updateProgressSpy = vi.spyOn(backend, 'updateBookProgress');

    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    await controller.bootstrapBook(customBook);

    // Initial load should fetch backward margin (pages 1..29) with 10, 10, 10 layout
    expect(getBookPagesSpy).toHaveBeenCalledWith('hash-socrates', 1, 29);

    const state = useReaderStore.getState();
    expect(state.document.bookTitle).toBe('Republic');
    expect(state.currentPage).toBe(10);
    expect(state.totalPages).toBe(300);
    expect(state.loadedPages).toHaveLength(4);
    expect(state.loadedPages.map((p) => p.pageNumber)).toEqual([8, 9, 10, 11]);
    expect(state.chapterTitle).toBe('Book VII - Cave Allegory');
    expect(updateProgressSpy).toHaveBeenCalledWith('hash-socrates', 10, 300, 0);
    expect(state.isLoadingPages).toBe(false);
  });

  it('loads more pages forward and backward', async () => {
    vi.spyOn(backend, 'getBookPages').mockImplementation(async (_hash, startPage) => {
      return [
        {
          pageNumber: startPage,
          chapterTitle: `Chapter ${startPage}`,
          paragraphs: [`Paragraph ${startPage}`],
          cfiBase: `/6/${startPage}!`,
        },
      ];
    });

    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    useReaderStore.getState().setDocument({
      bookHash: 'book-1',
      bookTitle: 'Test',
      bookAuthor: 'Author',
      chapterTitle: 'C2',
      sampleParagraph: 'Sample',
    });
    useReaderStore.getState().setTotalPages(10);
    useReaderStore
      .getState()
      .setLoadedPages([
        { pageNumber: 2, chapterTitle: 'C2', paragraphs: ['P2'], cfiBase: '/6/4!' },
      ]);

    // Load next
    await controller.loadMorePages('next');
    expect(useReaderStore.getState().loadedPages.some((p) => p.pageNumber === 3)).toBe(true);

    // Load prev
    await controller.loadMorePages('prev');
    expect(useReaderStore.getState().loadedPages.some((p) => p.pageNumber === 1)).toBe(true);
  });

  it('updates page and chapter when onPageVisible is called', () => {
    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    useReaderStore.getState().setLoadedPages([
      { pageNumber: 1, chapterTitle: 'Intro', paragraphs: ['Intro text'], cfiBase: '/6/2!' },
      { pageNumber: 5, chapterTitle: 'Chapter 5', paragraphs: ['Text 5'], cfiBase: '/6/10!' },
    ]);

    controller.onPageVisible(5);

    expect(useReaderStore.getState().currentPage).toBe(5);
    expect(useReaderStore.getState().chapterTitle).toBe('Chapter 5');
  });

  it('proactively triggers prefetch for next pages when within 7 pages of loaded upper boundary', async () => {
    const getBookPagesSpy = vi
      .spyOn(backend, 'getBookPages')
      .mockResolvedValue([
        { pageNumber: 31, chapterTitle: 'Ch 31', paragraphs: ['P31'], cfiBase: '/6/31!' },
      ]);

    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    useReaderStore.getState().setDocument({
      bookHash: 'book-hash-1',
      bookTitle: 'Test Book',
      bookAuthor: 'Author',
      chapterTitle: 'Initial',
      sampleParagraph: 'Sample',
    });
    useReaderStore.getState().setTotalPages(50);
    // Loaded pages: 10 to 30 (upper boundary = 30)
    useReaderStore.getState().setLoadedPages(
      Array.from({ length: 21 }, (_, i) => ({
        pageNumber: 10 + i,
        chapterTitle: `Ch ${10 + i}`,
        paragraphs: [`P${10 + i}`],
        cfiBase: `/6/${10 + i}!`,
      }))
    );
    useReaderStore.getState().setCurrentPage(15);

    // Page 20 is distance 10 from boundary 30 (> 7) -> should NOT trigger next prefetch
    controller.onPageVisible(20);
    expect(getBookPagesSpy).not.toHaveBeenCalled();

    // Page 23 is distance 7 from boundary 30 (30 - 23 = 7 <= 7) -> triggers next prefetch in 10-page chunk
    controller.onPageVisible(23);
    expect(getBookPagesSpy).toHaveBeenCalledWith('book-hash-1', 31, 10);
  });

  it('proactively triggers prefetch for prev pages when within 7 pages of loaded lower boundary', async () => {
    const getBookPagesSpy = vi
      .spyOn(backend, 'getBookPages')
      .mockResolvedValue([
        { pageNumber: 10, chapterTitle: 'Ch 10', paragraphs: ['P10'], cfiBase: '/6/10!' },
      ]);

    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    useReaderStore.getState().setDocument({
      bookHash: 'book-hash-1',
      bookTitle: 'Test Book',
      bookAuthor: 'Author',
      chapterTitle: 'Initial',
      sampleParagraph: 'Sample',
    });
    useReaderStore.getState().setTotalPages(50);
    // Loaded pages: 20 to 40 (lower boundary = 20)
    useReaderStore.getState().setLoadedPages(
      Array.from({ length: 21 }, (_, i) => ({
        pageNumber: 20 + i,
        chapterTitle: `Ch ${20 + i}`,
        paragraphs: [`P${20 + i}`],
        cfiBase: `/6/${20 + i}!`,
      }))
    );
    useReaderStore.getState().setCurrentPage(35);

    // Page 30 is distance 10 from lower boundary 20 (30 - 20 = 10 > 7) -> should NOT trigger prev prefetch
    controller.onPageVisible(30);
    expect(getBookPagesSpy).not.toHaveBeenCalled();

    // Page 27 is distance 7 from lower boundary 20 (27 - 20 = 7 <= 7) -> triggers prev prefetch
    controller.onPageVisible(27);
    expect(getBookPagesSpy).toHaveBeenCalledWith('book-hash-1', 10, 10);
  });

  it('navigates and goes to page clamping boundaries and notifying listener', async () => {
    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    useReaderStore.getState().setTotalPages(20);
    useReaderStore.getState().setCurrentPage(5);

    let changedPage = 0;
    await controller.navigatePage(3, (p) => {
      changedPage = p;
    });

    expect(useReaderStore.getState().currentPage).toBe(8);
    expect(changedPage).toBe(8);

    await controller.goToPage(100);
    expect(useReaderStore.getState().currentPage).toBe(20);

    await controller.goToPage(-5);
    expect(useReaderStore.getState().currentPage).toBe(1);
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

    const controller = createReaderPaginationController({
      readerService: backend,
      libraryService: backend,
      getViewer: () => mockPdfViewer as unknown as IDocumentViewer,
      pdfViewer: mockPdfViewer as unknown as IPdfViewer,
    });

    const doc = await controller.bootstrapBook(pdfBook);
    expect(doc.bookHash).toBe('hash-pdf-book');
    expect(mockPdfViewer.render).toHaveBeenCalled();
    expect(mockPdfViewer.getPageProxy).toHaveBeenCalledWith(1);
  });

  describe('pure pagination math functions', () => {
    it('clamps page number within totalPages bounds', () => {
      expect(clampPageNumber(0, 100)).toBe(1);
      expect(clampPageNumber(-5, 100)).toBe(1);
      expect(clampPageNumber(50, 100)).toBe(50);
      expect(clampPageNumber(105, 100)).toBe(100);
    });

    it('calculates next page window accurately', () => {
      const pages = [{ pageNumber: 10 }, { pageNumber: 11 }];

      // Regular next window
      expect(calculateNextPageWindow(pages, 50, 10)).toEqual({
        startPage: 12,
        count: 10,
      });

      // Window bounded by totalPages
      expect(calculateNextPageWindow(pages, 15, 10)).toEqual({
        startPage: 12,
        count: 4, // 12, 13, 14, 15
      });

      // Already at or past totalPages
      expect(calculateNextPageWindow(pages, 11, 10)).toBeNull();
      expect(calculateNextPageWindow(pages, 10, 10)).toBeNull();
    });

    it('calculates prev page window accurately', () => {
      const pages = [{ pageNumber: 15 }, { pageNumber: 16 }];

      // Regular prev window
      expect(calculatePrevPageWindow(pages, 10)).toEqual({
        startPage: 5,
        count: 10,
      });

      // Close to page 1
      const earlyPages = [{ pageNumber: 4 }];
      expect(calculatePrevPageWindow(earlyPages, 10)).toEqual({
        startPage: 1,
        count: 3,
      });

      // Already at page 1
      const firstPage = [{ pageNumber: 1 }];
      expect(calculatePrevPageWindow(firstPage, 10)).toBeNull();
    });

    it('calculates target page window with backward margin', () => {
      // Middle of book
      expect(calculateTargetPageWindow(25, 100)).toEqual({
        startPage: 15,
        count: 30,
      });

      // Near start
      expect(calculateTargetPageWindow(5, 100)).toEqual({
        startPage: 1,
        count: 24,
      });

      // Near end
      expect(calculateTargetPageWindow(95, 100)).toEqual({
        startPage: 85,
        count: 16,
      });
    });

    it('determines prefetch direction based on reading boundaries', () => {
      const loaded = [{ pageNumber: 10 }, { pageNumber: 30 }];

      // Not near boundaries (within 7): 20 - 10 = 10 > 7, 30 - 20 = 10 > 7
      expect(determinePrefetchDirection(20, 19, loaded, 50)).toBeNull();

      // Near end (30 - 25 <= 7) -> 'next'
      expect(determinePrefetchDirection(25, 24, loaded, 50)).toBe('next');

      // Near start (15 - 10 <= 7) -> 'prev'
      expect(determinePrefetchDirection(15, 16, loaded, 50)).toBe('prev');

      // Near both ends: prioritize scroll direction
      const shortRange = [{ pageNumber: 10 }, { pageNumber: 14 }];
      // Moving down (page 12 > previous 11) -> 'next'
      expect(determinePrefetchDirection(12, 11, shortRange, 50)).toBe('next');
      // Moving up (page 11 < previous 12) -> 'prev'
      expect(determinePrefetchDirection(11, 12, shortRange, 50)).toBe('prev');

      // Empty loaded pages
      expect(determinePrefetchDirection(1, 1, [], 50)).toBeNull();
    });
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
        count: 20,
      });

      expect(calculateInitialPageWindow(15, 100)).toEqual({
        startPage: 5,
        count: 30,
      });
    });

    it('resolves viewer or throws when missing', () => {
      const viewer = new EpubViewerAdapter();
      expect(
        resolveDocumentViewer({ readerService: backend, epubViewer: viewer }, BookFormat.EPUB)
      ).toBe(viewer);

      expect(() => resolveDocumentViewer({ readerService: backend }, BookFormat.EPUB)).toThrow(
        'No document viewer available in dependencies'
      );
    });
  });
});
