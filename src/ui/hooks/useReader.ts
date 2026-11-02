import { useCallback, useMemo, useRef } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type { TextFormatStyle } from '../../core/domain/types';
import type { DocumentPage } from '../../core/ports/IReaderService';
import { useServiceContainer } from '../providers/ServiceContainerContext';
import { useHighlightStore } from '../stores/useHighlightStore';
import { EMPTY_DOCUMENT, type StudyDocumentDescriptor } from '../stores/useReaderStore';
import {
  type ActiveHighlightPopoverState,
  type SelectionPopoverState,
  useReaderUIStore,
} from '../stores/useReaderUIStore';
import { useReaderHighlights } from './useReaderHighlights';
import { useReaderNotesEditor } from './useReaderNotesEditor';
import { useReaderPagination } from './useReaderPagination';
import { createEmptyRect, useReaderTextSelection } from './useReaderTextSelection';

export { EMPTY_DOCUMENT, createEmptyRect };
export type { StudyDocumentDescriptor, SelectionPopoverState, ActiveHighlightPopoverState };

export interface ReaderViewModel {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly chapterTitle: string;
  readonly paragraphs: readonly string[];
  readonly loadedPages: readonly DocumentPage[];
  readonly isLoadingPages: boolean;
  readonly highlights: readonly Highlight[];
  readonly selectedId: string | null;
  readonly noteInput: string;
  readonly selectionPopover: SelectionPopoverState | null;
  readonly activeHighlightPopover: ActiveHighlightPopoverState | null;
  readonly expandedHighlight: Highlight | null;
  readonly llmPromptPreview: string;

  navigatePage(delta: number): Promise<void>;
  goToPage(targetPage: number): Promise<void>;
  loadMorePages(direction: 'next' | 'prev'): Promise<void>;
  onPageVisible(pageNumber: number): void;
  getHighlightsForPage(pageNumber: number): Highlight[];
  selectHighlight(id: string): Promise<void>;
  setSelectionPopover(state: SelectionPopoverState | null): void;
  openHighlightPopover(highlight: Highlight, coords: { x: number; y: number }): void;
  closeHighlightPopover(): void;
  openExpandedStudio(highlight: Highlight): void;
  closeExpandedStudio(): void;
  createHighlightWithColor(
    colorHex: string,
    overrideText?: string,
    initialNote?: string,
    pageNumber?: number
  ): Promise<Highlight | null>;
  createHighlightFromCurrentSelection(colorHex: string): Promise<void>;
  changeHighlightColor(highlightId: string, colorHex: string): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
  updateNoteDraft(value: string): void;
  updateSelectionRange(start: number, end: number): void;
  applyAssistedFormat(style: TextFormatStyle): Promise<void>;
  generateContextualPrompt(customText?: string): Promise<void>;
}

export type ReaderContextValue = ReaderViewModel;

export function useReader(bookOverride?: BookMetadata | null): ReaderViewModel {
  const { highlightService } = useServiceContainer();
  const readerHighlights = useReaderHighlights(highlightService);

  // Highlight Store
  const highlights = useHighlightStore((s) => s.highlights);
  const selectedId = useHighlightStore((s) => s.selectedHighlightId);
  const noteInput = useHighlightStore((s) => s.noteInput);
  const upsertHighlight = useHighlightStore((s) => s.upsertHighlight);
  const setSelectedId = useHighlightStore((s) => s.setSelectedHighlightId);
  const setNoteInput = useHighlightStore((s) => s.setNoteInput);

  // UI Store
  const selectionPopover = useReaderUIStore((s) => s.selectionPopover);
  const activeHighlightPopover = useReaderUIStore((s) => s.activeHighlightPopover);
  const expandedHighlight = useReaderUIStore((s) => s.expandedHighlight);
  const setSelectionPopover = useReaderUIStore((s) => s.setSelectionPopover);
  const openHighlightPopoverStore = useReaderUIStore((s) => s.openHighlightPopover);
  const closeHighlightPopover = useReaderUIStore((s) => s.closeHighlightPopover);
  const openExpandedStudioStore = useReaderUIStore((s) => s.openExpandedStudio);
  const closeExpandedStudio = useReaderUIStore((s) => s.closeExpandedStudio);

  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

  // Memoized page highlights map
  const pageHighlightsMap = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    for (const h of highlights) {
      const pageNum = h.anchor.pageNumber;
      const list = map.get(pageNum);
      if (list) {
        list.push(h);
      } else {
        map.set(pageNum, [h]);
      }
    }
    return map;
  }, [highlights]);

  const emptyHighlights: Highlight[] = useMemo(() => [], []);

  const getHighlightsForPage = useCallback(
    (pageNumber: number): Highlight[] => {
      return pageHighlightsMap.get(pageNumber) ?? emptyHighlights;
    },
    [pageHighlightsMap, emptyHighlights]
  );

  const refreshState = useCallback(
    async (activeHighlightId?: string | null, pageNum?: number) => {
      const pageHighlights = pageHighlightsMap.get(pageNum ?? 1) ?? [];
      const targetId = activeHighlightId ?? selectedIdRef.current ?? pageHighlights[0]?.id ?? null;
      if (!targetId) return;

      selectedIdRef.current = targetId;
      setSelectedId(targetId);

      const found = highlights.find((h) => h.id === targetId);
      if (found) {
        setNoteInput(found.note);
      }
    },
    [highlights, pageHighlightsMap, setNoteInput, setSelectedId]
  );

  // Sub-hook 1: Pagination
  const pagination = useReaderPagination({
    bookOverride,
    onBookLoaded: async (hash) => {
      await readerHighlights.loadBookHighlights(hash);
    },
    onPageChanged: async (pageNum) => {
      await refreshState(null, pageNum);
    },
  });

  // Sub-hook 2: Text Selection
  const selection = useReaderTextSelection({
    bookHash: pagination.document.bookHash,
    sampleParagraph: pagination.document.sampleParagraph,
    currentPage: pagination.currentPage,
    readerHighlights,
    onHighlightCreated: async (created, pageNum) => {
      await refreshState(created.id, pageNum);
    },
  });

  // Sub-hook 3: Notes Editor & AI
  const notesEditor = useReaderNotesEditor({
    document: pagination.document,
    highlights,
    selectedId,
    noteInput,
    setNoteInput,
    updateHighlightNote: async (id, note) => {
      await readerHighlights.updateHighlightNote(id, note);
    },
    onFormatApplied: async (id) => {
      await refreshState(id, pagination.currentPage);
    },
  });

  const selectHighlight = useCallback(
    async (id: string) => {
      await refreshState(id, pagination.currentPage);
    },
    [pagination.currentPage, refreshState]
  );

  const openHighlightPopover = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      selectedIdRef.current = highlight.id;
      setSelectedId(highlight.id);
      setNoteInput(highlight.note);
      openHighlightPopoverStore(highlight, coords);
    },
    [openHighlightPopoverStore, setNoteInput, setSelectedId]
  );

  const openExpandedStudio = useCallback(
    (highlight: Highlight) => {
      openExpandedStudioStore(highlight);
      closeHighlightPopover();
    },
    [closeHighlightPopover, openExpandedStudioStore]
  );

  const changeHighlightColor = useCallback(
    async (highlightId: string, colorHex: string) => {
      const target = highlights.find((h) => h.id === highlightId);
      if (!target) return;

      target.changeColor(colorHex);
      await highlightService.saveHighlight(target);
      upsertHighlight(target);
      await refreshState(highlightId, pagination.currentPage);
    },
    [highlightService, pagination.currentPage, highlights, refreshState, upsertHighlight]
  );

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      closeHighlightPopover();
      if (expandedHighlight?.id === highlightId) {
        closeExpandedStudio();
      }
      await readerHighlights.deleteHighlight(highlightId);
      await refreshState(null, pagination.currentPage);
    },
    [
      readerHighlights,
      closeExpandedStudio,
      closeHighlightPopover,
      pagination.currentPage,
      expandedHighlight?.id,
      refreshState,
    ]
  );

  return {
    ...pagination,
    ...selection,
    ...notesEditor,
    highlights,
    selectedId,
    selectionPopover,
    activeHighlightPopover,
    expandedHighlight,
    getHighlightsForPage,
    selectHighlight,
    setSelectionPopover,
    openHighlightPopover,
    closeHighlightPopover,
    openExpandedStudio,
    closeExpandedStudio,
    changeHighlightColor,
    deleteHighlight,
  };
}
