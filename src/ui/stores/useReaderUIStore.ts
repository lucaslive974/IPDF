import { create } from 'zustand';
import type { Highlight } from '../../core/domain/Highlight';

export interface SelectionPopoverState {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export interface ActiveHighlightPopoverState {
  readonly highlight: Highlight;
  readonly x: number;
  readonly y: number;
}

export interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly pageNumber: number;
}

export interface TextDialogState {
  readonly text: string;
  readonly pageNumber: number;
}

export interface ReaderUIState {
  readonly isChromeVisible: boolean;
  readonly selectionPopover: SelectionPopoverState | null;
  readonly activeHighlightPopover: ActiveHighlightPopoverState | null;
  readonly expandedHighlight: Highlight | null;
  readonly contextMenu: ContextMenuState | null;
  readonly activeNoteDialog: TextDialogState | null;
  readonly activeExplainDialog: TextDialogState | null;
  readonly activeTranslateDialog: TextDialogState | null;

  setChromeVisible(visible: boolean): void;
  toggleChrome(): void;
  setSelectionPopover(state: SelectionPopoverState | null): void;
  openHighlightPopover(highlight: Highlight, coords: { x: number; y: number }): void;
  closeHighlightPopover(): void;
  openExpandedStudio(highlight: Highlight): void;
  closeExpandedStudio(): void;
  setContextMenu(state: ContextMenuState | null): void;
  setActiveNoteDialog(state: TextDialogState | null): void;
  setActiveExplainDialog(state: TextDialogState | null): void;
  setActiveTranslateDialog(state: TextDialogState | null): void;
  closeAllOverlays(): void;
  reset(): void;
}

export const useReaderUIStore = create<ReaderUIState>((set) => ({
  isChromeVisible: false,
  selectionPopover: null,
  activeHighlightPopover: null,
  expandedHighlight: null,
  contextMenu: null,
  activeNoteDialog: null,
  activeExplainDialog: null,
  activeTranslateDialog: null,

  setChromeVisible: (isChromeVisible) => set({ isChromeVisible }),

  toggleChrome: () => set((state) => ({ isChromeVisible: !state.isChromeVisible })),

  setSelectionPopover: (selectionPopover) => set({ selectionPopover }),

  openHighlightPopover: (highlight, coords) =>
    set({
      activeHighlightPopover: {
        highlight,
        x: coords.x,
        y: coords.y,
      },
    }),

  closeHighlightPopover: () => set({ activeHighlightPopover: null }),

  openExpandedStudio: (expandedHighlight) => set({ expandedHighlight }),

  closeExpandedStudio: () => set({ expandedHighlight: null }),

  setContextMenu: (contextMenu) => set({ contextMenu }),

  setActiveNoteDialog: (activeNoteDialog) => set({ activeNoteDialog }),

  setActiveExplainDialog: (activeExplainDialog) => set({ activeExplainDialog }),

  setActiveTranslateDialog: (activeTranslateDialog) => set({ activeTranslateDialog }),

  closeAllOverlays: () =>
    set({
      selectionPopover: null,
      activeHighlightPopover: null,
      contextMenu: null,
      activeNoteDialog: null,
      activeExplainDialog: null,
      activeTranslateDialog: null,
    }),

  reset: () =>
    set({
      isChromeVisible: false,
      selectionPopover: null,
      activeHighlightPopover: null,
      expandedHighlight: null,
      contextMenu: null,
      activeNoteDialog: null,
      activeExplainDialog: null,
      activeTranslateDialog: null,
    }),
}));
