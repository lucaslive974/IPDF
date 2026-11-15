import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import type { UpdateBookMetadataInput } from '@ports/ILibraryService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useCallback, useMemo } from 'react';

export interface LibraryViewModel {
  readonly books: readonly BookMetadata[];
  readonly isLoading: boolean;
  loadBooks(): Promise<BookMetadata[]>;
  importBookFile(file: File): Promise<BookMetadata>;
  pickAndImportBook(): Promise<BookMetadata | null>;
  importSampleBook(): Promise<void>;
  updateBookProgress(
    bookHash: string,
    currentPage: number,
    totalPages: number,
    pageOffsetRatio?: number
  ): Promise<BookMetadata>;
  renameBook(bookHash: string, newTitle: string): Promise<BookMetadata>;
  updateBookMetadata(bookHash: string, input: UpdateBookMetadataInput): Promise<BookMetadata>;
  deleteBook(bookHash: string): Promise<boolean>;
}

// Keep type alias for backwards compatibility
export type LibraryContextValue = LibraryViewModel;

export function useLibrary(): LibraryViewModel {
  const { libraryService, readerService } = useServiceContainer();
  const books = useLibraryStore((s) => s.books);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const setBooks = useLibraryStore((s) => s.setBooks);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const upsertBook = useLibraryStore((s) => s.upsertBook);
  const removeBook = useLibraryStore((s) => s.removeBook);

  const loadBooks = useCallback(async (): Promise<BookMetadata[]> => {
    setLoading(true);
    try {
      const result = await libraryService.listLibraryBooks();
      setBooks(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, [libraryService, setBooks, setLoading]);

  const importBookFile = useCallback(
    async (file: File): Promise<BookMetadata> => {
      setLoading(true);
      try {
        const filePath = (file as unknown as { path?: string }).path;
        if (filePath && filePath.trim().length > 0) {
          const book = await libraryService.importBookFromPath(filePath);
          upsertBook(book);
          return book;
        }

        const buffer = await file.arrayBuffer();
        const rawBytes = new Uint8Array(buffer);
        const extension = file.name.split('.').pop()?.toLowerCase();
        const format: BookFormat = extension === 'pdf' ? BookFormat.PDF : BookFormat.EPUB;
        const cleanTitle =
          file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled Document';

        const book = await libraryService.importBookFromBytes({
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
    [libraryService, setLoading, upsertBook]
  );

  const pickAndImportBook = useCallback(async (): Promise<BookMetadata | null> => {
    if (!libraryService.pickAndImportBook) return null;
    setLoading(true);
    try {
      const book = await libraryService.pickAndImportBook();
      if (book) {
        upsertBook(book);
      }
      return book;
    } finally {
      setLoading(false);
    }
  }, [libraryService, setLoading, upsertBook]);

  const importSampleBook = useCallback(async (): Promise<void> => {
    await loadBooks();
  }, [loadBooks]);

  const updateBookProgress = useCallback(
    async (
      bookHash: string,
      currentPage: number,
      totalPages: number,
      pageOffsetRatio = 0.0
    ): Promise<BookMetadata> => {
      const updated = await readerService.updateBookProgress(
        bookHash,
        currentPage,
        totalPages,
        pageOffsetRatio
      );
      upsertBook(updated);
      return updated;
    },
    [readerService, upsertBook]
  );

  const renameBook = useCallback(
    async (bookHash: string, newTitle: string): Promise<BookMetadata> => {
      setLoading(true);
      try {
        const updated = await libraryService.renameBook(bookHash, newTitle);
        upsertBook(updated);
        return updated;
      } finally {
        setLoading(false);
      }
    },
    [libraryService, setLoading, upsertBook]
  );

  const updateBookMetadata = useCallback(
    async (bookHash: string, input: UpdateBookMetadataInput): Promise<BookMetadata> => {
      setLoading(true);
      try {
        const updated = await libraryService.updateBookMetadata(bookHash, input);
        upsertBook(updated);
        return updated;
      } finally {
        setLoading(false);
      }
    },
    [libraryService, setLoading, upsertBook]
  );

  const deleteBook = useCallback(
    async (bookHash: string): Promise<boolean> => {
      setLoading(true);
      try {
        const success = await libraryService.deleteBook(bookHash);
        if (success) {
          removeBook(bookHash);
          const currentHighlights = useHighlightStore.getState().highlights;
          useHighlightStore
            .getState()
            .setHighlights(currentHighlights.filter((h) => h.bookHash !== bookHash));
        }
        return success;
      } finally {
        setLoading(false);
      }
    },
    [libraryService, removeBook, setLoading]
  );

  return useMemo(
    () => ({
      books,
      isLoading,
      loadBooks,
      importBookFile,
      pickAndImportBook,
      importSampleBook,
      updateBookProgress,
      renameBook,
      updateBookMetadata,
      deleteBook,
    }),
    [
      books,
      isLoading,
      loadBooks,
      importBookFile,
      pickAndImportBook,
      importSampleBook,
      updateBookProgress,
      renameBook,
      updateBookMetadata,
      deleteBook,
    ]
  );
}
