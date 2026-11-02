import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { useLibrary } from './useLibrary';
import { useNavigation } from './useNavigation';
import { useReader } from './useReader';
import { useReaderUI } from './useReaderUI';

export interface ReadingProgressState {
  readonly bookHash: string;
  readonly currentPage: number;
  readonly totalPages: number;
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
    lastSaved.totalPages !== current.totalPages
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

  // Prevent initial mount reflow from overriding restored page number
  useEffect(() => {
    isProgrammaticScrollRef.current = true;
    const timer = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Sync reading progress to library and backend on departure
  const lastSavedStateRef = useRef<ReadingProgressState | null>(null);

  const saveProgress = useCallback(
    async (bookHash: string, currentPage: number, totalPages: number) => {
      const current = { bookHash, currentPage, totalPages };
      if (!shouldSaveProgress(lastSavedStateRef.current, current)) {
        return;
      }
      lastSavedStateRef.current = current;
      try {
        await library.updateBookProgress(bookHash, currentPage, totalPages);
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
  });

  useEffect(() => {
    lastStateRef.current = {
      bookHash: reader.document.bookHash,
      currentPage: reader.currentPage,
      totalPages: reader.totalPages,
    };
  }, [reader.document.bookHash, reader.currentPage, reader.totalPages]);

  useEffect(() => {
    return () => {
      const { bookHash, currentPage, totalPages } = lastStateRef.current;
      if (bookHash) {
        void saveProgress(bookHash, currentPage, totalPages);
      }
    };
  }, [saveProgress]);

  const handleCloseReader = useCallback(async () => {
    try {
      if (reader.document.bookHash) {
        await saveProgress(reader.document.bookHash, reader.currentPage, reader.totalPages);
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
