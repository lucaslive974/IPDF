import { type PageWindow, calculatePageWindow } from '@domain/PageWindow';
import { BookFormat } from '@domain/types';
import type { DocumentPage, IPdfViewer, IPresenceService, IReaderService } from '@ports';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { type LoadedPagesInfo, useReaderStore } from '@stores/useReaderStore';
import {
  hasWindow,
  isBrowser,
  safeRequestAnimationFrame,
  safeScrollTo,
  selectElement,
  selectElements,
  useIsomorphicLayoutEffect,
} from '@utils/dom';
import { clamp } from '@utils/math';
import { useEffect, useMemo, useRef } from 'react';

export interface ReaderPaginationDependencies {
  readonly readerService: IReaderService;
  readonly pdfViewer?: IPdfViewer;
  readonly presenceService?: IPresenceService;
  readonly store?: typeof useReaderStore;
}

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
  syncPresence(pageNumber: number): void;
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
 * Calculates the forward window of pages to fetch in O(1).
 */
export function calculateNextPageWindow(
  loadedPages: LoadedPagesInfo,
  totalPages: number,
  chunkSize = PAGINATION_CHUNK_SIZE
): PageWindow | null {
  if (loadedPages.maxPage >= totalPages || loadedPages.maxPage <= 0) {
    return null;
  }
  const count = Math.min(chunkSize, totalPages - loadedPages.maxPage);
  return { startPage: loadedPages.maxPage + 1, count };
}

/**
 * Calculates the backward window of pages to fetch in O(1).
 */
export function calculatePrevPageWindow(
  loadedPages: LoadedPagesInfo,
  chunkSize = PAGINATION_CHUNK_SIZE
): PageWindow | null {
  if (loadedPages.minPage <= 1) {
    return null;
  }
  const startPage = Math.max(1, loadedPages.minPage - chunkSize);
  const count = loadedPages.minPage - startPage;
  return { startPage, count };
}

/**
 * Determines whether proactive page loading is needed based on reader position in O(1).
 */
export function determinePrefetchDirection(
  currentPage: number,
  previousPage: number,
  loadedPages: LoadedPagesInfo,
  totalPages: number,
  triggerDistance = PREFETCH_PAGES_TRIGGER_DISTANCE
): 'next' | 'prev' | null {
  if (currentPage === previousPage || (loadedPages.minPage === 0 && loadedPages.maxPage === 0)) {
    return null;
  }
  const lastLoaded = loadedPages.maxPage;
  const firstLoaded = loadedPages.minPage;

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
  const elements = selectElements<HTMLElement>('article[data-page-number]');
  const rects: ArticleRect[] = [];
  for (const el of elements) {
    const pageNum = Number(el.getAttribute('data-page-number'));
    if (pageNum > 0) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        rects.push({
          pageNumber: pageNum,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
        });
      }
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
  if (!isBrowser()) return null;
  const rects = collectVisibleArticleRects();
  if (rects.length === 0) return null;

  const targetFocalY = focalY ?? window.innerHeight * 0.35;
  const activePage = findFocalPageNumber(rects, targetFocalY);
  if (!activePage || activePage <= 0) return null;

  const el = selectElement<HTMLElement>(`article[data-page-number="${activePage}"]`);
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

  const syncPresence = (pageNumber: number): void => {
    const state = store.getState();
    const visible = state.loadedPages.byPage.get(pageNumber);
    void deps.presenceService?.updateReadingPresence({
      bookHash: state.document.bookHash,
      bookTitle: state.document.bookTitle,
      bookAuthor: state.document.bookAuthor,
      chapterTitle: visible?.chapterTitle ?? state.chapterTitle,
      currentPage: pageNumber,
      totalPages: state.totalPages,
    });
  };

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

    if (format === BookFormat.PDF && deps.pdfViewer) {
      return deps.pdfViewer.getPagesChunk(pageWindow.startPage, pageWindow.count);
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
      const visible = state.loadedPages.byPage.get(pageNumber);
      if (visible?.chapterTitle) {
        store.getState().setChapterTitle(visible.chapterTitle);
      }
    }

    if (!state.loadedPages.byPage.has(pageNumber)) {
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
    const exists = state.loadedPages.byPage.has(targetPage);
    if (exists) return;

    const pageWindow = calculatePageWindow(targetPage, state.totalPages);
    const pages = await fetchPagesChunk(pageWindow);
    if (pages.length > 0) {
      store.getState().upsertPages(pages);
    }
  };

  const scrollToTargetPage = (targetPage: number, offsetRatio: number, smooth: boolean): void => {
    if (!hasWindow()) return;

    const performScroll = (): boolean => {
      if (targetPage === 1 && Math.abs(offsetRatio) <= 0.0001) {
        safeScrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' });
        return true;
      }

      const el = selectElement<HTMLElement>(`article[data-page-number="${targetPage}"]`);
      if (!el) return false;

      const rect = el.getBoundingClientRect();
      const targetTop = calculateScrollTargetTop(
        rect.top,
        rect.height,
        window.scrollY ?? 0,
        offsetRatio
      );
      safeScrollTo({ top: targetTop, behavior: smooth ? 'smooth' : 'instant' });
      return true;
    };

    const executed = performScroll();
    if (!executed) {
      safeRequestAnimationFrame(() => {
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

    const active = store.getState().loadedPages.byPage.get(next);
    if (active?.chapterTitle) {
      store.getState().setChapterTitle(active.chapterTitle);
    }

    syncPresence(next);

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
    syncPresence,
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
  const { readerService, presenceService, pdfViewer } = useServiceContainer();
  const controller = useMemo(
    () =>
      createReaderPaginationController({
        readerService,
        presenceService,
        pdfViewer,
      }),
    [readerService, presenceService, pdfViewer]
  );

  const isStreamReady = options?.isStreamReady;

  // 1. Initial Scroll Restoration (fires before browser repaint to eliminate scroll flickering)
  const hasRestoredRef = useRef(false);
  const currentBookHash = useReaderStore((s) => s.document.bookHash);
  const lastBookHashRef = useRef<string | null>(null);

  if (currentBookHash !== lastBookHashRef.current) {
    lastBookHashRef.current = currentBookHash;
    hasRestoredRef.current = false;
  }

  useIsomorphicLayoutEffect(() => {
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
          controller.syncPresence(detected.pageNumber);
          controller.onPageVisible(detected.pageNumber, detected.offsetRatio);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isStreamReady, controller]);

  return controller;
}
