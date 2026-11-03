import { useNavigation } from '@providers/NavigationContext';
import { useReaderStore } from '@stores/useReaderStore';
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { useLibrary } from './useLibrary';
import { useReader } from './useReader';
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
  const reader = useReader();
  const navigation = useNavigation();
  const library = useLibrary();
  const {
    toggleChrome,
    contextMenu,
    activeNoteDialog,
    activeExplainDialog,
    activeTranslateDialog,
    closeAllOverlays,
  } = useReaderUI();

  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollAlignedRef = useRef<string | null>(null);

  // Prevent initial mount reflow from overriding restored page number
  useEffect(() => {
    isProgrammaticScrollRef.current = true;
    const timer = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Restore initial scroll position to the target page when opening a book
  useEffect(() => {
    const bookHash = reader.document.bookHash;
    const targetPage = reader.currentPage;
    const offsetRatio = reader.pageOffsetRatio || 0.0;
    if (
      !bookHash ||
      (targetPage <= 1 && offsetRatio <= 0.0) ||
      initialScrollAlignedRef.current === bookHash
    ) {
      return;
    }

    const hasTargetPage = reader.loadedPages.some((p) => p.pageNumber === targetPage);
    if (!hasTargetPage) {
      return;
    }

    if (typeof document !== 'undefined') {
      const el = document.querySelector<HTMLElement>(`article[data-page-number="${targetPage}"]`);
      if (el) {
        initialScrollAlignedRef.current = bookHash;
        isProgrammaticScrollRef.current = true;
        if (Math.abs(offsetRatio) > 0.0001) {
          const rect = el.getBoundingClientRect();
          const targetTop = Math.max(0, window.scrollY + rect.top + rect.height * offsetRatio);
          window.scrollTo({ top: targetTop, behavior: 'instant' });
        } else {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
        const timer = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [reader.document.bookHash, reader.currentPage, reader.pageOffsetRatio, reader.loadedPages]);

  // Sync reading progress to library and backend on departure
  const lastSavedStateRef = useRef<ReadingProgressState | null>(null);

  const saveProgress = useCallback(
    async (bookHash: string, currentPage: number, totalPages: number, pageOffsetRatio?: number) => {
      const ratio = pageOffsetRatio ?? useReaderStore.getState().pageOffsetRatio ?? 0.0;
      const current = { bookHash, currentPage, totalPages, pageOffsetRatio: ratio };
      if (!shouldSaveProgress(lastSavedStateRef.current, current)) {
        return;
      }
      lastSavedStateRef.current = current;
      try {
        await library.updateBookProgress(bookHash, currentPage, totalPages, ratio);
      } catch (err) {
        console.warn('Failed to notify library of book progress:', err);
      }
    },
    [library]
  );

  const lastStateRef = useRef<ReadingProgressState>({
    bookHash: reader.document.bookHash,
    currentPage: reader.currentPage,
    totalPages: reader.totalPages,
    pageOffsetRatio: reader.pageOffsetRatio,
  });

  useEffect(() => {
    lastStateRef.current = {
      bookHash: reader.document.bookHash,
      currentPage: reader.currentPage,
      totalPages: reader.totalPages,
      pageOffsetRatio: reader.pageOffsetRatio,
    };
  }, [reader.document.bookHash, reader.currentPage, reader.totalPages, reader.pageOffsetRatio]);

  useEffect(() => {
    return () => {
      const { bookHash, currentPage, totalPages, pageOffsetRatio } = lastStateRef.current;
      if (bookHash) {
        void saveProgress(bookHash, currentPage, totalPages, pageOffsetRatio);
      }
    };
  }, [saveProgress]);

  const handleCloseReader = useCallback(async () => {
    try {
      if (reader.document.bookHash) {
        await saveProgress(
          reader.document.bookHash,
          reader.currentPage,
          reader.totalPages,
          reader.pageOffsetRatio
        );
      }
    } finally {
      closeAllOverlays();
      navigation.closeReader();
    }
  }, [
    closeAllOverlays,
    navigation,
    reader.currentPage,
    reader.document.bookHash,
    reader.pageOffsetRatio,
    reader.totalPages,
    saveProgress,
  ]);

  // Smooth Page Scrolling Navigation
  const scrollToPage = useCallback(
    (pageNum: number) => {
      const target = Math.max(1, Math.min(reader.totalPages, pageNum));
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 900);

      reader.onPageVisible(target);

      if (target === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const el = document.querySelector(`article[data-page-number="${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        void reader.goToPage(target).then(() => {
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
    [reader]
  );

  // Immersive Click / Tap Toggle for Chrome
  const handleViewportClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const hasOpenOverlays = Boolean(
        contextMenu ||
          activeNoteDialog ||
          activeExplainDialog ||
          activeTranslateDialog ||
          reader.activeHighlightPopover ||
          reader.expandedHighlight
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
      reader.activeHighlightPopover,
      reader.expandedHighlight,
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
