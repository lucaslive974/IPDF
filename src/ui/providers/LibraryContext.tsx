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
import type { BookFormat } from '../../core/domain/types';
import { useServiceContainer } from './ServiceContainerContext';

export interface LibraryContextValue {
  readonly books: BookMetadata[];
  readonly isLoading: boolean;
  loadBooks(): Promise<BookMetadata[]>;
  importBookFile(file: File): Promise<BookMetadata>;
  importSampleBook(): Promise<void>;
}

export const LibraryContext = createContext<LibraryContextValue | null>(null);

export interface LibraryProviderProps {
  readonly children: ReactNode;
}

export function LibraryProvider({ children }: LibraryProviderProps) {
  const { services } = useServiceContainer();
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await services.listLibraryBooks();
      setBooks(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [services]);

  const importBookFile = useCallback(
    async (file: File): Promise<BookMetadata> => {
      setIsLoading(true);
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
          author: 'Unknown Author',
          format,
          totalPages: 0,
        });
        await loadBooks();
        return book;
      } finally {
        setIsLoading(false);
      }
    },
    [services, loadBooks]
  );

  const importSampleBook = useCallback(async () => {
    await loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      books,
      isLoading,
      loadBooks,
      importBookFile,
      importSampleBook,
    }),
    [books, isLoading, loadBooks, importBookFile, importSampleBook]
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
