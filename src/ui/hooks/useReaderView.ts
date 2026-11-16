import { useNavigation } from '@providers/NavigationContext';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { useLibraryStore } from '@stores/useLibraryStore';
import { useReaderStore } from '@stores/useReaderStore';
import { useReaderUIStore } from '@stores/useReaderUIStore';
import { appLogger } from '@utils/logger';
import { useCallback, useEffect, useRef } from 'react';

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

export interface UseReaderViewOptions {
  readonly onClose?: () => void;
}

export function useReaderView(options?: UseReaderViewOptions): UseReaderViewReturn {
  const navigation = useNavigation();
  const { readerService } = useServiceContainer();
  const upsertBook = useLibraryStore((s) => s.upsertBook);
  const toggleChrome = useReaderUIStore((s) => s.toggleChrome);
  const closeAllOverlays = useReaderUIStore((s) => s.closeAllOverlays);

  const saveProgress = useCallback(
    async (bookHash: string, currentPage: number, totalPages: number, pageOffsetRatio: number) => {
      try {
        const updated = await readerService.updateBookProgress(
          bookHash,
          currentPage,
          totalPages,
          pageOffsetRatio
        );
        upsertBook(updated);
      } catch (err) {
        appLogger.warn(`Failed to notify library of book progress: ${String(err)}`, 'reader');
      }
    },
    [readerService, upsertBook]
  );

  const persistCurrentProgress = useCallback(async () => {
    const { document: doc, currentPage, totalPages, pageOffsetRatio } = useReaderStore.getState();
    if (!doc.bookHash) {
      return;
    }
    await saveProgress(doc.bookHash, currentPage, totalPages, pageOffsetRatio);
  }, [saveProgress]);

  const persistRef = useRef(persistCurrentProgress);
  persistRef.current = persistCurrentProgress;

  useEffect(() => {
    return () => {
      void persistRef.current();
      useReaderStore.getState().reset();
    };
  }, []);

  const handleCloseReader = useCallback(async () => {
    try {
      await persistCurrentProgress();
    } finally {
      closeAllOverlays();
      useReaderStore.getState().reset();
      if (options?.onClose) {
        options.onClose();
      } else {
        navigation.closeReader();
      }
    }
  }, [closeAllOverlays, navigation, persistCurrentProgress, options?.onClose]);

  const handleViewportClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const uiState = useReaderUIStore.getState();
      const hasOpenOverlays = Boolean(
        uiState.contextMenu ||
          uiState.activeNoteDialog ||
          uiState.activeExplainDialog ||
          uiState.activeTranslateDialog ||
          uiState.activeHighlightPopover ||
          uiState.expandedHighlight
      );

      const selection = window.getSelection();
      const hasSelection = Boolean(
        selection && !selection.isCollapsed && selection.toString().trim().length > 0
      );

      if (isImmersiveBackgroundClick(e.target as HTMLElement, hasSelection, hasOpenOverlays)) {
        toggleChrome();
      }
    },
    [toggleChrome]
  );

  return {
    handleCloseReader,
    handleViewportClick,
    toggleChrome,
  };
}
