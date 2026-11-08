import { BookFormat } from '@domain/types';
import {
  INITIAL_ACTIVE_PAGES,
  INITIAL_BACKWARD_PAGES,
  INITIAL_FORWARD_PAGES,
  type PageWindow,
  type ReaderBootstrapDependencies,
  resolvePdfViewer,
} from '@hooks/readerBootstrapper';
import type { DocumentPage } from '@ports/IReaderService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useReaderStore } from '@stores/useReaderStore';
import { clamp } from '@utils/math';
import { type RefObject, useEffect, useMemo, useRef } from 'react';

export type ReaderPaginationDependencies = Omit<ReaderBootstrapDependencies, 'libraryService'>;

export interface ArticleRect {
  readonly pageNumber: number;
  readonly top: number;
  readonly bottom: number;
  readonly height?: number;
}

export interface GoToPageOptions {
  readonly offsetRatio?: number;
  readonly smooth?: boolean;
  readonly onPageChanged?: (pageNumber: number) => Promise<void> | void;
}

export interface ReaderPaginationController {
  loadMorePages(direction: 'next' | 'prev'): Promise<void>;
  onPageVisible(pageNumber: number, offsetRatio?: number): void;
  goToPage(targetPage: number, options?: GoToPageOptions): Promise<void>;
  navigatePage(delta: number, options?: GoToPageOptions): Promise<void>;
  restoreInitialScroll(): void;
  isLocked(): boolean;
  lockScroll(durationMs: number): void;
  unlockScroll(): void;
}

export const PAGINATION_CHUNK_SIZE = 10;
export const PREFETCH_PAGES_TRIGGER_DISTANCE = 7;

/**
 * Calculates the forward window of pages to fetch.
 */
export function calculateNextPageWindow(
  loadedPages: readonly Pick<DocumentPage, 'pageNumber'>[],
  totalPages: number,
  chunkSize = PAGINATION_CHUNK_SIZE
): PageWindow | null {
  const lastPageNum =
    loadedPages.length > 0 ? Math.max(...loadedPages.map((p) => p.pageNumber)) : 0;
  if (lastPageNum >= totalPages) {
    return null;
  }
  const count = Math.min(chunkSize, totalPages - lastPageNum);
  return { startPage: lastPageNum + 1, count };
}

/**
 * Calculates the backward window of pages to fetch.
 */
export function calculatePrevPageWindow(
  loadedPages: readonly Pick<DocumentPage, 'pageNumber'>[],
  chunkSize = PAGINATION_CHUNK_SIZE
): PageWindow | null {
  const firstPageNum =
    loadedPages.length > 0 ? Math.min(...loadedPages.map((p) => p.pageNumber)) : 1;
  if (firstPageNum <= 1) {
    return null;
  }
  const startPage = Math.max(1, firstPageNum - chunkSize);
  const count = firstPageNum - startPage;
  return { startPage, count };
}

/**
 * Calculates the page window centered around a target navigation page.
 */
export function calculateTargetPageWindow(targetPage: number, totalPages: number): PageWindow {
  const next = clamp(targetPage, 1, totalPages);
  const backwardMargin = next > 1 ? Math.min(INITIAL_BACKWARD_PAGES, next - 1) : 0;
  const startPage = Math.max(1, next - backwardMargin);
  const count = Math.min(
    backwardMargin + INITIAL_ACTIVE_PAGES + INITIAL_FORWARD_PAGES,
    totalPages - startPage + 1
  );
  return { startPage, count };
}

/**
 * Determines whether proactive page loading is needed based on reader position.
 */
export function determinePrefetchDirection(
  currentPage: number,
  previousPage: number,
  loadedPages: readonly Pick<DocumentPage, 'pageNumber'>[],
  totalPages: number,
  triggerDistance = PREFETCH_PAGES_TRIGGER_DISTANCE
): 'next' | 'prev' | null {
  if (loadedPages.length === 0 || currentPage === previousPage) {
    return null;
  }
  const lastLoaded = Math.max(...loadedPages.map((p) => p.pageNumber));
  const firstLoaded = Math.min(...loadedPages.map((p) => p.pageNumber));

  const isMovingForward = currentPage > previousPage;
  const isMovingBackward = currentPage < previousPage;

  const nearEnd = lastLoaded < totalPages && lastLoaded - currentPage <= triggerDistance;
  const nearStart = firstLoaded > 1 && currentPage - firstLoaded <= triggerDistance;

  if (isMovingForward && nearEnd) {
    return 'next';
  }
  if (isMovingBackward && nearStart) {
    return 'prev';
  }
  return null;
}

/**
 * Calculates scroll compensation difference when prepending previous pages.
 */
export function calculateScrollOffsetCompensation(
  prevScrollHeight: number,
  newScrollHeight: number
): number {
  return Math.max(0, newScrollHeight - prevScrollHeight);
}

/**
 * Calculates the relative scroll ratio inside the active page [-1.0..1.0].
 */
export function calculatePageOffsetRatio(
  top: number,
  height: number,
  viewportTop = 0,
  allowNegative = false
): number {
  if (height <= 0) return 0.0;
  const scrolledPx = viewportTop - top;
  if (!allowNegative && scrolledPx <= 0) return 0.0;
  const ratio = scrolledPx / height;
  return clamp(ratio, allowNegative ? -1.0 : 0.0, 1.0);
}

/**
 * Calculates absolute vertical scroll position to align an element with an offset ratio.
 */
export function calculateScrollTargetTop(
  elementRectTop: number,
  elementRectHeight: number,
  currentScrollY: number,
  offsetRatio = 0.0
): number {
  return Math.max(0, currentScrollY + elementRectTop + elementRectHeight * offsetRatio);
}

/**
 * Pure algorithm to detect which page covers or is closest to the focal reading line.
 */
export function findFocalPageNumber(
  articles: readonly ArticleRect[],
  focalY: number
): number | null {
  if (articles.length === 0) return null;

  let activePage: number | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const article of articles) {
    if (article.top <= focalY && article.bottom > focalY) {
      return article.pageNumber;
    }
    const dist = Math.abs(article.top - focalY);
    if (dist < closestDistance) {
      closestDistance = dist;
      activePage = article.pageNumber;
    }
  }

  return activePage;
}

/**
 * Measures the relative scroll offset ratio for the given page element in the DOM on demand.
 */
export function measureCurrentPageOffsetRatio(currentPage: number): number {
  if (typeof document === 'undefined' || currentPage < 1) {
    return 0.0;
  }
  const el = document.querySelector<HTMLElement>(`article[data-page-number="${currentPage}"]`);
  if (!el) {
    return 0.0;
  }
  const rect = el.getBoundingClientRect();
  return calculatePageOffsetRatio(rect.top, rect.height, 0, currentPage > 1);
}

/**
 * Creates the reader pagination controller to orchestrate document streaming, navigation and scroll.
 */
export function createReaderPaginationController(
  deps: ReaderPaginationDependencies
): ReaderPaginationController {
  const store = deps.store ?? useReaderStore;
  let isLoadingMore = false;
  let isScrollLocked = false;
  let scrollLockTimer: ReturnType<typeof setTimeout> | null = null;

  const lockScroll = (durationMs: number): void => {
    if (scrollLockTimer) {
      clearTimeout(scrollLockTimer);
    }
    isScrollLocked = true;
    scrollLockTimer = setTimeout(() => {
      isScrollLocked = false;
      scrollLockTimer = null;
    }, durationMs);
  };

  const unlockScroll = (): void => {
    if (scrollLockTimer) {
      clearTimeout(scrollLockTimer);
      scrollLockTimer = null;
    }
    isScrollLocked = false;
  };

  const isLocked = (): boolean => isScrollLocked;

  const loadMorePages = async (direction: 'next' | 'prev'): Promise<void> => {
    if (isLoadingMore) return;
    isLoadingMore = true;

    const state = store.getState();
    const format = state.document.format ?? BookFormat.EPUB;

    try {
      const pageWindow =
        direction === 'next'
          ? calculateNextPageWindow(state.loadedPages, state.totalPages)
          : calculatePrevPageWindow(state.loadedPages);

      if (!pageWindow) return;

      const prevScrollHeight =
        typeof document !== 'undefined' ? document.documentElement.scrollHeight : 0;

      if (format === BookFormat.PDF) {
        const pdfViewer = resolvePdfViewer(deps);
        const chunk = pdfViewer.getPagesChunk(pageWindow.startPage, pageWindow.count);
        if (chunk.length > 0) {
          if (direction === 'prev') {
            lockScroll(300);
          }
          store.getState().upsertPages(chunk);
          if (direction === 'prev' && prevScrollHeight > 0 && typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
              const newScrollHeight = document.documentElement.scrollHeight;
              const diff = calculateScrollOffsetCompensation(prevScrollHeight, newScrollHeight);
              if (diff > 0) {
                window.scrollBy({ top: diff, behavior: 'instant' });
              }
              lockScroll(150);
            });
          }
          return;
        }
      }

      const pages = await deps.readerService.getBookPages(
        state.document.bookHash,
        pageWindow.startPage,
        pageWindow.count
      );
      if (pages.length > 0) {
        if (direction === 'prev') {
          lockScroll(300);
        }
        store.getState().upsertPages(pages);
        if (direction === 'prev' && prevScrollHeight > 0 && typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            const newScrollHeight = document.documentElement.scrollHeight;
            const diff = calculateScrollOffsetCompensation(prevScrollHeight, newScrollHeight);
            if (diff > 0) {
              window.scrollBy({ top: diff, behavior: 'instant' });
            }
            lockScroll(150);
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load more pages:', err);
    } finally {
      isLoadingMore = false;
    }
  };

  const onPageVisible = (pageNumber: number, offsetRatio?: number): void => {
    const state = store.getState();
    const previousPage = state.currentPage;

    if (offsetRatio !== undefined) {
      store.getState().setPageOffsetRatio(offsetRatio);
    }

    if (pageNumber !== previousPage) {
      store.getState().setCurrentPage(pageNumber);
      const visible = state.loadedPages.find((p) => p.pageNumber === pageNumber);
      if (visible?.chapterTitle) {
        store.getState().setChapterTitle(visible.chapterTitle);
      }
      void deps.presenceService?.updateReadingPresence({
        bookHash: state.document.bookHash,
        bookTitle: state.document.bookTitle,
        bookAuthor: state.document.bookAuthor,
        chapterTitle: visible?.chapterTitle ?? state.chapterTitle,
        currentPage: pageNumber,
        totalPages: state.totalPages,
      });
    }

    const prefetchDirection = determinePrefetchDirection(
      pageNumber,
      previousPage,
      state.loadedPages,
      state.totalPages
    );
    if (prefetchDirection) {
      void loadMorePages(prefetchDirection);
    }
  };

  const goToPage = async (targetPage: number, options?: GoToPageOptions): Promise<void> => {
    const state = store.getState();
    const next = clamp(targetPage, 1, state.totalPages);
    const offsetRatio = clamp(options?.offsetRatio ?? 0.0, -1.0, 1.0);
    const smooth = options?.smooth ?? false;

    lockScroll(smooth ? 900 : 600);

    const exists = state.loadedPages.some((p) => p.pageNumber === next);
    if (!exists) {
      const pageWindow = calculateTargetPageWindow(next, state.totalPages);
      const format = state.document.format ?? BookFormat.EPUB;
      if (format === BookFormat.PDF) {
        const pdfViewer = resolvePdfViewer(deps);
        const chunk = pdfViewer.getPagesChunk(pageWindow.startPage, pageWindow.count);
        if (chunk.length > 0) {
          store.getState().upsertPages(chunk);
        }
      } else {
        const pages = await deps.readerService.getBookPages(
          state.document.bookHash,
          pageWindow.startPage,
          pageWindow.count
        );
        if (pages.length > 0) {
          store.getState().upsertPages(pages);
        }
      }
    }

    store.getState().setCurrentPage(next);
    store.getState().setPageOffsetRatio(offsetRatio);

    const active = store.getState().loadedPages.find((p) => p.pageNumber === next);
    if (active?.chapterTitle) {
      store.getState().setChapterTitle(active.chapterTitle);
    }

    void deps.presenceService?.updateReadingPresence({
      bookHash: state.document.bookHash,
      bookTitle: state.document.bookTitle,
      bookAuthor: state.document.bookAuthor,
      chapterTitle: store.getState().chapterTitle,
      currentPage: next,
      totalPages: state.totalPages,
    });

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        if (next === 1 && Math.abs(offsetRatio) <= 0.0001) {
          window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' });
          return;
        }

        const el = document.querySelector<HTMLElement>(`article[data-page-number="${next}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const targetTop = calculateScrollTargetTop(
            rect.top,
            rect.height,
            window.scrollY,
            offsetRatio
          );
          window.scrollTo({ top: targetTop, behavior: smooth ? 'smooth' : 'instant' });
        }
      });
    }

    if (options?.onPageChanged) {
      await options.onPageChanged(next);
    }
  };

  const navigatePage = async (delta: number, options?: GoToPageOptions): Promise<void> => {
    const current = store.getState().currentPage;
    await goToPage(current + delta, options);
  };

  const restoreInitialScroll = (): void => {
    const { currentPage, pageOffsetRatio } = store.getState();
    const targetPage = Math.max(1, currentPage);
    const offsetRatio = clamp(pageOffsetRatio || 0.0, -1.0, 1.0);

    if (targetPage <= 1 && Math.abs(offsetRatio) <= 0.0001) {
      unlockScroll();
      return;
    }

    let attempts = 0;
    const align = () => {
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        return;
      }
      const el = document.querySelector<HTMLElement>(`article[data-page-number="${targetPage}"]`);
      if (!el || el.getBoundingClientRect().height === 0) {
        attempts++;
        if (attempts < 30) {
          window.requestAnimationFrame(align);
        }
        return;
      }

      lockScroll(600);
      const rect = el.getBoundingClientRect();
      const targetTop = calculateScrollTargetTop(
        rect.top,
        rect.height,
        window.scrollY,
        offsetRatio
      );
      window.scrollTo({ top: targetTop, behavior: 'instant' });
    };

    align();
  };

  return {
    loadMorePages,
    onPageVisible,
    goToPage,
    navigatePage,
    restoreInitialScroll,
    isLocked,
    lockScroll,
    unlockScroll,
  };
}

export interface UseReaderPaginationOptions {
  readonly contentAreaRef?: RefObject<HTMLElement | null>;
  readonly topSentinelRef?: RefObject<HTMLElement | null>;
  readonly bottomSentinelRef?: RefObject<HTMLElement | null>;
  readonly isStreamReady?: boolean;
}

export function useReaderPagination(
  options?: UseReaderPaginationOptions
): ReaderPaginationController {
  const container = useServiceContainer();
  const controller = useMemo(
    () =>
      createReaderPaginationController({
        readerService: container.readerService,
        presenceService: container.presenceService,
        epubViewer: container.epubViewer,
        pdfViewer: container.pdfViewer,
        getViewer: container.getViewer,
      }),
    [
      container.readerService,
      container.presenceService,
      container.epubViewer,
      container.pdfViewer,
      container.getViewer,
    ]
  );

  const isStreamReady = options?.isStreamReady;
  const topSentinelRef = options?.topSentinelRef;
  const bottomSentinelRef = options?.bottomSentinelRef;
  const contentAreaRef = options?.contentAreaRef;

  // 1. Initial Scroll Restoration
  const hasRestoredRef = useRef(false);
  const currentBookHash = useReaderStore((s) => s.document.bookHash);
  const lastBookHashRef = useRef<string | null>(null);

  if (currentBookHash !== lastBookHashRef.current) {
    lastBookHashRef.current = currentBookHash;
    hasRestoredRef.current = false;
  }

  useEffect(() => {
    if (isStreamReady && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      controller.restoreInitialScroll();
    }
  }, [isStreamReady, controller]);

  // 2. Bottom Sentinel (loads next pages)
  useEffect(() => {
    const sentinel = bottomSentinelRef?.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void controller.loadMorePages('next');
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [bottomSentinelRef, controller]);

  // 3. Top Sentinel (loads previous pages with anchoring)
  useEffect(() => {
    const sentinel = topSentinelRef?.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    let hasSettled = false;
    const timer = setTimeout(() => {
      hasSettled = true;
    }, 600);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!hasSettled) return;
        const currentPage = useReaderStore.getState().currentPage;
        if (entries[0]?.isIntersecting && currentPage > 1) {
          void controller.loadMorePages('prev');
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(sentinel);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [topSentinelRef, controller]);

  // 4. Focal Page & Offset Tracking at 60fps
  useEffect(() => {
    if (!contentAreaRef) return;

    let ticking = false;

    const handleScroll = () => {
      if (controller.isLocked()) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (controller.isLocked()) {
            ticking = false;
            return;
          }

          const elements = document.querySelectorAll<HTMLElement>('article[data-page-number]');
          if (elements.length === 0) {
            ticking = false;
            return;
          }

          const focalY = window.innerHeight * 0.35;
          const articleRects: ArticleRect[] = [];
          for (const el of elements) {
            const pageNum = Number(el.getAttribute('data-page-number'));
            if (pageNum > 0) {
              const rect = el.getBoundingClientRect();
              articleRects.push({
                pageNumber: pageNum,
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height,
              });
            }
          }

          const activePage = findFocalPageNumber(articleRects, focalY);
          if (activePage && activePage > 0) {
            const activeEl = document.querySelector<HTMLElement>(
              `article[data-page-number="${activePage}"]`
            );
            const activeRect = activeEl?.getBoundingClientRect();
            const offsetRatio = activeRect
              ? calculatePageOffsetRatio(activeRect.top, activeRect.height, 0, activePage > 1)
              : undefined;

            controller.onPageVisible(activePage, offsetRatio);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [contentAreaRef, controller]);

  return controller;
}
