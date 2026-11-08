import { type PageWindow, calculatePageWindow } from '@domain/PageWindow';
import { BookFormat } from '@domain/types';
import { type ReaderBootstrapDependencies, resolvePdfViewer } from '@hooks/readerBootstrapper';
import type { DocumentPage } from '@ports/IReaderService';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useReaderStore } from '@stores/useReaderStore';
import { clamp } from '@utils/math';
import { useEffect, useMemo, useRef } from 'react';

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
 * Collects bounding rects for all visible page article elements currently in the DOM.
 */
export function collectVisibleArticleRects(): ArticleRect[] {
  if (typeof document === 'undefined') return [];
  const elements = document.querySelectorAll<HTMLElement>('article[data-page-number]');
  const rects: ArticleRect[] = [];
  for (const el of elements) {
    const pageNum = Number(el.getAttribute('data-page-number'));
    if (pageNum > 0) {
      const rect = el.getBoundingClientRect();
      rects.push({
        pageNumber: pageNum,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
      });
    }
  }
  return rects;
}

/**
 * Detects which page intersects the focal reading line and computes its relative offset ratio.
 */
export function detectFocalPageAndOffset(
  focalY?: number
): { pageNumber: number; offsetRatio: number } | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const rects = collectVisibleArticleRects();
  if (rects.length === 0) return null;

  const targetFocalY = focalY ?? window.innerHeight * 0.35;
  const activePage = findFocalPageNumber(rects, targetFocalY);
  if (!activePage || activePage <= 0) return null;

  const el = document.querySelector<HTMLElement>(`article[data-page-number="${activePage}"]`);
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  const offsetRatio = calculatePageOffsetRatio(rect.top, rect.height, 0, activePage > 1);
  return { pageNumber: activePage, offsetRatio };
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

  const fetchPagesChunk = async (pageWindow: PageWindow): Promise<readonly DocumentPage[]> => {
    const state = store.getState();
    const format = state.document.format ?? BookFormat.EPUB;

    if (format === BookFormat.PDF) {
      const pdfViewer = resolvePdfViewer(deps);
      return pdfViewer.getPagesChunk(pageWindow.startPage, pageWindow.count);
    }

    return deps.readerService.getBookPages(
      state.document.bookHash,
      pageWindow.startPage,
      pageWindow.count
    );
  };

  const loadMorePages = async (direction: 'next' | 'prev'): Promise<void> => {
    if (isLoadingMore) return;
    isLoadingMore = true;

    try {
      const state = store.getState();
      const pageWindow =
        direction === 'next'
          ? calculateNextPageWindow(state.loadedPages, state.totalPages)
          : calculatePrevPageWindow(state.loadedPages);

      if (!pageWindow) return;

      const pages = await fetchPagesChunk(pageWindow);
      if (pages.length === 0) return;

      if (direction === 'prev') {
        lockScroll(200);
      }
      store.getState().upsertPages(pages);
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

    if (!state.loadedPages.some((p) => p.pageNumber === pageNumber)) {
      void fetchTargetChunkIfNeeded(pageNumber);
      return;
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

  const fetchTargetChunkIfNeeded = async (targetPage: number): Promise<void> => {
    const state = store.getState();
    const exists = state.loadedPages.some((p) => p.pageNumber === targetPage);
    if (exists) return;

    const pageWindow = calculatePageWindow(targetPage, state.totalPages);
    const pages = await fetchPagesChunk(pageWindow);
    if (pages.length > 0) {
      store.getState().upsertPages(pages);
    }
  };

  const scrollToTargetPage = (targetPage: number, offsetRatio: number, smooth: boolean): void => {
    if (typeof window === 'undefined') return;

    const performScroll = (): boolean => {
      if (targetPage === 1 && Math.abs(offsetRatio) <= 0.0001) {
        if (typeof window.scrollTo === 'function') {
          window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' });
        }
        return true;
      }

      const el =
        typeof document !== 'undefined'
          ? document.querySelector<HTMLElement>(`article[data-page-number="${targetPage}"]`)
          : null;
      if (!el) return false;

      const rect = el.getBoundingClientRect();
      const targetTop = calculateScrollTargetTop(
        rect.top,
        rect.height,
        window.scrollY ?? 0,
        offsetRatio
      );
      if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: targetTop, behavior: smooth ? 'smooth' : 'instant' });
      }
      return true;
    };

    const executed = performScroll();
    if (!executed && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        performScroll();
      });
    }
  };

  const goToPage = async (targetPage: number, options?: GoToPageOptions): Promise<void> => {
    const state = store.getState();
    const next = clamp(targetPage, 1, state.totalPages);
    const offsetRatio = clamp(options?.offsetRatio ?? 0.0, -1.0, 1.0);
    const smooth = options?.smooth ?? false;

    lockScroll(smooth ? 900 : 600);
    await fetchTargetChunkIfNeeded(next);

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

    scrollToTargetPage(next, offsetRatio, smooth);

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
    } else {
      lockScroll(600);
    }

    scrollToTargetPage(targetPage, offsetRatio, false);
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

  // 1. Initial Scroll Restoration
  const hasRestoredRef = useRef(false);
  const currentBookHash = useReaderStore((s) => s.document.bookHash);
  const lastBookHashRef = useRef<string | null>(null);

  if (currentBookHash !== lastBookHashRef.current) {
    lastBookHashRef.current = currentBookHash;
    hasRestoredRef.current = false;
  }

  useEffect(() => {
    if (!isStreamReady) {
      hasRestoredRef.current = false;
      return;
    }

    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      controller.restoreInitialScroll();
    }
  }, [isStreamReady, controller]);

  // 2. Focal Page & Offset Tracking at 60fps
  useEffect(() => {
    if (!isStreamReady) return;

    let ticking = false;

    const handleScroll = () => {
      if (controller.isLocked() || ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        ticking = false;
        if (controller.isLocked()) return;

        const detected = detectFocalPageAndOffset();
        if (detected) {
          controller.onPageVisible(detected.pageNumber, detected.offsetRatio);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isStreamReady, controller]);

  return controller;
}
