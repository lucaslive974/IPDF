import { useNavigation } from '@providers/NavigationContext';
import { useReaderStore } from '@stores/useReaderStore';
import { useCallback, useEffect } from 'react';
import { useLibrary } from './useLibrary';
import { useReaderUI } from './useReaderUI';

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
  readonly handleCloseReader: () => Promise<void>;
  readonly handleViewportClick: (e: React.MouseEvent<HTMLElement>) => void;
  readonly toggleChrome: () => void;
}

export function useReaderView(): UseReaderViewReturn {
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
    const { document: doc, currentPage, totalPages, pageOffsetRatio } = useReaderStore.getState();
    if (!doc.bookHash) {
      return;
    }
    await saveProgress(doc.bookHash, currentPage, totalPages, pageOffsetRatio);
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
    handleCloseReader,
    handleViewportClick,
    toggleChrome,
  };
}
