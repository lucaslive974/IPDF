import type { ReaderPaginationController } from '@hooks/useReaderPagination';
import { calculateVirtualSpacers } from '@hooks/virtualSpacers';
import type { DocumentPage } from '@ports/IReaderService';
import { useReaderStore } from '@stores/useReaderStore';
import { type RefObject, useEffect, useMemo, useRef } from 'react';

export interface UseReaderStreamVirtualizationOptions {
  readonly pagination: ReaderPaginationController;
  readonly contentAreaRef: RefObject<HTMLElement | null>;
  readonly isPdf: boolean;
  readonly loadedPages?: readonly DocumentPage[];
  readonly totalPages?: number;
  readonly currentPage?: number;
}

export interface UseReaderStreamVirtualizationReturn {
  readonly sortedPages: readonly DocumentPage[];
  readonly topSentinelRef: RefObject<HTMLDivElement | null>;
  readonly bottomSentinelRef: RefObject<HTMLDivElement | null>;
  readonly topSpacerHeight: number;
  readonly bottomSpacerHeight: number;
}

export function useReaderStreamVirtualization({
  pagination,
  contentAreaRef,
  isPdf,
  loadedPages: customLoadedPages,
  totalPages: customTotalPages,
  currentPage: customCurrentPage,
}: UseReaderStreamVirtualizationOptions): UseReaderStreamVirtualizationReturn {
  const storeCurrentPage = useReaderStore((s) => s.currentPage);
  const storeTotalPages = useReaderStore((s) => s.totalPages);
  const storeLoadedPages = useReaderStore((s) => s.loadedPages);

  const currentPage = customCurrentPage ?? storeCurrentPage;
  const totalPages = customTotalPages ?? storeTotalPages;
  const loadedPages = customLoadedPages ?? storeLoadedPages;

  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // 1. Bottom sentinel: triggers forward page loading before reaching viewport bottom
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void pagination.loadMorePages('next');
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pagination]);

  // 2. Top sentinel: triggers reverse page loading when scrolling up
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    let hasSettled = false;
    const timer = setTimeout(() => {
      hasSettled = true;
    }, 600);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!hasSettled) return;
        if (entries[0]?.isIntersecting && currentPage > 1) {
          void pagination.loadMorePages('prev');
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(sentinel);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [pagination, currentPage]);

  // 3. Page deduplication and sorting in strict ascending sequence
  const sortedPages = useMemo(() => {
    const pageMap = new Map<number, DocumentPage>();
    for (const p of loadedPages) {
      pageMap.set(p.pageNumber, p);
    }
    return Array.from(pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  }, [loadedPages]);

  const firstLoadedPage = sortedPages[0]?.pageNumber ?? 1;
  const lastLoadedPage = sortedPages[sortedPages.length - 1]?.pageNumber ?? 1;

  // 4. Virtual spacer heights calculation
  const defaultPageHeight = useMemo(() => {
    if (isPdf) {
      const width = contentAreaRef.current?.clientWidth || 768;
      return Math.round(width * Math.SQRT2);
    }
    return 900;
  }, [isPdf, contentAreaRef]);

  const { topSpacerHeight, bottomSpacerHeight } = useMemo(
    () =>
      calculateVirtualSpacers({
        firstLoadedPage,
        lastLoadedPage,
        totalPages,
        defaultPageHeight,
      }),
    [firstLoadedPage, lastLoadedPage, totalPages, defaultPageHeight]
  );

  return {
    sortedPages,
    topSentinelRef,
    bottomSentinelRef,
    topSpacerHeight,
    bottomSpacerHeight,
  };
}
