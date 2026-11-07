import type { Highlight } from '@domain/Highlight';
import { useReader } from '@providers/ReaderContext';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useReaderStore } from '@stores/useReaderStore';
import { useReaderUIStore } from '@stores/useReaderUIStore';
import { getExpandedWordSelection } from '@utils/domSelection';
import { useCallback, useMemo } from 'react';
import type { ReaderHighlightsController } from './useReaderHighlights';

export const createEmptyRect = (): DOMRect =>
  ({
    x: 0,
    y: 0,
    width: 120,
    height: 20,
    top: 0,
    right: 120,
    bottom: 20,
    left: 0,
    toJSON: () => ({}),
  }) as DOMRect;

export interface ReaderTextSelectionState {
  createHighlightWithColor(
    colorHex: string,
    overrideText?: string,
    initialNote?: string,
    pageNumber?: number
  ): Promise<Highlight | null>;
  createHighlightFromCurrentSelection(colorHex: string): Promise<void>;
}

export interface ReaderTextSelectionDependencies {
  readonly bookHash: string;
  readonly sampleParagraph: string;
  readonly readerHighlights: ReaderHighlightsController;
}

export interface ReaderTextSelectionController {
  createHighlight(
    colorHex: string,
    selectedText: string,
    pageNumber: number,
    initialNote?: string
  ): Promise<Highlight | null>;
}

export function createReaderTextSelectionController(
  deps: ReaderTextSelectionDependencies
): ReaderTextSelectionController {
  let counter = 0;

  return {
    async createHighlight(colorHex, selectedText, pageNumber, initialNote = '') {
      const text = selectedText.trim();
      if (!text) {
        return null;
      }

      const created = await deps.readerHighlights.createFromSelection(
        deps.bookHash,
        {
          text,
          surroundingContext: deps.sampleParagraph,
          anchor: {
            format: 'epub',
            pageNumber,
            epubCfi: `epubcfi(/6/14!/4/2/${Date.now()}_${counter})`,
          },
          clientRect: createEmptyRect(),
        },
        colorHex,
        initialNote
      );

      counter += 1;
      return created;
    },
  };
}

export function useReaderTextSelection(): ReaderTextSelectionState {
  const { highlights: readerHighlights } = useReader();
  const bookHash = useReaderStore((s) => s.document.bookHash);
  const sampleParagraph = useReaderStore((s) => s.document.sampleParagraph);
  const selectionPopover = useReaderUIStore((s) => s.selectionPopover);
  const setSelectionPopover = useReaderUIStore((s) => s.setSelectionPopover);
  const setSelectedHighlightId = useHighlightStore((s) => s.setSelectedHighlightId);

  const controller = useMemo(
    () => createReaderTextSelectionController({ bookHash, sampleParagraph, readerHighlights }),
    [bookHash, sampleParagraph, readerHighlights]
  );

  const createHighlightWithColor = useCallback(
    async (
      colorHex: string,
      overrideText?: string,
      initialNote?: string,
      pageNumber?: number
    ): Promise<Highlight | null> => {
      const browserSel =
        typeof window !== 'undefined' ? getExpandedWordSelection(window.getSelection()) : '';
      const selected = overrideText?.trim() || selectionPopover?.text?.trim() || browserSel || '';
      const targetPage = pageNumber ?? useReaderStore.getState().currentPage;

      const created = await controller.createHighlight(
        colorHex,
        selected,
        targetPage,
        initialNote ?? ''
      );
      if (!created) {
        return null;
      }

      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      setSelectionPopover(null);
      setSelectedHighlightId(created.id);
      return created;
    },
    [controller, selectionPopover, setSelectionPopover, setSelectedHighlightId]
  );

  const createHighlightFromCurrentSelection = useCallback(
    async (colorHex: string) => {
      const browserSel =
        typeof window !== 'undefined' ? getExpandedWordSelection(window.getSelection()) : '';
      await createHighlightWithColor(colorHex, browserSel);
    },
    [createHighlightWithColor]
  );

  return {
    createHighlightWithColor,
    createHighlightFromCurrentSelection,
  };
}
