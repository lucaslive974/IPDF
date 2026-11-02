import type { BookMetadata } from '@domain/BookMetadata';
import { create } from 'zustand';

export interface LibraryState {
  readonly books: readonly BookMetadata[];
  readonly isLoading: boolean;

  setBooks(books: readonly BookMetadata[]): void;
  setLoading(isLoading: boolean): void;
  upsertBook(book: BookMetadata): void;
  renameBook(bookHash: string, newTitle: string): void;
  removeBook(bookHash: string): void;
  reset(): void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  books: [],
  isLoading: false,

  setBooks: (books) => set({ books }),

  setLoading: (isLoading) => set({ isLoading }),

  upsertBook: (book) =>
    set((state) => {
      const exists = state.books.some((b) => b.bookHash === book.bookHash);
      if (exists) {
        return {
          books: state.books.map((b) => (b.bookHash === book.bookHash ? book : b)),
        };
      }
      return { books: [book, ...state.books] };
    }),

  renameBook: (bookHash, newTitle) =>
    set((state) => ({
      books: state.books.map((b) =>
        b.bookHash === bookHash ? { ...b, title: newTitle, updatedAt: new Date() } : b
      ),
    })),

  removeBook: (bookHash) =>
    set((state) => ({
      books: state.books.filter((b) => b.bookHash !== bookHash),
    })),

  reset: () => set({ books: [], isLoading: false }),
}));
