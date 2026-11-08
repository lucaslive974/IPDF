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

export interface ReaderState {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly pageOffsetRatio: number;
  readonly chapterTitle: string;
  readonly loadedPages: readonly DocumentPage[];
  readonly isLoadingPages: boolean;
  readonly isStreamReady: boolean;

  setDocument(doc: StudyDocumentDescriptor): void;
  setCurrentPage(page: number): void;
  setTotalPages(totalPages: number): void;
  setPageOffsetRatio(ratio: number): void;
  setChapterTitle(chapterTitle: string): void;
  setLoadedPages(pages: readonly DocumentPage[]): void;
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
  loadedPages: [],
  isLoadingPages: false,
  isStreamReady: false,

  setDocument: (document) =>
    set((state) => ({
      document,
      chapterTitle: document.chapterTitle || state.chapterTitle,
      loadedPages:
        state.document.bookHash === document.bookHash && document.bookHash !== ''
          ? state.loadedPages
          : [],
    })),

  setCurrentPage: (currentPage) => set({ currentPage }),

  setTotalPages: (totalPages) => set({ totalPages: Math.max(1, totalPages) }),

  setPageOffsetRatio: (pageOffsetRatio) => set({ pageOffsetRatio }),

  setChapterTitle: (chapterTitle) => set({ chapterTitle }),

  setLoadedPages: (loadedPages) => set({ loadedPages }),

  upsertPages: (newPages) =>
    set((state) => {
      const pageMap = new Map<number, DocumentPage>();
      for (const p of state.loadedPages) {
        pageMap.set(p.pageNumber, p);
      }
      for (const p of newPages) {
        pageMap.set(p.pageNumber, p);
      }
      const sorted = Array.from(pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
      return { loadedPages: sorted };
    }),

  setLoadingPages: (isLoadingPages) => set({ isLoadingPages }),

  setStreamReady: (isStreamReady) => set({ isStreamReady }),

  reset: () =>
    set({
      document: EMPTY_DOCUMENT,
      currentPage: 1,
      totalPages: 1,
      pageOffsetRatio: 0.0,
      chapterTitle: '',
      loadedPages: [],
      isLoadingPages: false,
      isStreamReady: false,
    }),
}));
