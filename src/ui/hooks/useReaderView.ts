import { useReaderPagination } from '@hooks/useReaderPagination';
import { useNavigation } from '@providers/NavigationContext';
import { useReaderStore } from '@stores/useReaderStore';
import { clamp } from '@utils/math';
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { useLibrary } from './useLibrary';
import { measureCurrentPageOffsetRatio } from './useReaderFocalPageTracker';
import { useReaderUI } from './useReaderUI';

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
  return Math.max(0, currentScrollY + elementRectTop + elementRectHeight * offsetRatio);
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

export function useReaderView(isStreamReady: boolean): UseReaderViewReturn {
  const pagination = useReaderPagination();
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
  const hasAlignedScrollRef = useRef(false);

  // Restore initial scroll position once ReaderStream is mounted and pages are loaded
  useEffect(() => {
    // Must wait until loading completes and pages are in store/DOM
    if (!isStreamReady) {
      return;
    }

    const { currentPage, pageOffsetRatio } = useReaderStore.getState();
    const targetPage = Math.max(1, currentPage);
    const offsetRatio = clamp(pageOffsetRatio, -1.0, 1.0);

    // First page with no offset is naturally aligned at top
    if (targetPage <= 1 && offsetRatio <= 0.0) {
      hasAlignedScrollRef.current = true;
      isProgrammaticScrollRef.current = false;
      return;
    }

    const el = document.querySelector<HTMLElement>(`article[data-page-number="${targetPage}"]`);
    // Empty book or page not yet in DOM
    if (!el) {
      return;
    }

    hasAlignedScrollRef.current = true;
    isProgrammaticScrollRef.current = true;
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 600);

    const rect = el.getBoundingClientRect();
    const targetTop = calculateScrollTargetTop(rect.top, rect.height, window.scrollY, offsetRatio);

    window.scrollTo({ top: targetTop, behavior: 'instant' });
  }, [isStreamReady]);

  const saveProgress = useCallback(
    async (bookHash: string, currentPage: number, totalPages: number, pageOffsetRatio: number) => {
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
      const target = clamp(pageNum, 1, totalPages);

      isProgrammaticScrollRef.current = true;
      setTimeout(() => {
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
