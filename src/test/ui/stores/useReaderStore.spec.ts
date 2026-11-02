import type { DocumentPage } from '@ports/IReaderService';
import { EMPTY_DOCUMENT, useReaderStore } from '@stores/useReaderStore';
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
    expect(state.loadedPages).toEqual([]);
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

  it('upserts pages deduplicating and maintaining ascending order', () => {
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
    expect(useReaderStore.getState().loadedPages.map((p) => p.pageNumber)).toEqual([1, 3]);

    useReaderStore.getState().upsertPages([page2]);
    expect(useReaderStore.getState().loadedPages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
  });
});
