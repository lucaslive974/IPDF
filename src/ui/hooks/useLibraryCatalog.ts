import { useCallback, useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import { useServiceContainer } from '../providers/ServiceContainerContext';

export interface LibraryCatalogHook {
  readonly libraryBooks: BookMetadata[];
  setLibraryBooks(books: BookMetadata[]): void;
  loadBooks(): Promise<BookMetadata[]>;
  importSampleEpubBook(): Promise<void>;
}

export function useLibraryCatalog(): LibraryCatalogHook {
  const { backendGateway } = useServiceContainer();
  const [libraryBooks, setLibraryBooks] = useState<BookMetadata[]>([]);

  const loadBooks = useCallback(async () => {
    const books = await backendGateway.listLibraryBooks();
    setLibraryBooks(books);
    return books;
  }, [backendGateway]);

  const importSampleEpubBook = useCallback(async () => {
    const rawBytes = new TextEncoder().encode('PK\x03\x04kant-critique-pure-reason');
    await backendGateway.importLibraryBook({
      rawBytes,
      title: 'Critique of Pure Reason',
      author: 'Immanuel Kant',
      format: 'epub',
      totalPages: 480,
    });
    await loadBooks();
  }, [backendGateway, loadBooks]);

  return {
    libraryBooks,
    setLibraryBooks,
    loadBooks,
    importSampleEpubBook,
  };
}
