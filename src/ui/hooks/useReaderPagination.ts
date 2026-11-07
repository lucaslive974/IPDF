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
import { useMemo } from 'react';

export type ReaderPaginationDependencies = Omit<ReaderBootstrapDependencies, 'libraryService'>;

export interface ReaderPaginationController {
  loadMorePages(direction: 'next' | 'prev'): Promise<void>;
  onPageVisible(pageNumber: number): void;
  goToPage(
    targetPage: number,
    onPageChanged?: (pageNumber: number) => Promise<void> | void
  ): Promise<void>;
  navigatePage(
    delta: number,
    onPageChanged?: (pageNumber: number) => Promise<void> | void
  ): Promise<void>;
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
  const next = clampPageNumber(targetPage, totalPages);
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
  if (loadedPages.length === 0) {
    return null;
  }
  const lastLoaded = Math.max(...loadedPages.map((p) => p.pageNumber));
  const firstLoaded = Math.min(...loadedPages.map((p) => p.pageNumber));

  const nearEnd = lastLoaded < totalPages && lastLoaded - currentPage <= triggerDistance;
  const nearStart = firstLoaded > 1 && currentPage - firstLoaded <= triggerDistance;

  if (nearStart && nearEnd) {
    return currentPage < previousPage ? 'prev' : 'next';
  }
  if (nearEnd) {
    return 'next';
  }
  if (nearStart) {
    return 'prev';
  }
  return null;
}

/**
 * Clamps page number within valid reader bounds [1..totalPages].
 */
export function clampPageNumber(targetPage: number, totalPages: number): number {
  return Math.max(1, Math.min(totalPages, targetPage));
}

/**
 * Creates the reader pagination controller to orchestrate document navigation and streaming.
 */
export function createReaderPaginationController(
  deps: ReaderPaginationDependencies
): ReaderPaginationController {
  const store = deps.store ?? useReaderStore;
  let isLoadingMore = false;

  const loadMorePagesInternal = async (direction: 'next' | 'prev'): Promise<void> => {
    if (isLoadingMore) return;
    isLoadingMore = true;

    const state = store.getState();
    const format = state.document.format ?? BookFormat.EPUB;

    try {
      const window =
        direction === 'next'
          ? calculateNextPageWindow(state.loadedPages, state.totalPages)
          : calculatePrevPageWindow(state.loadedPages);

      if (!window) return;

      if (format === BookFormat.PDF) {
        const pdfViewer = resolvePdfViewer(deps);
        const chunk = pdfViewer.getPagesChunk(window.startPage, window.count);
        if (chunk.length > 0) {
          store.getState().upsertPages(chunk);
          return;
        }
      }

      const pages = await deps.readerService.getBookPages(
        state.document.bookHash,
        window.startPage,
        window.count
      );
      if (pages.length > 0) {
        store.getState().upsertPages(pages);
      }
    } catch (err) {
      console.warn('Failed to load more pages:', err);
    } finally {
      isLoadingMore = false;
    }
  };

  const onPageVisible = (pageNumber: number): void => {
    const state = store.getState();
    const previousPage = state.currentPage;
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
      void loadMorePagesInternal(prefetchDirection);
    }
  };

  const goToPage = async (
    targetPage: number,
    onPageChanged?: (pageNumber: number) => Promise<void> | void
  ): Promise<void> => {
    const state = store.getState();
    const next = clampPageNumber(targetPage, state.totalPages);
    store.getState().setCurrentPage(next);

    const exists = state.loadedPages.some((p) => p.pageNumber === next);
    if (!exists) {
      const window = calculateTargetPageWindow(next, state.totalPages);
      const pages = await deps.readerService.getBookPages(
        state.document.bookHash,
        window.startPage,
        window.count
      );
      if (pages.length > 0) {
        store.getState().upsertPages(pages);
        const active = pages.find((p) => p.pageNumber === next) ?? pages[0];
        if (active?.chapterTitle) {
          store.getState().setChapterTitle(active.chapterTitle);
        }
      }
    } else {
      const active = state.loadedPages.find((p) => p.pageNumber === next);
      if (active?.chapterTitle) {
        store.getState().setChapterTitle(active.chapterTitle);
      }
    }

    void deps.presenceService?.updateReadingPresence({
      bookHash: state.document.bookHash,
      bookTitle: state.document.bookTitle,
      bookAuthor: state.document.bookAuthor,
      chapterTitle: store.getState().chapterTitle,
      currentPage: next,
      totalPages: state.totalPages,
    });
    if (onPageChanged) {
      await onPageChanged(next);
    }
  };

  const navigatePage = async (
    delta: number,
    onPageChanged?: (pageNumber: number) => Promise<void> | void
  ): Promise<void> => {
    const state = store.getState();
    const next = clampPageNumber(state.currentPage + delta, state.totalPages);
    await goToPage(next, onPageChanged);
  };

  return {
    loadMorePages: loadMorePagesInternal,
    onPageVisible,
    goToPage,
    navigatePage,
  };
}

export function useReaderPagination(): ReaderPaginationController {
  const { readerService, presenceService, getViewer, epubViewer, pdfViewer } =
    useServiceContainer();

  return useMemo(
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
}
