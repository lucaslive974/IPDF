import { EpubViewerAdapter } from '@adapters/viewers/EpubViewerAdapter';
import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import { createReaderPaginationController } from '@hooks/useReaderPagination';
import type { IDocumentViewer } from '@ports/IDocumentViewer';
import type { IPdfViewer } from '@ports/IPdfViewer';
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

    // Initial load should fetch backward margin (pages 8..14)
    expect(getBookPagesSpy).toHaveBeenCalledWith('hash-socrates', 8, 7);

    const state = useReaderStore.getState();
    expect(state.document.bookTitle).toBe('Republic');
    expect(state.currentPage).toBe(10);
    expect(state.totalPages).toBe(300);
    expect(state.loadedPages).toHaveLength(4);
    expect(state.loadedPages.map((p) => p.pageNumber)).toEqual([8, 9, 10, 11]);
    expect(state.chapterTitle).toBe('Book VII - Cave Allegory');
    expect(updateProgressSpy).toHaveBeenCalledWith('hash-socrates', 10, 300);
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
      ensurePagesExtracted: vi.fn().mockResolvedValue([]),
      renderPageCanvas: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
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
});
