import { buildStreamPages } from '@components/reader/ReaderStream';
import { BookFormat } from '@domain/types';
import {
  type ArticleRect,
  calculateNextPageWindow,
  calculatePageOffsetRatio,
  calculatePrevPageWindow,
  calculateScrollTargetTop,
  collectVisibleArticleRects,
  createReaderPaginationController,
  detectFocalPageAndOffset,
  determinePrefetchDirection,
  findFocalPageNumber,
  useReaderPagination,
} from '@hooks/useReaderPagination';
import type { IPdfViewer } from '@ports/IPdfViewer';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import { useReaderStore } from '@stores/useReaderStore';
import { clamp } from '@utils/math';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('useReaderPagination / createReaderPaginationController', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
    useReaderStore.getState().reset();
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

  it('loads pages from pdfViewer when book format is PDF', async () => {
    const mockPdfViewer = {
      getPagesChunk: vi.fn((startPage: number, count: number) => [
        {
          pageNumber: startPage,
          chapterTitle: `PDF Page ${startPage}`,
          paragraphs: [`Text ${startPage}`],
          cfiBase: `/pdf/${startPage}`,
        },
      ]),
    } as unknown as IPdfViewer;

    const controller = createReaderPaginationController({
      readerService: backend,
      pdfViewer: mockPdfViewer,
    });

    useReaderStore.getState().setDocument({
      bookHash: 'pdf-book-1',
      bookTitle: 'PDF Title',
      bookAuthor: 'PDF Author',
      chapterTitle: 'PDF Chapter',
      sampleParagraph: 'PDF Sample',
      format: BookFormat.PDF,
    });
    useReaderStore.getState().setTotalPages(20);
    useReaderStore
      .getState()
      .setLoadedPages([
        { pageNumber: 5, chapterTitle: 'PDF Page 5', paragraphs: ['Text 5'], cfiBase: '/pdf/5' },
      ]);

    await controller.loadMorePages('next');

    expect(mockPdfViewer.getPagesChunk).toHaveBeenCalledWith(6, 10);
    expect(useReaderStore.getState().loadedPages.some((p) => p.pageNumber === 6)).toBe(true);
  });

  it('updates page, chapter, and reading presence without touching SQLite when onPageVisible is called', () => {
    const updatePresenceSpy = vi.spyOn(backend, 'updateReadingPresence');
    const updateProgressSpy = vi.spyOn(backend, 'updateBookProgress');
    const controller = createReaderPaginationController({
      readerService: backend,
      presenceService: backend,
    });

    useReaderStore.getState().setLoadedPages([
      { pageNumber: 1, chapterTitle: 'Intro', paragraphs: ['Intro text'], cfiBase: '/6/2!' },
      { pageNumber: 5, chapterTitle: 'Chapter 5', paragraphs: ['Text 5'], cfiBase: '/6/10!' },
    ]);

    controller.onPageVisible(5);

    expect(useReaderStore.getState().currentPage).toBe(5);
    expect(useReaderStore.getState().chapterTitle).toBe('Chapter 5');
    expect(updatePresenceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPage: 5,
        chapterTitle: 'Chapter 5',
      })
    );
    expect(updateProgressSpy).not.toHaveBeenCalled();
  });

  it('proactively triggers prefetch for next pages when within 7 pages of loaded upper boundary', async () => {
    const getBookPagesSpy = vi
      .spyOn(backend, 'getBookPages')
      .mockResolvedValue([
        { pageNumber: 31, chapterTitle: 'Ch 31', paragraphs: ['P31'], cfiBase: '/6/31!' },
      ]);

    const controller = createReaderPaginationController({
      readerService: backend,
    });

    useReaderStore.getState().setDocument({
      bookHash: 'book-hash-1',
      bookTitle: 'Test Book',
      bookAuthor: 'Test Author',
      chapterTitle: 'Chapter 1',
      sampleParagraph: 'Sample',
    });
    useReaderStore.getState().setTotalPages(50);
    useReaderStore.getState().setLoadedPages(
      Array.from({ length: 11 }, (_, i) => ({
        pageNumber: 20 + i, // 20 to 30 loaded
        chapterTitle: `Chapter ${20 + i}`,
        paragraphs: [`P${20 + i}`],
        cfiBase: `/6/${20 + i}!`,
      }))
    );
    useReaderStore.getState().setCurrentPage(20);

    // Page 21 is distance 9 from upper boundary 30 (30 - 21 = 9 > 7) -> should NOT trigger next prefetch
    controller.onPageVisible(21);
    expect(getBookPagesSpy).not.toHaveBeenCalled();

    // Page 23 is distance 7 from upper boundary 30 (30 - 23 = 7 <= 7) -> triggers next prefetch
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
    });

    useReaderStore.getState().setDocument({
      bookHash: 'book-hash-1',
      bookTitle: 'Test Book',
      bookAuthor: 'Test Author',
      chapterTitle: 'Chapter 1',
      sampleParagraph: 'Sample',
    });
    useReaderStore.getState().setTotalPages(50);
    useReaderStore.getState().setLoadedPages(
      Array.from({ length: 11 }, (_, i) => ({
        pageNumber: 20 + i, // 20 to 30 loaded
        chapterTitle: `Chapter ${20 + i}`,
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
    });

    useReaderStore.getState().setTotalPages(20);
    useReaderStore.getState().setCurrentPage(5);

    let changedPage = 0;
    await controller.navigatePage(3, {
      onPageChanged: (p) => {
        changedPage = p;
      },
    });

    expect(useReaderStore.getState().currentPage).toBe(8);
    expect(changedPage).toBe(8);

    await controller.goToPage(100);
    expect(useReaderStore.getState().currentPage).toBe(20);

    await controller.goToPage(-5);
    expect(useReaderStore.getState().currentPage).toBe(1);
  });

  describe('pure pagination math functions', () => {
    it('clamps page number within totalPages bounds using custom clamp', () => {
      expect(clamp(0, 1, 100)).toBe(1);
      expect(clamp(-5, 1, 100)).toBe(1);
      expect(clamp(50, 1, 100)).toBe(50);
      expect(clamp(105, 1, 100)).toBe(100);
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

    it('determines prefetch direction based on reading boundaries', () => {
      const loaded = [{ pageNumber: 10 }, { pageNumber: 30 }];

      // Not near boundaries (within 7): 20 - 10 = 10 > 7, 30 - 20 = 10 > 7
      expect(determinePrefetchDirection(20, 19, loaded, 50)).toBeNull();

      // Near end (30 - 25 <= 7) -> 'next'
      expect(determinePrefetchDirection(25, 24, loaded, 50)).toBe('next');

      // Near start (15 - 10 <= 7) -> 'prev' when moving backward
      expect(determinePrefetchDirection(15, 16, loaded, 50)).toBe('prev');

      // Moving forward while near start (15 > 14) -> does NOT trigger 'prev'
      expect(determinePrefetchDirection(15, 14, loaded, 50)).toBeNull();

      // Stationary (currentPage === previousPage) -> returns null
      expect(determinePrefetchDirection(15, 15, loaded, 50)).toBeNull();

      // Near both ends: prioritize scroll direction
      const shortRange = [{ pageNumber: 10 }, { pageNumber: 14 }];
      // Moving down (page 12 > previous 11) -> 'next'
      expect(determinePrefetchDirection(12, 11, shortRange, 50)).toBe('next');
      // Moving up (page 11 < previous 12) -> 'prev'
      expect(determinePrefetchDirection(11, 12, shortRange, 50)).toBe('prev');

      // Empty loaded pages
      expect(determinePrefetchDirection(1, 1, [], 50)).toBeNull();
    });

    it('builds full stream pages list merging loaded content with empty placeholders', () => {
      const loaded = [
        { pageNumber: 2, chapterTitle: 'Ch 2', paragraphs: ['P2'], cfiBase: '/6/4!' },
      ];
      const stream = buildStreamPages(4, loaded);
      expect(stream).toHaveLength(4);
      expect(stream.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4]);
      expect(stream[0]?.paragraphs).toEqual([]);
      expect(stream[1]?.paragraphs).toEqual(['P2']);
      expect(stream[2]?.paragraphs).toEqual([]);
    });

    it('fetches target page window when onPageVisible lands on an unloaded page', async () => {
      const getBookPagesSpy = vi
        .spyOn(backend, 'getBookPages')
        .mockResolvedValue([
          { pageNumber: 40, chapterTitle: 'Ch 40', paragraphs: ['P40'], cfiBase: '/6/40!' },
        ]);

      const controller = createReaderPaginationController({
        readerService: backend,
      });

      useReaderStore.getState().setDocument({
        bookHash: 'book-scrub',
        bookTitle: 'Scrub Book',
        bookAuthor: 'Author',
        chapterTitle: 'Ch 1',
        sampleParagraph: 'Sample',
      });
      useReaderStore.getState().setTotalPages(100);
      useReaderStore
        .getState()
        .setLoadedPages([
          { pageNumber: 1, chapterTitle: 'Ch 1', paragraphs: ['P1'], cfiBase: '/6/1!' },
        ]);

      controller.onPageVisible(40, 0.15);

      expect(useReaderStore.getState().currentPage).toBe(40);
      expect(useReaderStore.getState().pageOffsetRatio).toBe(0.15);
      expect(getBookPagesSpy).toHaveBeenCalledWith('book-scrub', 35, 15);
    });

    it('calculates page offset ratio correctly with clamping', () => {
      expect(calculatePageOffsetRatio(0, 1000)).toBe(0.0);
      expect(calculatePageOffsetRatio(50, 1000)).toBe(0.0);
      expect(calculatePageOffsetRatio(-100, 0)).toBe(0.0);
      expect(calculatePageOffsetRatio(-100, -500)).toBe(0.0);
      expect(calculatePageOffsetRatio(-250, 1000)).toBe(0.25);
      expect(calculatePageOffsetRatio(-500, 1000)).toBe(0.5);
      expect(calculatePageOffsetRatio(-750, 1000)).toBe(0.75);
      expect(calculatePageOffsetRatio(-1500, 1000)).toBe(1.0);
    });

    it('calculates negative page offset ratio when allowNegative is enabled', () => {
      expect(calculatePageOffsetRatio(200, 1000, 0, true)).toBe(-0.2);
      expect(calculatePageOffsetRatio(350, 1000, 0, true)).toBe(-0.35);
      expect(calculatePageOffsetRatio(2000, 1000, 0, true)).toBe(-1.0);
      expect(calculatePageOffsetRatio(200, 1000, 0, false)).toBe(0.0);
    });

    it('calculates target scroll top accurately for positive and negative offset ratios', () => {
      expect(calculateScrollTargetTop(600, 1000, 200, 0)).toBe(800);
      expect(calculateScrollTargetTop(400, 800, 100, 0.25)).toBe(700);
      expect(calculateScrollTargetTop(500, 1000, 100, -0.3)).toBe(300);
      expect(calculateScrollTargetTop(500, 1000, 100, -1.5)).toBe(0);
      expect(calculateScrollTargetTop(-1000, 500, 100, 0.1)).toBe(0);
      expect(calculateScrollTargetTop(300, 500, 50)).toBe(350);
    });

    it('identifies focal page with strict boundary prioritizing incoming page', () => {
      expect(findFocalPageNumber([], 350)).toBeNull();

      const articles: ArticleRect[] = [
        { pageNumber: 1, top: -200, bottom: 200 },
        { pageNumber: 2, top: 200, bottom: 600 },
        { pageNumber: 3, top: 600, bottom: 1000 },
      ];

      expect(findFocalPageNumber(articles, 350)).toBe(2);
      expect(findFocalPageNumber(articles, 100)).toBe(1);
      expect(findFocalPageNumber(articles, 750)).toBe(3);
      expect(findFocalPageNumber(articles, 200)).toBe(2);
    });

    it('selects closest page when focal line falls between gaps', () => {
      const articles: ArticleRect[] = [
        { pageNumber: 1, top: 0, bottom: 200 },
        { pageNumber: 2, top: 300, bottom: 500 },
      ];
      expect(findFocalPageNumber(articles, 290)).toBe(2);
    });

    it('collects visible article rects and detects focal page and offset from DOM', () => {
      const mockElement = {
        getAttribute: vi.fn((attr: string) => (attr === 'data-page-number' ? '4' : null)),
        getBoundingClientRect: () => ({
          top: -200,
          bottom: 800,
          height: 1000,
        }),
      } as unknown as HTMLElement;

      const originalDocument = globalThis.document;
      const originalWindow = globalThis.window;

      globalThis.document = {
        querySelectorAll: vi.fn((selector: string) =>
          selector === 'article[data-page-number]' ? [mockElement] : []
        ),
        querySelector: vi.fn((selector: string) =>
          selector === 'article[data-page-number="4"]' ? mockElement : null
        ),
      } as unknown as Document;

      globalThis.window = {
        innerHeight: 1000,
      } as unknown as Window & typeof globalThis;

      try {
        const rects = collectVisibleArticleRects();
        expect(rects).toHaveLength(1);
        expect(rects[0]?.pageNumber).toBe(4);

        const detected = detectFocalPageAndOffset(350);
        expect(detected).not.toBeNull();
        expect(detected?.pageNumber).toBe(4);
        expect(detected?.offsetRatio).toBe(0.2);
      } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
      }
    });
  });

  describe('useReaderPagination hook', () => {
    it('instantiates pagination controller via ServiceContainerContext', () => {
      let captured: ReturnType<typeof useReaderPagination> | null = null;

      function Consumer() {
        captured = useReaderPagination();
        return null;
      }

      renderToStaticMarkup(
        React.createElement(
          ServiceContainerProvider,
          {
            readerService: backend,
            libraryService: backend,
            highlightService: backend,
            presenceService: backend,
          },
          React.createElement(Consumer)
        )
      );

      expect(captured).not.toBeNull();
      const controller = captured as unknown as ReturnType<typeof useReaderPagination>;
      expect(typeof controller.goToPage).toBe('function');
      expect(typeof controller.onPageVisible).toBe('function');
      expect(typeof controller.loadMorePages).toBe('function');
    });

    it('manages scroll lock state internally without globals', () => {
      vi.useFakeTimers();
      const controller = createReaderPaginationController({
        readerService: backend,
      });

      expect(controller.isLocked()).toBe(false);

      controller.lockScroll(300);
      expect(controller.isLocked()).toBe(true);

      vi.advanceTimersByTime(299);
      expect(controller.isLocked()).toBe(true);

      vi.advanceTimersByTime(2);
      expect(controller.isLocked()).toBe(false);

      controller.lockScroll(500);
      controller.unlockScroll();
      expect(controller.isLocked()).toBe(false);

      vi.useRealTimers();
    });

    it('updates offsetRatio in store when onPageVisible is called with offset', () => {
      const controller = createReaderPaginationController({
        readerService: backend,
      });

      useReaderStore
        .getState()
        .setLoadedPages([
          { pageNumber: 5, chapterTitle: 'Ch 5', paragraphs: ['P5'], cfiBase: '/6/10!' },
        ]);

      controller.onPageVisible(5, 0.35);

      expect(useReaderStore.getState().currentPage).toBe(5);
      expect(useReaderStore.getState().pageOffsetRatio).toBe(0.35);
    });

    it('navigates with goToPage applying target page and offset ratio', async () => {
      const controller = createReaderPaginationController({
        readerService: backend,
      });

      useReaderStore.getState().setTotalPages(50);
      useReaderStore
        .getState()
        .setLoadedPages([
          { pageNumber: 10, chapterTitle: 'Ch 10', paragraphs: ['P10'], cfiBase: '/6/20!' },
        ]);

      await controller.goToPage(10, { offsetRatio: 0.25 });

      expect(useReaderStore.getState().currentPage).toBe(10);
      expect(useReaderStore.getState().pageOffsetRatio).toBe(0.25);
    });

    it('restoreInitialScroll scrolls to top 0 when targetPage is 1 with no offset', () => {
      const originalWindow = globalThis.window;
      const scrollToSpy = vi.fn();
      globalThis.window = {
        scrollTo: scrollToSpy,
      } as unknown as Window & typeof globalThis;

      try {
        const controller = createReaderPaginationController({
          readerService: backend,
        });

        useReaderStore.getState().setCurrentPage(1);
        useReaderStore.getState().setPageOffsetRatio(0);

        controller.restoreInitialScroll();

        expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
        expect(controller.isLocked()).toBe(false);
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('restoreInitialScroll calculates scroll position and locks scroll when page article is present', () => {
      const originalDocument = globalThis.document;
      const originalWindow = globalThis.window;
      const scrollToSpy = vi.fn();

      const mockArticle = {
        getBoundingClientRect: () => ({
          top: 300,
          height: 800,
          bottom: 1100,
          left: 0,
          right: 800,
          width: 800,
          x: 0,
          y: 300,
          toJSON: () => ({}),
        }),
      } as unknown as HTMLElement;

      globalThis.document = {
        querySelector: vi.fn((selector: string) => {
          if (selector === 'article[data-page-number="5"]') {
            return mockArticle;
          }
          return null;
        }),
      } as unknown as Document;

      globalThis.window = {
        scrollTo: scrollToSpy,
        scrollY: 100,
      } as unknown as Window & typeof globalThis;

      try {
        const controller = createReaderPaginationController({
          readerService: backend,
        });

        useReaderStore.getState().setCurrentPage(5);
        useReaderStore.getState().setPageOffsetRatio(0.2);

        controller.restoreInitialScroll();

        expect(controller.isLocked()).toBe(true);
        expect(scrollToSpy).toHaveBeenCalledWith({
          top: 100 + 300 + 800 * 0.2, // 560
          behavior: 'instant',
        });
      } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
      }
    });

    it('restoreInitialScroll retries on requestAnimationFrame if element is initially missing', () => {
      const originalDocument = globalThis.document;
      const originalWindow = globalThis.window;
      const scrollToSpy = vi.fn();
      let rafCallback: FrameRequestCallback | null = null;
      let found = false;

      const mockArticle = {
        getBoundingClientRect: () => ({
          top: 400,
          height: 600,
          bottom: 1000,
          left: 0,
          right: 800,
          width: 800,
          x: 0,
          y: 400,
          toJSON: () => ({}),
        }),
      } as unknown as HTMLElement;

      globalThis.document = {
        querySelector: vi.fn((selector: string) => {
          if (selector === 'article[data-page-number="8"]' && found) {
            return mockArticle;
          }
          return null;
        }),
      } as unknown as Document;

      globalThis.window = {
        scrollTo: scrollToSpy,
        scrollY: 0,
        requestAnimationFrame: (cb: FrameRequestCallback) => {
          rafCallback = cb;
          return 1;
        },
      } as unknown as Window & typeof globalThis;

      try {
        const controller = createReaderPaginationController({
          readerService: backend,
        });

        useReaderStore.getState().setCurrentPage(8);
        useReaderStore.getState().setPageOffsetRatio(0.1);

        controller.restoreInitialScroll();
        expect(scrollToSpy).not.toHaveBeenCalled();

        // Trigger the rAF retry
        found = true;
        if (rafCallback) {
          (rafCallback as (time: number) => void)(16);
        }

        expect(scrollToSpy).toHaveBeenCalledWith({
          top: 400 + 600 * 0.1, // 460
          behavior: 'instant',
        });
      } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
      }
    });
  });
});
