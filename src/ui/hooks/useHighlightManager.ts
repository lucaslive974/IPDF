import { useCallback, useRef, useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import type { TextFormatStyle } from '../../core/domain/types';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import {
  ANNOTATION_FORMATTERS,
  FALLBACK_PASSAGE_EXCERPTS,
  type StudyDocumentDescriptor,
  createEmptyRect,
} from './studyWorkbenchTypes';

export interface HighlightManagerHook {
  readonly highlights: Highlight[];
  readonly selectedId: string | null;
  readonly noteInput: string;
  readonly formattedAnnotations: string[];
  refreshState(activeHighlightId?: string | null, pageNum?: number): Promise<void>;
  selectHighlight(highlightId: string, pageNum?: number): Promise<void>;
  setNoteDraft(note: string): void;
  setSelectedId(id: string | null): void;
  updateNoteDraft(value: string, pageNum: number, onUpdated?: (updated: Highlight) => void): void;
  updateSelectionRange(start: number, end: number): void;
  createHighlightWithColor(
    color: string,
    document: StudyDocumentDescriptor,
    pageNum: number,
    overrideText?: string
  ): Promise<Highlight>;
  createHighlightFromCurrentSelection(
    color: string,
    document: StudyDocumentDescriptor,
    pageNum: number
  ): Promise<Highlight>;
  changeHighlightColor(
    highlightId: string,
    colorHex: string,
    pageNum: number
  ): Promise<Highlight | null>;
  deleteHighlight(highlightId: string, bookHash: string, pageNum: number): Promise<void>;
  applyAssistedFormat(style: TextFormatStyle, pageNum: number): Promise<void>;
  attachVisualBoard(kind: 'tldraw' | 'drawio', pageNum: number): Promise<void>;
}

export function useHighlightManager(): HighlightManagerHook {
  const { annotationWorkbench, backendGateway } = useServiceContainer();

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [formattedAnnotations, setFormattedAnnotations] = useState<string[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const selectedIdRef = useRef<string | null>(null);
  const excerptCounterRef = useRef<number>(0);

  const setSelectedId = useCallback((id: string | null) => {
    selectedIdRef.current = id;
    setSelectedIdState(id);
  }, []);

  const setNoteDraft = useCallback((note: string) => {
    setNoteInput(note);
  }, []);

  const refreshState = useCallback(
    async (activeHighlightId?: string | null, pageNum = 1) => {
      const pageHighlights = annotationWorkbench.getForPage(pageNum);
      setHighlights([...pageHighlights]);

      const targetId = activeHighlightId ?? selectedIdRef.current ?? pageHighlights[0]?.id ?? null;
      if (!targetId) {
        return;
      }

      selectedIdRef.current = targetId;
      setSelectedIdState(targetId);

      const found = pageHighlights.find((h) => h.id === targetId);
      if (found) {
        setNoteInput(found.note);
        setFormattedAnnotations(
          annotationWorkbench.formatHighlightAnnotations(targetId, ANNOTATION_FORMATTERS)
        );
      }
    },
    [annotationWorkbench]
  );

  const selectHighlight = useCallback(
    async (highlightId: string, pageNum = 1) => {
      await refreshState(highlightId, pageNum);
    },
    [refreshState]
  );

  const updateNoteDraft = useCallback(
    (value: string, pageNum: number, onUpdated?: (updated: Highlight) => void) => {
      setNoteInput(value);
      const currentId = selectedIdRef.current;
      if (currentId) {
        void annotationWorkbench
          .interactWithAnnotation(currentId, 'assisted-markdown', {
            target: 'assisted-markdown',
            action: 'replace-text',
            text: value,
          })
          .then(() => {
            setFormattedAnnotations(
              annotationWorkbench.formatHighlightAnnotations(currentId, ANNOTATION_FORMATTERS)
            );
            const currentHighlights = annotationWorkbench.getForPage(pageNum);
            setHighlights([...currentHighlights]);
            const updated = currentHighlights.find((h) => h.id === currentId);
            if (updated && onUpdated) {
              onUpdated(updated);
            }
          });
      }
    },
    [annotationWorkbench]
  );

  const updateSelectionRange = useCallback((start: number, end: number) => {
    setSelectionRange({ start, end });
  }, []);

  const createHighlightWithColor = useCallback(
    async (
      color: string,
      document: StudyDocumentDescriptor,
      pageNum: number,
      overrideText?: string
    ): Promise<Highlight> => {
      const fallbackExcerpt =
        FALLBACK_PASSAGE_EXCERPTS[excerptCounterRef.current % FALLBACK_PASSAGE_EXCERPTS.length] ??
        'human beings living in an underground den';
      excerptCounterRef.current += 1;

      const textToHighlight =
        overrideText && overrideText.trim().length > 0 ? overrideText.trim() : fallbackExcerpt;

      const created = await annotationWorkbench.createFromSelection(
        document.bookHash,
        {
          text: textToHighlight,
          surroundingContext: document.sampleParagraph,
          anchor: {
            format: 'epub',
            pageNumber: pageNum,
            epubCfi: `epubcfi(/6/14!/4/2/${Date.now()}_${excerptCounterRef.current})`,
          },
          clientRect: createEmptyRect(),
        },
        color,
        'Study note'
      );

      await refreshState(created.id, pageNum);
      return created;
    },
    [annotationWorkbench, refreshState]
  );

  const createHighlightFromCurrentSelection = useCallback(
    async (
      color: string,
      document: StudyDocumentDescriptor,
      pageNum: number
    ): Promise<Highlight> => {
      const browserSel =
        typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
      return createHighlightWithColor(color, document, pageNum, browserSel);
    },
    [createHighlightWithColor]
  );

  const changeHighlightColor = useCallback(
    async (highlightId: string, colorHex: string, pageNum: number): Promise<Highlight | null> => {
      const target = highlights.find((h) => h.id === highlightId);
      if (!target) {
        return null;
      }
      target.changeColor(colorHex);
      await backendGateway.saveHighlight(target);
      await refreshState(highlightId, pageNum);
      return target;
    },
    [backendGateway, highlights, refreshState]
  );

  const deleteHighlight = useCallback(
    async (highlightId: string, bookHash: string, pageNum: number): Promise<void> => {
      await backendGateway.deleteHighlight(highlightId);
      await annotationWorkbench.loadBookHighlights(bookHash);
      await refreshState(null, pageNum);
    },
    [annotationWorkbench, backendGateway, refreshState]
  );

  const applyAssistedFormat = useCallback(
    async (style: TextFormatStyle, pageNum: number) => {
      const activeId = selectedIdRef.current;
      if (!activeId) {
        return;
      }
      await annotationWorkbench.interactWithAnnotation(activeId, 'assisted-markdown', {
        target: 'assisted-markdown',
        action: 'replace-text',
        text: noteInput,
      });

      const range =
        selectionRange.end > selectionRange.start
          ? selectionRange
          : { start: 0, end: noteInput.length };

      await annotationWorkbench.interactWithAnnotation(activeId, 'assisted-markdown', {
        target: 'assisted-markdown',
        action: 'apply-format',
        selectionRange: range,
        formatStyle: style,
      });
      setSelectionRange({ start: 0, end: 0 });
      await refreshState(activeId, pageNum);
    },
    [annotationWorkbench, noteInput, refreshState, selectionRange]
  );

  const attachVisualBoard = useCallback(
    async (kind: 'tldraw' | 'drawio', pageNum: number) => {
      const activeId = selectedIdRef.current;
      if (!activeId) {
        return;
      }
      if (kind === 'tldraw') {
        await annotationWorkbench.interactWithAnnotation(activeId, 'tldraw', {
          target: 'tldraw',
          action: 'save-snapshot',
          snapshotJson: '{"shapes":[{"type":"arrow","from":"Doxa","to":"Noesis"}]}',
          svgPreview: '<svg viewBox="0 0 120 40"><text>tldraw: Doxa -> Noesis</text></svg>',
        });
      } else {
        await annotationWorkbench.interactWithAnnotation(activeId, 'drawio', {
          target: 'drawio',
          action: 'save-diagram',
          xmlOrJsonDiagram:
            '<mxGraphModel><root><mxCell id="intelligible-realm"/></root></mxGraphModel>',
          svgPreview: '<svg viewBox="0 0 120 40"><text>draw.io: Divided Line</text></svg>',
        });
      }
      await refreshState(activeId, pageNum);
    },
    [annotationWorkbench, refreshState]
  );

  return {
    highlights,
    selectedId,
    noteInput,
    formattedAnnotations,
    refreshState,
    selectHighlight,
    setNoteDraft,
    setSelectedId,
    updateNoteDraft,
    updateSelectionRange,
    createHighlightWithColor,
    createHighlightFromCurrentSelection,
    changeHighlightColor,
    deleteHighlight,
    applyAssistedFormat,
    attachVisualBoard,
  };
}
