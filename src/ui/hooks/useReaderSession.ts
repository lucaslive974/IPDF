import { useCallback, useState } from 'react';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import { DEFAULT_DOCUMENT, type StudyDocumentDescriptor } from './studyWorkbenchTypes';

export interface ReaderSessionHook {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  setDocument(doc: StudyDocumentDescriptor): void;
  setCurrentPage(page: number): void;
  navigatePage(delta: number, onPageChanged?: (nextPage: number) => Promise<void>): Promise<number>;
}

export function useReaderSession(
  initialDocument: StudyDocumentDescriptor = DEFAULT_DOCUMENT,
  totalPages = 320
): ReaderSessionHook {
  const { backendGateway } = useServiceContainer();
  const [document, setDocument] = useState<StudyDocumentDescriptor>(initialDocument);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const navigatePage = useCallback(
    async (delta: number, onPageChanged?: (nextPage: number) => Promise<void>) => {
      const next = Math.max(1, Math.min(totalPages, currentPage + delta));
      setCurrentPage(next);
      await backendGateway.updateBookProgress(document.bookHash, next, totalPages);
      if (onPageChanged) {
        await onPageChanged(next);
      }
      return next;
    },
    [backendGateway, currentPage, document.bookHash, totalPages]
  );

  return {
    document,
    currentPage,
    totalPages,
    setDocument,
    setCurrentPage,
    navigatePage,
  };
}
