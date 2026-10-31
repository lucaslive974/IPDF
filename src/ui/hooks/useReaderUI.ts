import {
  type ActiveHighlightPopoverState,
  type ContextMenuState,
  type SelectionPopoverState,
  type TextDialogState,
  useReaderUIStore,
} from '../stores/useReaderUIStore';

export type {
  ActiveHighlightPopoverState,
  ContextMenuState,
  SelectionPopoverState,
  TextDialogState,
};

export function useReaderUI() {
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
  const openHighlightPopover = useReaderUIStore((s) => s.openHighlightPopover);
  const closeHighlightPopover = useReaderUIStore((s) => s.closeHighlightPopover);
  const openExpandedStudio = useReaderUIStore((s) => s.openExpandedStudio);
  const closeExpandedStudio = useReaderUIStore((s) => s.closeExpandedStudio);
  const setContextMenu = useReaderUIStore((s) => s.setContextMenu);
  const setActiveNoteDialog = useReaderUIStore((s) => s.setActiveNoteDialog);
  const setActiveExplainDialog = useReaderUIStore((s) => s.setActiveExplainDialog);
  const setActiveTranslateDialog = useReaderUIStore((s) => s.setActiveTranslateDialog);
  const closeAllOverlays = useReaderUIStore((s) => s.closeAllOverlays);

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
    setContextMenu,
    setActiveNoteDialog,
    setActiveExplainDialog,
    setActiveTranslateDialog,
    closeAllOverlays,
  };
}
