import { useReaderPagination } from '@hooks/useReaderPagination';
import { useNavigation } from '@providers/NavigationContext';
import { useReaderStore } from '@stores/useReaderStore';
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { useLibrary } from './useLibrary';
import { measureCurrentPageOffsetRatio } from './useReaderFocalPageTracker';
import { useReaderUI } from './useReaderUI';

export interface ReadingProgressState {
  readonly bookHash: string;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly pageOffsetRatio?: number;
}

/**
 * Pure check to verify if reading progress has genuinely changed before saving.
 */
export function shouldSaveProgress(
  lastSaved: ReadingProgressState | null,
  current: ReadingProgressState
): boolean {
  if (!current.bookHash) return false;
  if (!lastSaved) return true;
  return (
    lastSaved.bookHash !== current.bookHash ||
    lastSaved.currentPage !== current.currentPage ||
    lastSaved.totalPages !== current.totalPages ||
    Math.abs((lastSaved.pageOffsetRatio ?? 0) - (current.pageOffsetRatio ?? 0)) > 0.005
  );
}

/**
 * Calculates the absolute window vertical scroll position to align an element with an offset ratio.
 * Clamped so targetTop is never negative.
 */
export function calculateScrollTargetTop(
  elementRectTop: number,
  elementRectHeight: number,
  currentScrollY: number,
  offsetRatio = 0.0
): number {
  const safeRatio = Math.max(0.0, offsetRatio);
  return Math.max(0, currentScrollY + elementRectTop + elementRectHeight * safeRatio);
}

/**
 * Determines whether a click event in the reader viewport should toggle the chrome bars.
 * Ignores clicks on buttons, inputs, menus, text selections, or active dialogs/popovers.
 */
export function isImmersiveBackgroundClick(
  target: HTMLElement | null,
  hasSelection: boolean,
  hasOpenOverlays: boolean
): boolean {
  if (hasOpenOverlays || hasSelection) {
    return false;
  }
  if (!target) return true;
  return !target.closest('button, [role="button"], input, textarea, pre, [role="menu"]');
}

export interface UseReaderViewReturn {
  readonly isProgrammaticScrollRef: RefObject<boolean>;
  readonly scrollToPage: (pageNum: number) => void;
  readonly handleCloseReader: () => Promise<void>;
  readonly handleViewportClick: (e: React.MouseEvent<HTMLElement>) => void;
  readonly toggleChrome: () => void;
}

export function useReaderView(): UseReaderViewReturn {
  const pagination = useReaderPagination();
  const bookHash = useReaderStore((s) => s.document.bookHash);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const isLoadingPages = useReaderStore((s) => s.isLoadingPages);
  const navigation = useNavigation();
  const library = useLibrary();
  const {
    toggleChrome,
    contextMenu,
    activeNoteDialog,
    activeExplainDialog,
    activeTranslateDialog,
    activeHighlightPopover,
    expandedHighlight,
    closeAllOverlays,
  } = useReaderUI();

  const isProgrammaticScrollRef = useRef(true);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollAlignedRef = useRef<string | null>(null);
  const initialTargetRef = useRef<{ page: number; ratio: number } | null>(null);
  const lastBookHashRef = useRef<string | null>(null);

  // Reset alignment tracking when opening a different book
  if (lastBookHashRef.current !== bookHash) {
    lastBookHashRef.current = bookHash;
    initialScrollAlignedRef.current = null;
    isProgrammaticScrollRef.current = true;
    initialTargetRef.current = null;
  }

  // Freeze target reading page & ratio upon opening before any scroll events can mutate it
  if (!initialTargetRef.current && bookHash) {
    const selectedBook = navigation.selectedBook;
    const isMatchingBook = selectedBook && selectedBook.bookHash === bookHash;
    const storeState = useReaderStore.getState();
    const targetPage = isMatchingBook ? selectedBook.currentPage : storeState.currentPage;
    const targetRatio = isMatchingBook
      ? (selectedBook.pageOffsetRatio ?? 0.0)
      : storeState.pageOffsetRatio || 0.0;

    initialTargetRef.current = {
      page: Math.max(1, targetPage),
      ratio: Math.max(0.0, targetRatio),
    };
  }

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
    };
  }, []);

  // Restore initial scroll position once ReaderStream is mounted and pages are loaded
  useEffect(() => {
    if (!bookHash || initialScrollAlignedRef.current === bookHash) {
      return;
    }

    // Must wait until loading completes and pages are in store/DOM
    if (isLoadingPages || loadedPages.length === 0) {
      return;
    }

    const selectedBook = navigation.selectedBook;
    const target = initialTargetRef.current ?? {
      page: Math.max(
        1,
        selectedBook?.bookHash === bookHash
          ? selectedBook.currentPage
          : useReaderStore.getState().currentPage
      ),
      ratio: Math.max(
        0.0,
        selectedBook?.bookHash === bookHash
          ? (selectedBook.pageOffsetRatio ?? 0.0)
          : useReaderStore.getState().pageOffsetRatio || 0.0
      ),
    };
    const targetPage = target.page;
    const offsetRatio = target.ratio;

    // First page with no offset is naturally aligned at top
    if (targetPage <= 1 && offsetRatio <= 0.0) {
      initialScrollAlignedRef.current = bookHash;
      isProgrammaticScrollRef.current = false;
      return;
    }

    const hasTargetPage = loadedPages.some((p) => p.pageNumber === targetPage);
    if (!hasTargetPage) {
      return;
    }

    if (typeof document === 'undefined') {
      return;
    }

    const el = document.querySelector<HTMLElement>(`article[data-page-number="${targetPage}"]`);
    if (!el) {
      return;
    }

    initialScrollAlignedRef.current = bookHash;
    isProgrammaticScrollRef.current = true;

    const performScroll = () => {
      const rect = el.getBoundingClientRect();
      const targetTop = calculateScrollTargetTop(
        rect.top,
        rect.height,
        window.scrollY,
        offsetRatio
      );

      window.scrollTo({ top: targetTop, behavior: 'instant' });

      // Fallback scrollIntoView if window.scrollTo didn't move (e.g. nested layout constraints)
      if (targetTop > 0 && Math.abs(window.scrollY) < 5) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
        if (offsetRatio > 0.001) {
          const newRect = el.getBoundingClientRect();
          if (newRect.height > 0) {
            window.scrollBy({ top: newRect.height * offsetRatio, behavior: 'instant' });
          }
        }
      }

      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 600);
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(performScroll);
    } else {
      performScroll();
    }
  }, [bookHash, loadedPages, isLoadingPages, navigation.selectedBook]);

  // Sync reading progress to library and backend on departure
  const lastSavedStateRef = useRef<ReadingProgressState | null>(null);

  const saveProgress = useCallback(
    async (bookHash: string, currentPage: number, totalPages: number, pageOffsetRatio: number) => {
      const current = { bookHash, currentPage, totalPages, pageOffsetRatio };
      if (!shouldSaveProgress(lastSavedStateRef.current, current)) {
        return;
      }
      lastSavedStateRef.current = current;
      try {
        await library.updateBookProgress(bookHash, currentPage, totalPages, pageOffsetRatio);
      } catch (err) {
        console.warn('Failed to notify library of book progress:', err);
      }
    },
    [library]
  );

  const persistCurrentProgress = useCallback(async () => {
    const { document: doc, currentPage, totalPages } = useReaderStore.getState();
    if (!doc.bookHash) {
      return;
    }
    const measuredRatio = measureCurrentPageOffsetRatio(currentPage);
    useReaderStore.getState().setPageOffsetRatio(measuredRatio);
    await saveProgress(doc.bookHash, currentPage, totalPages, measuredRatio);
  }, [saveProgress]);

  useEffect(() => {
    return () => {
      void persistCurrentProgress();
    };
  }, [persistCurrentProgress]);

  const handleCloseReader = useCallback(async () => {
    try {
      await persistCurrentProgress();
    } finally {
      closeAllOverlays();
      navigation.closeReader();
    }
  }, [closeAllOverlays, navigation, persistCurrentProgress]);

  // Smooth Page Scrolling Navigation
  const scrollToPage = useCallback(
    (pageNum: number) => {
      const { totalPages } = useReaderStore.getState();
      const target = Math.max(1, Math.min(totalPages, pageNum));
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 900);

      pagination.onPageVisible(target);

      if (target === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const el = document.querySelector(`article[data-page-number="${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        void pagination.goToPage(target).then(() => {
          window.requestAnimationFrame(() => {
            if (target === 1) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              const newEl = document.querySelector(`article[data-page-number="${target}"]`);
              newEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        });
      }
    },
    [pagination]
  );

  // Immersive Click / Tap Toggle for Chrome
  const handleViewportClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const hasOpenOverlays = Boolean(
        contextMenu ||
          activeNoteDialog ||
          activeExplainDialog ||
          activeTranslateDialog ||
          activeHighlightPopover ||
          expandedHighlight
      );

      const selection = window.getSelection();
      const hasSelection = Boolean(
        selection && !selection.isCollapsed && selection.toString().trim().length > 0
      );

      if (isImmersiveBackgroundClick(e.target as HTMLElement, hasSelection, hasOpenOverlays)) {
        toggleChrome();
      }
    },
    [
      activeExplainDialog,
      activeNoteDialog,
      activeTranslateDialog,
      contextMenu,
      activeHighlightPopover,
      expandedHighlight,
      toggleChrome,
    ]
  );

  return {
    isProgrammaticScrollRef,
    scrollToPage,
    handleCloseReader,
    handleViewportClick,
    toggleChrome,
  };
}
