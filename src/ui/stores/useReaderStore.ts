import { create } from 'zustand';
import type { DocumentPage } from '../../core/ports/IReaderService';

export interface StudyDocumentDescriptor {
  readonly bookHash: string;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly chapterTitle: string;
  readonly sampleParagraph: string;
  readonly coverImageUrl?: string;
}

export const DEFAULT_BOOK_HASH = '8c8bf2ed9bff65aaf226bf5db3879eb378a26e72489bd28666abc01c02f2a0c2';

export const DEFAULT_DOCUMENT: StudyDocumentDescriptor = {
  bookHash: DEFAULT_BOOK_HASH,
  bookTitle: 'The Republic',
  bookAuthor: 'Plato',
  chapterTitle: 'Book VII — Allegory of the Cave',
  sampleParagraph:
    'Behold! human beings living in an underground den, which has a mouth open towards the light ' +
    'and reaching all along the den; here they have been from their childhood, and have their legs ' +
    'and necks chained so that they cannot move, and can only see before them, being prevented by ' +
    'the chains from turning round their heads (noesis vs. doxa).',
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
  document: DEFAULT_DOCUMENT,
  currentPage: 1,
  totalPages: 1,
  chapterTitle: DEFAULT_DOCUMENT.chapterTitle,
  loadedPages: [],
  isLoadingPages: false,

  setDocument: (document) =>
    set({
      document,
      chapterTitle: document.chapterTitle,
    }),

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
      document: DEFAULT_DOCUMENT,
      currentPage: 1,
      totalPages: 1,
      chapterTitle: DEFAULT_DOCUMENT.chapterTitle,
      loadedPages: [],
      isLoadingPages: false,
    }),
}));
