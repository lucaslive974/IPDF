import type { Highlight } from '@domain/Highlight';
import { BookFormat, type BoundingBox } from '@domain/types';
import { useHighlightStore } from '@stores/useHighlightStore';
import { useReaderStore } from '@stores/useReaderStore';
import { useReaderUIStore } from '@stores/useReaderUIStore';
import { getWindowSelection } from '@utils/dom';
import { getExpandedWordSelection } from '@utils/domSelection';
import { capturePdfSelectionRects } from '@utils/pdfCoordinates';
import { useCallback, useMemo } from 'react';
import { type ReaderHighlightsController, useReaderHighlights } from './useReaderHighlights';

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
    pageNumber?: number,
    pdfRects?: readonly BoundingBox[]
  ): Promise<Highlight | null>;
  createHighlightFromCurrentSelection(colorHex: string): Promise<void>;
}

export interface ReaderTextSelectionDependencies {
  readonly bookHash: string;
  readonly sampleParagraph: string;
  readonly format?: BookFormat;
  readonly readerHighlights: ReaderHighlightsController;
}

export interface ReaderTextSelectionController {
  createHighlight(
    colorHex: string,
    selectedText: string,
    pageNumber: number,
    initialNote?: string,
    pdfRects?: readonly BoundingBox[]
  ): Promise<Highlight | null>;
}

export function createReaderTextSelectionController(
  deps: ReaderTextSelectionDependencies
): ReaderTextSelectionController {
  let counter = 0;

  return {
    async createHighlight(colorHex, selectedText, pageNumber, initialNote, pdfRects) {
      const text = selectedText.trim();
      if (!text) {
        return null;
      }

      const format = deps.format ?? BookFormat.EPUB;
      const anchor =
        format === BookFormat.PDF
          ? {
              format: BookFormat.PDF,
              pageNumber,
              pdfRects: Array.from(
                pdfRects && pdfRects.length > 0
                  ? pdfRects
                  : capturePdfSelectionRects(pageNumber, getWindowSelection())
              ),
            }
          : {
              format: BookFormat.EPUB,
              pageNumber,
              epubCfi: `epubcfi(/6/14!/4/2/${Date.now()}_${counter})`,
            };

      const created = await deps.readerHighlights.createFromSelection(
        deps.bookHash,
        {
          text,
          surroundingContext: deps.sampleParagraph,
          anchor,
          clientRect: createEmptyRect(),
        },
        colorHex,
        initialNote ?? ''
      );

      counter += 1;
      return created;
    },
  };
}

export function useReaderTextSelection(): ReaderTextSelectionState {
  const readerHighlights = useReaderHighlights();
  const bookHash = useReaderStore((s) => s.document.bookHash);
  const sampleParagraph = useReaderStore((s) => s.document.sampleParagraph);
  const format = useReaderStore((s) => s.document.format);
  const selectionPopover = useReaderUIStore((s) => s.selectionPopover);
  const setSelectionPopover = useReaderUIStore((s) => s.setSelectionPopover);
  const setSelectedHighlightId = useHighlightStore((s) => s.setSelectedHighlightId);

  const controller = useMemo(
    () =>
      createReaderTextSelectionController({ bookHash, sampleParagraph, format, readerHighlights }),
    [bookHash, sampleParagraph, format, readerHighlights]
  );

  const createHighlightWithColor = useCallback(
    async (
      colorHex: string,
      overrideText?: string,
      initialNote?: string,
      pageNumber?: number,
      pdfRects?: readonly BoundingBox[]
    ): Promise<Highlight | null> => {
      const browserSel = getExpandedWordSelection(getWindowSelection());
      const selected = overrideText?.trim() || selectionPopover?.text?.trim() || browserSel || '';
      const targetPage = pageNumber ?? useReaderStore.getState().currentPage;

      const created = await controller.createHighlight(
        colorHex,
        selected,
        targetPage,
        initialNote ?? '',
        pdfRects ?? selectionPopover?.pdfRects
      );
      if (!created) {
        return null;
      }

      getWindowSelection()?.removeAllRanges();
      setSelectionPopover(null);
      setSelectedHighlightId(created.id);
      return created;
    },
    [controller, selectionPopover, setSelectionPopover, setSelectedHighlightId]
  );

  const createHighlightFromCurrentSelection = useCallback(
    async (colorHex: string) => {
      const browserSel = getExpandedWordSelection(getWindowSelection());
      await createHighlightWithColor(colorHex, browserSel);
    },
    [createHighlightWithColor]
  );

  return {
    createHighlightWithColor,
    createHighlightFromCurrentSelection,
  };
}
