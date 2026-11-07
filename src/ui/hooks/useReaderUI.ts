import type { Highlight } from '@domain/Highlight';
import { useReader } from '@providers/ReaderContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import {
  type ActiveHighlightPopoverState,
  type ContextMenuState,
  type SelectionPopoverState,
  type TextDialogState,
  useReaderUIStore,
} from '@stores/useReaderUIStore';
import { useCallback } from 'react';

export type {
  ActiveHighlightPopoverState,
  ContextMenuState,
  SelectionPopoverState,
  TextDialogState,
};

export function useReaderUI() {
  const { highlights } = useReader();
  const setSelectedHighlightId = useHighlightStore((s) => s.setSelectedHighlightId);

  const isChromeVisible = useReaderUIStore((s) => s.isChromeVisible);
  const selectionPopover = useReaderUIStore((s) => s.selectionPopover);
  const activeHighlightPopover = useReaderUIStore((s) => s.activeHighlightPopover);
  const expandedHighlight = useReaderUIStore((s) => s.expandedHighlight);
  const contextMenu = useReaderUIStore((s) => s.contextMenu);
  const activeNoteDialog = useReaderUIStore((s) => s.activeNoteDialog);
  const activeExplainDialog = useReaderUIStore((s) => s.activeExplainDialog);
  const activeTranslateDialog = useReaderUIStore((s) => s.activeTranslateDialog);

  const toggleChrome = useReaderUIStore((s) => s.toggleChrome);
  const setChromeVisible = useReaderUIStore((s) => s.setChromeVisible);
  const setSelectionPopover = useReaderUIStore((s) => s.setSelectionPopover);
  const openHighlightPopoverStore = useReaderUIStore((s) => s.openHighlightPopover);
  const closeHighlightPopover = useReaderUIStore((s) => s.closeHighlightPopover);
  const openExpandedStudioStore = useReaderUIStore((s) => s.openExpandedStudio);
  const closeExpandedStudio = useReaderUIStore((s) => s.closeExpandedStudio);
  const setContextMenu = useReaderUIStore((s) => s.setContextMenu);
  const setActiveNoteDialog = useReaderUIStore((s) => s.setActiveNoteDialog);
  const setActiveExplainDialog = useReaderUIStore((s) => s.setActiveExplainDialog);
  const setActiveTranslateDialog = useReaderUIStore((s) => s.setActiveTranslateDialog);
  const closeAllOverlays = useReaderUIStore((s) => s.closeAllOverlays);

  const openHighlightPopover = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      setSelectedHighlightId(highlight.id);
      openHighlightPopoverStore(highlight, coords);
    },
    [openHighlightPopoverStore, setSelectedHighlightId]
  );

  const openExpandedStudio = useCallback(
    (highlight: Highlight) => {
      setSelectedHighlightId(highlight.id);
      openExpandedStudioStore(highlight);
      closeHighlightPopover();
    },
    [closeHighlightPopover, openExpandedStudioStore, setSelectedHighlightId]
  );

  const changeHighlightColor = useCallback(
    async (highlightId: string, colorHex: string) => {
      await highlights.updateHighlightColor(highlightId, colorHex);
    },
    [highlights]
  );

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      closeHighlightPopover();
      if (useReaderUIStore.getState().expandedHighlight?.id === highlightId) {
        closeExpandedStudio();
      }
      await highlights.deleteHighlight(highlightId);
    },
    [closeExpandedStudio, closeHighlightPopover, highlights]
  );

  return {
    isChromeVisible,
    selectionPopover,
    activeHighlightPopover,
    expandedHighlight,
    contextMenu,
    activeNoteDialog,
    activeExplainDialog,
    activeTranslateDialog,
    toggleChrome,
    setChromeVisible,
    setSelectionPopover,
    openHighlightPopover,
    closeHighlightPopover,
    openExpandedStudio,
    closeExpandedStudio,
    changeHighlightColor,
    deleteHighlight,
    setContextMenu,
    setActiveNoteDialog,
    setActiveExplainDialog,
    setActiveTranslateDialog,
    closeAllOverlays,
  };
}
