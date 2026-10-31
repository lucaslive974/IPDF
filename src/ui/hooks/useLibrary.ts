import { useCallback, useEffect } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { BookFormat } from '../../core/domain/types';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import { useLibraryStore } from '../stores/useLibraryStore';

export interface LibraryViewModel {
  readonly books: readonly BookMetadata[];
  readonly isLoading: boolean;
  loadBooks(): Promise<BookMetadata[]>;
  importBookFile(file: File): Promise<BookMetadata>;
  importSampleBook(): Promise<void>;
  updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number
  ): Promise<BookMetadata>;
  renameBook(bookHash: string, newTitle: string): Promise<BookMetadata>;
}

// Keep type alias for backwards compatibility
export type LibraryContextValue = LibraryViewModel;

export function useLibrary(): LibraryViewModel {
  const { services } = useServiceContainer();
  const books = useLibraryStore((s) => s.books);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const setBooks = useLibraryStore((s) => s.setBooks);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const upsertBook = useLibraryStore((s) => s.upsertBook);

  const loadBooks = useCallback(async (): Promise<BookMetadata[]> => {
    setLoading(true);
    try {
      const result = await services.listLibraryBooks();
      setBooks(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, [services, setBooks, setLoading]);

  const importBookFile = useCallback(
    async (file: File): Promise<BookMetadata> => {
      setLoading(true);
      try {
        const buffer = await file.arrayBuffer();
        const rawBytes = new Uint8Array(buffer);
        const extension = file.name.split('.').pop()?.toLowerCase();
        const format: BookFormat = extension === 'pdf' ? 'pdf' : 'epub';
        const cleanTitle =
          file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled Document';

        const book = await services.importLibraryBook({
          rawBytes,
          title: cleanTitle,
          author: '',
          format,
          totalPages: 0,
        });
        upsertBook(book);
        return book;
      } finally {
        setLoading(false);
      }
    },
    [services, setLoading, upsertBook]
  );

  const importSampleBook = useCallback(async (): Promise<void> => {
    await loadBooks();
  }, [loadBooks]);

  const updateBookProgress = useCallback(
    async (bookHash: string, currentPage: number, totalPages: number): Promise<BookMetadata> => {
      const updated = await services.updateBookProgress(bookHash, currentPage, totalPages);
      upsertBook(updated);
      return updated;
    },
    [services, upsertBook]
  );

  const renameBook = useCallback(
    async (bookHash: string, newTitle: string): Promise<BookMetadata> => {
      setLoading(true);
      try {
        const updated = await services.renameBook(bookHash, newTitle);
        upsertBook(updated);
        return updated;
      } finally {
        setLoading(false);
      }
    },
    [services, setLoading, upsertBook]
  );

  useEffect(() => {
    if (books.length === 0) {
      void loadBooks();
    }
  }, [books.length, loadBooks]);

  return {
    books,
    isLoading,
    loadBooks,
    importBookFile,
    importSampleBook,
    updateBookProgress,
    renameBook,
  };
}
