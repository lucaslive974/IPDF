import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import type { UpdateBookMetadataInput } from '@ports/ILibraryService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useLibraryStore } from '@stores/useLibraryStore';
import { generatePdfPageCoverDataUrl } from '@utils/pdfCoverGenerator';
import { useCallback, useEffect } from 'react';

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
  updateBookCover(bookHash: string, coverImageUrl: string): Promise<BookMetadata>;
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

  const ensurePdfCover = useCallback(
    async (book: BookMetadata): Promise<void> => {
      if (book.format !== BookFormat.PDF) return;
      if (book.coverImageUrl?.startsWith('data:image/webp')) return;
      try {
        let source: string | ArrayBuffer | null = null;
        if (readerService.getBookFilePath) {
          const path = await readerService.getBookFilePath(book.bookHash);
          if (path) {
            try {
              const { convertFileSrc } = await import('@tauri-apps/api/core');
              source = convertFileSrc(path);
            } catch {
              source = path;
            }
          }
        }
        if (!source) {
          const bytes = await readerService.readBookBinary(book.bookHash);
          if (bytes.length > 0) {
            source = bytes.buffer as ArrayBuffer;
          }
        }
        if (source) {
          const coverUrl = await generatePdfPageCoverDataUrl(source);
          if (coverUrl) {
            if (libraryService.updateBookCover) {
              const updated = await libraryService.updateBookCover(book.bookHash, coverUrl);
              upsertBook(updated);
            } else {
              upsertBook({ ...book, coverImageUrl: coverUrl });
            }
          }
        }
      } catch (err) {
        console.warn('Could not generate PDF cover:', err);
      }
    },
    [libraryService, readerService, upsertBook]
  );

  const loadBooks = useCallback(async (): Promise<BookMetadata[]> => {
    setLoading(true);
    try {
      const result = await libraryService.listLibraryBooks();
      setBooks(result);
      for (const b of result) {
        if (
          b.format === BookFormat.PDF &&
          (!b.coverImageUrl || !b.coverImageUrl.startsWith('data:image/webp'))
        ) {
          void ensurePdfCover(b);
        }
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [ensurePdfCover, libraryService, setBooks, setLoading]);

  const importBookFile = useCallback(
    async (file: File): Promise<BookMetadata> => {
      setLoading(true);
      try {
        const filePath = (file as unknown as { path?: string }).path;
        if (filePath && filePath.trim().length > 0) {
          const book = await libraryService.openBookFile(filePath);
          upsertBook(book);
          if (book.format === BookFormat.PDF) {
            void ensurePdfCover(book);
          }
          return book;
        }

        const buffer = await file.arrayBuffer();
        const rawBytes = new Uint8Array(buffer);
        const extension = file.name.split('.').pop()?.toLowerCase();
        const format: BookFormat = extension === 'pdf' ? BookFormat.PDF : BookFormat.EPUB;
        const cleanTitle =
          file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled Document';

        const book = await libraryService.importLibraryBook({
          rawBytes,
          title: cleanTitle,
          author: '',
          format,
          totalPages: 0,
        });
        upsertBook(book);
        if (book.format === BookFormat.PDF) {
          void ensurePdfCover(book);
        }
        return book;
      } finally {
        setLoading(false);
      }
    },
    [ensurePdfCover, libraryService, setLoading, upsertBook]
  );

  const pickAndImportBook = useCallback(async (): Promise<BookMetadata | null> => {
    if (!libraryService.pickAndImportBook) return null;
    setLoading(true);
    try {
      const book = await libraryService.pickAndImportBook();
      if (book) {
        upsertBook(book);
        if (book.format === BookFormat.PDF) {
          void ensurePdfCover(book);
        }
      }
      return book;
    } finally {
      setLoading(false);
    }
  }, [ensurePdfCover, libraryService, setLoading, upsertBook]);

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

  const updateBookCover = useCallback(
    async (bookHash: string, coverImageUrl: string): Promise<BookMetadata> => {
      setLoading(true);
      try {
        if (!libraryService.updateBookCover) {
          throw new Error('updateBookCover is not supported');
        }
        const updated = await libraryService.updateBookCover(bookHash, coverImageUrl);
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
    pickAndImportBook,
    importSampleBook,
    updateBookProgress,
    renameBook,
    updateBookMetadata,
    updateBookCover,
    deleteBook,
  };
}
