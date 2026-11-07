import type { BookMetadata } from '@domain/BookMetadata';
import { bootstrapReaderBook } from '@hooks/readerBootstrapper';
import {
  type ReaderHighlightsController,
  createReaderHighlightsController,
} from '@hooks/useReaderHighlights';
import {
  type ReaderPaginationController,
  createReaderPaginationController,
} from '@hooks/useReaderPagination';
import { useNavigation } from '@providers/NavigationContext';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { type ReactNode, createContext, useContext, useEffect, useMemo } from 'react';

export interface ReaderContextValue {
  readonly pagination: ReaderPaginationController;
  readonly highlights: ReaderHighlightsController;
}

export const ReaderContext = createContext<ReaderContextValue | null>(null);

export interface ReaderProviderProps {
  readonly children?: ReactNode;
  readonly value?: ReaderContextValue;
  readonly bookOverride?: BookMetadata | null;
}

function ReaderSessionProvider({ children, bookOverride }: Omit<ReaderProviderProps, 'value'>) {
  const {
    highlightService,
    readerService,
    libraryService,
    presenceService,
    getViewer,
    epubViewer,
    pdfViewer,
  } = useServiceContainer();
  const navigation = useNavigation();
  const book = bookOverride ?? navigation.selectedBook;

  const pagination = useMemo(
    () =>
      createReaderPaginationController({
        readerService,
        presenceService,
        getViewer,
        epubViewer,
        pdfViewer,
      }),
    [readerService, presenceService, getViewer, epubViewer, pdfViewer]
  );

  const highlights = useMemo(
    () => createReaderHighlightsController(highlightService),
    [highlightService]
  );

  useEffect(() => {
    void bootstrapReaderBook(
      {
        readerService,
        libraryService,
        presenceService,
        highlights,
        getViewer,
        epubViewer,
        pdfViewer,
      },
      book
    );
  }, [
    book,
    readerService,
    libraryService,
    presenceService,
    highlights,
    getViewer,
    epubViewer,
    pdfViewer,
  ]);

  const value = useMemo<ReaderContextValue>(
    () => ({ pagination, highlights }),
    [pagination, highlights]
  );

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function ReaderProvider({ children, value, bookOverride }: ReaderProviderProps) {
  if (value) {
    return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
  }
  return <ReaderSessionProvider bookOverride={bookOverride}>{children}</ReaderSessionProvider>;
}

export function useReader(): ReaderContextValue {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error('useReader must be used within a ReaderProvider');
  }
  return context;
}
