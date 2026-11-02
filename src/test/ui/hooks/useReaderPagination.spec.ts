import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EpubViewerAdapter } from '../../../adapters/viewers/EpubViewerAdapter';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { createReaderPaginationController } from '../../../ui/hooks/useReaderPagination';
import { DEFAULT_BOOK_HASH, useReaderStore } from '../../../ui/stores/useReaderStore';
import { MockBackend } from '../../mocks/MockBackend';

describe('useReaderPagination / createReaderPaginationController', () => {
  let backend: MockBackend;
  let viewer: EpubViewerAdapter;

  beforeEach(() => {
    backend = new MockBackend();
    viewer = new EpubViewerAdapter();
    useReaderStore.getState().reset();
  });

  it('bootstraps default book when book is null', async () => {
    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    let loadedHash = '';
    const doc = await controller.bootstrapBook(null, (hash) => {
      loadedHash = hash;
    });

    expect(doc.bookHash).toBe(DEFAULT_BOOK_HASH);
    expect(loadedHash).toBe(DEFAULT_BOOK_HASH);
    expect(useReaderStore.getState().currentPage).toBe(1);
    expect(useReaderStore.getState().totalPages).toBe(1);
  });

  it('bootstraps custom book and loads pages from readerService', async () => {
    const customBook: BookMetadata = {
      bookHash: 'hash-socrates',
      title: 'Republic',
      author: 'Plato',
      format: 'epub',
      totalPages: 300,
      currentPage: 10,
      percentage: 3,
      tags: [],
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(backend, 'getBookPages').mockResolvedValueOnce([
      {
        pageNumber: 10,
        chapterTitle: 'Book VII - Cave Allegory',
        paragraphs: ['Behold! Human beings living in an underground den.'],
        cfiBase: '/6/10!',
      },
    ]);

    const updateProgressSpy = vi.spyOn(backend, 'updateBookProgress');

    const controller = createReaderPaginationController({
      readerService: backend,
      epubViewer: viewer,
    });

    await controller.bootstrapBook(customBook);

    const state = useReaderStore.getState();
    expect(state.document.bookTitle).toBe('Republic');
    expect(state.currentPage).toBe(10);
    expect(state.totalPages).toBe(300);
    expect(state.loadedPages).toHaveLength(1);
    expect(state.chapterTitle).toBe('Book VII - Cave Allegory');
    expect(updateProgressSpy).toHaveBeenCalledWith('hash-socrates', 10, 300);
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
});
