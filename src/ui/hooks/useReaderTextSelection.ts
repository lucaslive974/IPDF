import type { Highlight } from '@domain/Highlight';
import { useReaderUIStore } from '@stores/useReaderUIStore';
import { getExpandedWordSelection } from '@utils/domSelection';
import { useCallback, useMemo, useRef } from 'react';
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

export interface UseReaderTextSelectionOptions {
  readonly bookHash: string;
  readonly sampleParagraph: string;
  readonly currentPage: number;
  readonly readerHighlights: ReaderHighlightsController;
  readonly onHighlightCreated?: (highlight: Highlight, pageNumber: number) => Promise<void> | void;
}

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

export function useReaderTextSelection(
  options: UseReaderTextSelectionOptions
): ReaderTextSelectionState {
  const { bookHash, sampleParagraph, currentPage, readerHighlights, onHighlightCreated } = options;

  const controller = useMemo(
    () =>
      createReaderTextSelectionController({
        bookHash,
        sampleParagraph,
        readerHighlights,
      }),
    [bookHash, sampleParagraph, readerHighlights]
  );

  const selectionPopover = useReaderUIStore((s) => s.selectionPopover);
  const setSelectionPopover = useReaderUIStore((s) => s.setSelectionPopover);
  const onHighlightCreatedRef = useRef(onHighlightCreated);
  onHighlightCreatedRef.current = onHighlightCreated;

  const createHighlightWithColor = useCallback(
    async (
      colorHex: string,
      overrideText?: string,
      initialNote?: string,
      pageNumber = currentPage
    ): Promise<Highlight | null> => {
      const browserSel =
        typeof window !== 'undefined' ? getExpandedWordSelection(window.getSelection()) : '';
      const selected = overrideText?.trim() || selectionPopover?.text?.trim() || browserSel || '';

      const created = await controller.createHighlight(
        colorHex,
        selected,
        pageNumber,
        initialNote ?? ''
      );

      if (!created) {
        return null;
      }

      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      setSelectionPopover(null);

      if (onHighlightCreatedRef.current) {
        await onHighlightCreatedRef.current(created, pageNumber);
      }

      return created;
    },
    [controller, currentPage, selectionPopover, setSelectionPopover]
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
