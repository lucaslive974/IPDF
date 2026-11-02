import { create } from 'zustand';
import type { BookFormat } from '../../core/domain/types';
import type { DocumentPage } from '../../core/ports/IReaderService';

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
  readonly chapterTitle: string;
  readonly loadedPages: readonly DocumentPage[];
  readonly isLoadingPages: boolean;

  setDocument(doc: StudyDocumentDescriptor): void;
  setCurrentPage(page: number): void;
  setTotalPages(totalPages: number): void;
  setChapterTitle(chapterTitle: string): void;
  setLoadedPages(pages: readonly DocumentPage[]): void;
  upsertPages(pages: readonly DocumentPage[]): void;
  setLoadingPages(loading: boolean): void;
  reset(): void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  document: EMPTY_DOCUMENT,
  currentPage: 1,
  totalPages: 1,
  chapterTitle: '',
  loadedPages: [],
  isLoadingPages: false,

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

  reset: () =>
    set({
      document: EMPTY_DOCUMENT,
      currentPage: 1,
      totalPages: 1,
      chapterTitle: '',
      loadedPages: [],
      isLoadingPages: false,
    }),
}));
