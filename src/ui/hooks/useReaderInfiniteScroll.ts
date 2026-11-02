import { type RefObject, useEffect } from 'react';

export function calculateScrollOffsetCompensation(
  prevScrollHeight: number,
  newScrollHeight: number
): number {
  return Math.max(0, newScrollHeight - prevScrollHeight);
}

export interface UseReaderInfiniteScrollOptions {
  readonly contentAreaRef: RefObject<HTMLElement | null>;
  readonly bottomSentinelRef: RefObject<HTMLElement | null>;
  readonly topSentinelRef: RefObject<HTMLElement | null>;
  readonly isProgrammaticScrollRef: RefObject<boolean>;
  readonly currentPage: number;
  readonly loadMorePages: (direction: 'next' | 'prev') => Promise<void>;
}

/**
 * Coordinates bidirectional infinite scroll streaming.
 * Automatically loads next pages when scrolling down (via bottom sentinel),
 * and loads previous pages when scrolling up (via top sentinel) with scroll anchoring
 * compensation to prevent viewport jumping.
 */
export function useReaderInfiniteScroll({
  contentAreaRef,
  bottomSentinelRef,
  topSentinelRef,
  isProgrammaticScrollRef,
  currentPage,
  loadMorePages,
}: UseReaderInfiniteScrollOptions): void {
  // Bottom Sentinel: loads next pages ahead of time
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMorePages('next');
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [bottomSentinelRef, loadMorePages]);

  // Top Sentinel: loads previous pages with upward scroll anchoring
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    let hasSettled = false;
    const settleTimer = setTimeout(() => {
      hasSettled = true;
    }, 600);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!hasSettled) return;

        if (entries[0]?.isIntersecting && currentPage > 1) {
          const container = contentAreaRef.current;
          const prevScrollHeight = container
            ? container.scrollHeight
            : document.documentElement.scrollHeight;
          isProgrammaticScrollRef.current = true;

          void loadMorePages('prev').then(() => {
            window.requestAnimationFrame(() => {
              const newScrollHeight = container
                ? container.scrollHeight
                : document.documentElement.scrollHeight;
              const diff = calculateScrollOffsetCompensation(prevScrollHeight, newScrollHeight);
              if (diff > 0) {
                window.scrollBy({ top: diff, behavior: 'instant' });
              }
              setTimeout(() => {
                isProgrammaticScrollRef.current = false;
              }, 150);
            });
          });
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(sentinel);
    return () => {
      clearTimeout(settleTimer);
      observer.disconnect();
    };
  }, [topSentinelRef, contentAreaRef, currentPage, isProgrammaticScrollRef, loadMorePages]);
}
