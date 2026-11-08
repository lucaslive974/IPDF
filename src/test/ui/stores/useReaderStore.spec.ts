import type { DocumentPage } from '@ports/IReaderService';
import {
  EMPTY_DOCUMENT,
  EMPTY_LOADED_PAGES,
  createLoadedPagesInfo,
  useReaderStore,
} from '@stores/useReaderStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('useReaderStore', () => {
  beforeEach(() => {
    useReaderStore.getState().reset();
  });

  it('initializes with empty document and page 1', () => {
    const state = useReaderStore.getState();
    expect(state.document).toEqual(EMPTY_DOCUMENT);
    expect(state.currentPage).toBe(1);
    expect(state.totalPages).toBe(1);
    expect(state.pageOffsetRatio).toBe(0.0);
    expect(state.loadedPages).toEqual(EMPTY_LOADED_PAGES);
  });

  it('sets document and synchronizes chapterTitle', () => {
    useReaderStore.getState().setDocument({
      bookHash: 'hash-custom',
      bookTitle: 'Custom Book',
      bookAuthor: 'Custom Author',
      chapterTitle: 'Custom Chapter',
      sampleParagraph: 'Sample',
    });

    const state = useReaderStore.getState();
    expect(state.document.bookTitle).toBe('Custom Book');
    expect(state.chapterTitle).toBe('Custom Chapter');
  });

  it('updates page numbers and clamps totalPages to at least 1', () => {
    useReaderStore.getState().setCurrentPage(42);
    useReaderStore.getState().setTotalPages(120);

    expect(useReaderStore.getState().currentPage).toBe(42);
    expect(useReaderStore.getState().totalPages).toBe(120);

    useReaderStore.getState().setTotalPages(0);
    expect(useReaderStore.getState().totalPages).toBe(1);
  });

  it('upserts pages deduplicating and maintaining min/max and byPage map', () => {
    const page3: DocumentPage = {
      pageNumber: 3,
      chapterTitle: 'Ch 3',
      paragraphs: ['Para 3'],
      cfiBase: '/6/6[ch3]!',
    };
    const page1: DocumentPage = {
      pageNumber: 1,
      chapterTitle: 'Ch 1',
      paragraphs: ['Para 1'],
      cfiBase: '/6/2[ch1]!',
    };
    const page2: DocumentPage = {
      pageNumber: 2,
      chapterTitle: 'Ch 2',
      paragraphs: ['Para 2'],
      cfiBase: '/6/4[ch2]!',
    };

    useReaderStore.getState().upsertPages([page3, page1]);
    const state1 = useReaderStore.getState().loadedPages;
    expect(Array.from(state1.byPage.keys())).toEqual([3, 1]);
    expect(state1.minPage).toBe(1);
    expect(state1.maxPage).toBe(3);

    useReaderStore.getState().upsertPages([page2]);
    const state2 = useReaderStore.getState().loadedPages;
    expect(state2.byPage.size).toBe(3);
    expect(state2.byPage.get(1)).toEqual(page1);
    expect(state2.byPage.get(2)).toEqual(page2);
    expect(state2.byPage.get(3)).toEqual(page3);
    expect(state2.minPage).toBe(1);
    expect(state2.maxPage).toBe(3);
  });

  it('createLoadedPagesInfo handles empty array and correctly tracks boundaries', () => {
    expect(createLoadedPagesInfo([])).toEqual(EMPTY_LOADED_PAGES);

    const info = createLoadedPagesInfo([
      { pageNumber: 5, chapterTitle: 'Ch 5', paragraphs: [], cfiBase: '' },
      { pageNumber: 2, chapterTitle: 'Ch 2', paragraphs: [], cfiBase: '' },
    ]);
    expect(info.minPage).toBe(2);
    expect(info.maxPage).toBe(5);
    expect(info.byPage.size).toBe(2);

    // Merging with existing base
    const merged = createLoadedPagesInfo(
      [{ pageNumber: 8, chapterTitle: 'Ch 8', paragraphs: [], cfiBase: '' }],
      info
    );
    expect(merged.minPage).toBe(2);
    expect(merged.maxPage).toBe(8);
    expect(merged.byPage.size).toBe(3);

    // Empty array with base preserves base
    expect(createLoadedPagesInfo([], merged)).toBe(merged);
  });

  it('updates and resets pageOffsetRatio and isStreamReady', () => {
    useReaderStore.getState().setPageOffsetRatio(0.42);
    useReaderStore.getState().setStreamReady(true);
    expect(useReaderStore.getState().pageOffsetRatio).toBe(0.42);
    expect(useReaderStore.getState().isStreamReady).toBe(true);

    useReaderStore.getState().reset();
    expect(useReaderStore.getState().pageOffsetRatio).toBe(0.0);
    expect(useReaderStore.getState().isStreamReady).toBe(false);
  });
});
