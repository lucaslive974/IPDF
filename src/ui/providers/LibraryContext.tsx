import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import { useServiceContainer } from './ServiceContainerContext';

export interface LibraryContextValue {
  readonly books: BookMetadata[];
  readonly isLoading: boolean;
  loadBooks(): Promise<BookMetadata[]>;
  importSampleBook(): Promise<void>;
}

export const LibraryContext = createContext<LibraryContextValue | null>(null);

export interface LibraryProviderProps {
  readonly children: ReactNode;
}

export function LibraryProvider({ children }: LibraryProviderProps) {
  const { backendGateway } = useServiceContainer();
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await backendGateway.listLibraryBooks();
      setBooks(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [backendGateway]);

  const importSampleBook = useCallback(async () => {
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

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      books,
      isLoading,
      loadBooks,
      importSampleBook,
    }),
    [books, isLoading, loadBooks, importSampleBook]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibraryContext(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibraryContext must be used within a LibraryProvider');
  }
  return context;
}
