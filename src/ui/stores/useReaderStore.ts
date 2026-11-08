import type { BookFormat } from '@domain/types';
import type { DocumentPage } from '@ports/IReaderService';
import { create } from 'zustand';

export interface StudyDocumentDescriptor {
  readonly bookHash: string;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly chapterTitle: string;
  readonly sampleParagraph: string;
  readonly coverImageUrl?: string;
  readonly format?: BookFormat;
}

export const EMPTY_DOCUMENT: StudyDocumentDescriptor = {
  bookHash: '',
  bookTitle: '',
  bookAuthor: '',
  chapterTitle: '',
  sampleParagraph: '',
};

export interface LoadedPagesInfo {
  readonly byPage: ReadonlyMap<number, DocumentPage>;
  readonly minPage: number;
  readonly maxPage: number;
}

export const EMPTY_LOADED_PAGES: LoadedPagesInfo = {
  byPage: new Map(),
  minPage: 0,
  maxPage: 0,
};

export function createLoadedPagesInfo(
  pages: readonly DocumentPage[],
  base?: LoadedPagesInfo
): LoadedPagesInfo {
  if (pages.length === 0) {
    return base ?? EMPTY_LOADED_PAGES;
  }
  const byPage = new Map(base?.byPage);
  const isEmpty = !base || base.byPage.size === 0;
  let minPage = isEmpty ? Number.POSITIVE_INFINITY : base.minPage;
  let maxPage = isEmpty ? Number.NEGATIVE_INFINITY : base.maxPage;

  for (const page of pages) {
    byPage.set(page.pageNumber, page);
    if (page.pageNumber < minPage) minPage = page.pageNumber;
    if (page.pageNumber > maxPage) maxPage = page.pageNumber;
  }

  return {
    byPage,
    minPage: minPage === Number.POSITIVE_INFINITY ? 0 : minPage,
    maxPage: maxPage === Number.NEGATIVE_INFINITY ? 0 : maxPage,
  };
}

export interface ReaderState {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly pageOffsetRatio: number;
  readonly chapterTitle: string;
  readonly loadedPages: LoadedPagesInfo;
  readonly isLoadingPages: boolean;
  readonly isStreamReady: boolean;

  setDocument(doc: StudyDocumentDescriptor): void;
  setCurrentPage(page: number): void;
  setTotalPages(totalPages: number): void;
  setPageOffsetRatio(ratio: number): void;
  setChapterTitle(chapterTitle: string): void;
  setLoadedPages(pages: LoadedPagesInfo): void;
  upsertPages(pages: readonly DocumentPage[]): void;
  setLoadingPages(loading: boolean): void;
  setStreamReady(ready: boolean): void;
  reset(): void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  document: EMPTY_DOCUMENT,
  currentPage: 1,
  totalPages: 1,
  pageOffsetRatio: 0.0,
  chapterTitle: '',
  loadedPages: EMPTY_LOADED_PAGES,
  isLoadingPages: false,
  isStreamReady: false,

  setDocument: (document) =>
    set((state) => ({
      document,
      chapterTitle: document.chapterTitle || state.chapterTitle,
      loadedPages:
        state.document.bookHash === document.bookHash && document.bookHash !== ''
          ? state.loadedPages
          : EMPTY_LOADED_PAGES,
    })),

  setCurrentPage: (currentPage) => set({ currentPage }),

  setTotalPages: (totalPages) => set({ totalPages: Math.max(1, totalPages) }),

  setPageOffsetRatio: (pageOffsetRatio) => set({ pageOffsetRatio }),

  setChapterTitle: (chapterTitle) => set({ chapterTitle }),

  setLoadedPages: (loadedPages) => set({ loadedPages }),

  upsertPages: (newPages) =>
    set((state) => ({
      loadedPages: createLoadedPagesInfo(newPages, state.loadedPages),
    })),

  setLoadingPages: (isLoadingPages) => set({ isLoadingPages }),

  setStreamReady: (isStreamReady) => set({ isStreamReady }),

  reset: () =>
    set({
      document: EMPTY_DOCUMENT,
      currentPage: 1,
      totalPages: 1,
      pageOffsetRatio: 0.0,
      chapterTitle: '',
      loadedPages: EMPTY_LOADED_PAGES,
      isLoadingPages: false,
      isStreamReady: false,
    }),
}));
