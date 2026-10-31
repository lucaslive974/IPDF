import { useCallback, useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import type { ActiveHighlightPopoverState, SelectionPopoverState } from './studyWorkbenchTypes';

export interface HighlightInteractionHook {
  readonly activeHighlightPopover: ActiveHighlightPopoverState | null;
  readonly expandedHighlight: Highlight | null;
  readonly selectionPopover: SelectionPopoverState | null;
  setSelectionPopover(state: SelectionPopoverState | null): void;
  openHighlightPopover(highlight: Highlight, coords: { x: number; y: number }): void;
  closeHighlightPopover(): void;
  openExpandedHighlightStudio(highlight: Highlight): void;
  closeExpandedHighlightStudio(): void;
  syncUpdatedHighlight(updated: Highlight): void;
  clearAllInteractions(): void;
}

export function useHighlightInteraction(
  onHighlightSelected?: (highlight: Highlight) => void
): HighlightInteractionHook {
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopoverState | null>(null);
  const [activeHighlightPopover, setActiveHighlightPopover] =
    useState<ActiveHighlightPopoverState | null>(null);
  const [expandedHighlight, setExpandedHighlight] = useState<Highlight | null>(null);

  const openHighlightPopover = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      onHighlightSelected?.(highlight);
      setActiveHighlightPopover({ highlight, x: coords.x, y: coords.y });
    },
    [onHighlightSelected]
  );

  const closeHighlightPopover = useCallback(() => {
    setActiveHighlightPopover(null);
  }, []);

  const openExpandedHighlightStudio = useCallback((highlight: Highlight) => {
    setExpandedHighlight(highlight);
    setActiveHighlightPopover(null);
  }, []);

  const closeExpandedHighlightStudio = useCallback(() => {
    setExpandedHighlight(null);
  }, []);

  const syncUpdatedHighlight = useCallback((updated: Highlight) => {
    setActiveHighlightPopover((prev) =>
      prev && prev.highlight.id === updated.id ? { ...prev, highlight: updated } : prev
    );
    setExpandedHighlight((prev) => (prev && prev.id === updated.id ? updated : prev));
  }, []);

  const clearAllInteractions = useCallback(() => {
    setSelectionPopover(null);
    setActiveHighlightPopover(null);
    setExpandedHighlight(null);
  }, []);

  return {
    activeHighlightPopover,
    expandedHighlight,
    selectionPopover,
    setSelectionPopover,
    openHighlightPopover,
    closeHighlightPopover,
    openExpandedHighlightStudio,
    closeExpandedHighlightStudio,
    syncUpdatedHighlight,
    clearAllInteractions,
  };
}
