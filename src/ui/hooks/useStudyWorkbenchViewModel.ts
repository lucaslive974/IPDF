import { useCallback } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type { TextFormatStyle } from '../../core/domain/types';
import {
  DEFAULT_DOCUMENT,
  type SelectionPopoverState,
  type StudyDocumentDescriptor,
  type StudyWorkbenchViewModel,
} from './studyWorkbenchTypes';
import { useAppNavigation } from './useAppNavigation';
import { useHighlightInteraction } from './useHighlightInteraction';
import { useHighlightManager } from './useHighlightManager';
import { useLibraryCatalog } from './useLibraryCatalog';
import { useReaderSession } from './useReaderSession';
import { useStudyAssistant } from './useStudyAssistant';
import { useStudyLifecycle } from './useStudyLifecycle';

export type {
  AppViewMode,
  StudyDocumentDescriptor,
  SelectionPopoverState,
  ActiveHighlightPopoverState,
  StudyWorkbenchViewModel,
} from './studyWorkbenchTypes';
export {
  DEFAULT_DOCUMENT,
  FALLBACK_PASSAGE_EXCERPTS,
  ANNOTATION_FORMATTERS,
  createEmptyRect,
} from './studyWorkbenchTypes';

export function useStudyWorkbenchViewModel(
  initialDocument: StudyDocumentDescriptor = DEFAULT_DOCUMENT
): StudyWorkbenchViewModel {
  const highlightManager = useHighlightManager();

  const interactions = useHighlightInteraction((h: Highlight) => {
    highlightManager.setSelectedId(h.id);
    highlightManager.setNoteDraft(h.note);
  });

  const navigation = useAppNavigation('library', () => {
    interactions.clearAllInteractions();
  });

  const session = useReaderSession(initialDocument);
  const catalog = useLibraryCatalog();
  const assistant = useStudyAssistant();

  useStudyLifecycle({
    document: session.document,
    loadBooks: catalog.loadBooks,
    refreshState: highlightManager.refreshState,
  });

  const selectHighlight = useCallback(
    async (highlightId: string) => {
      await highlightManager.selectHighlight(highlightId, session.currentPage);
    },
    [highlightManager, session.currentPage]
  );

  const openHighlightPopover = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      highlightManager.setSelectedId(highlight.id);
      highlightManager.setNoteDraft(highlight.note);
      interactions.openHighlightPopover(highlight, coords);
    },
    [highlightManager, interactions]
  );

  const updateNoteDraft = useCallback(
    (value: string) => {
      highlightManager.updateNoteDraft(value, session.currentPage, (updated) => {
        interactions.syncUpdatedHighlight(updated);
      });
    },
    [highlightManager, interactions, session.currentPage]
  );

  const createHighlightWithColor = useCallback(
    async (color: string, overrideText?: string) => {
      await highlightManager.createHighlightWithColor(
        color,
        session.document,
        session.currentPage,
        overrideText
      );
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      interactions.setSelectionPopover(null);
    },
    [highlightManager, interactions, session.currentPage, session.document]
  );

  const createHighlightFromCurrentSelection = useCallback(
    async (color: string) => {
      await highlightManager.createHighlightFromCurrentSelection(
        color,
        session.document,
        session.currentPage
      );
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      interactions.setSelectionPopover(null);
    },
    [highlightManager, interactions, session.currentPage, session.document]
  );

  const changeHighlightColor = useCallback(
    async (highlightId: string, colorHex: string) => {
      const updated = await highlightManager.changeHighlightColor(
        highlightId,
        colorHex,
        session.currentPage
      );
      if (updated) {
        interactions.syncUpdatedHighlight(updated);
      }
    },
    [highlightManager, interactions, session.currentPage]
  );

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      interactions.closeHighlightPopover();
      if (interactions.expandedHighlight?.id === highlightId) {
        interactions.closeExpandedHighlightStudio();
      }
      await highlightManager.deleteHighlight(
        highlightId,
        session.document.bookHash,
        session.currentPage
      );
    },
    [highlightManager, interactions, session.currentPage, session.document.bookHash]
  );

  const applyAssistedFormat = useCallback(
    async (style: TextFormatStyle) => {
      await highlightManager.applyAssistedFormat(style, session.currentPage);
    },
    [highlightManager, session.currentPage]
  );

  const attachVisualBoard = useCallback(
    async (kind: 'tldraw' | 'drawio') => {
      await highlightManager.attachVisualBoard(kind, session.currentPage);
    },
    [highlightManager, session.currentPage]
  );

  const generateContextualPrompt = useCallback(
    async (customText?: string) => {
      const active =
        interactions.activeHighlightPopover?.highlight ??
        highlightManager.highlights.find((h) => h.id === highlightManager.selectedId);
      await assistant.generateContextualPrompt(session.document, active, customText);
    },
    [
      assistant,
      highlightManager.highlights,
      highlightManager.selectedId,
      interactions.activeHighlightPopover?.highlight,
      session.document,
    ]
  );

  const runCloudlessSync = useCallback(async () => {
    await assistant.runCloudlessSync(session.document.bookHash);
  }, [assistant, session.document.bookHash]);

  const importSampleEpubBook = useCallback(async () => {
    await catalog.importSampleEpubBook();
  }, [catalog]);

  const navigatePage = useCallback(
    async (delta: number) => {
      await session.navigatePage(delta, async (nextPage) => {
        await catalog.loadBooks();
        await highlightManager.refreshState(null, nextPage);
      });
    },
    [catalog, highlightManager, session]
  );

  const openReader = useCallback(
    (book?: BookMetadata) => {
      navigation.openReader(book);
    },
    [navigation]
  );

  return {
    currentView: navigation.currentView,
    document: session.document,
    libraryBooks: catalog.libraryBooks,
    currentPage: session.currentPage,
    totalPages: session.totalPages,
    highlights: highlightManager.highlights,
    selectedId: highlightManager.selectedId,
    activeHighlightPopover: interactions.activeHighlightPopover,
    expandedHighlight: interactions.expandedHighlight,
    selectionPopover: interactions.selectionPopover,
    noteInput: highlightManager.noteInput,
    formattedAnnotations: highlightManager.formattedAnnotations,
    llmPromptPreview: assistant.llmPromptPreview,
    syncExportPreview: assistant.syncExportPreview,
    setCurrentView: navigation.setCurrentView,
    openReader,
    closeReader: navigation.closeReader,
    openSettings: navigation.openSettings,
    closeSettings: navigation.closeSettings,
    selectHighlight,
    openHighlightPopover,
    closeHighlightPopover: interactions.closeHighlightPopover,
    openExpandedHighlightStudio: interactions.openExpandedHighlightStudio,
    closeExpandedHighlightStudio: interactions.closeExpandedHighlightStudio,
    updateNoteDraft,
    updateSelectionRange: highlightManager.updateSelectionRange,
    createHighlightFromCurrentSelection,
    createHighlightWithColor,
    changeHighlightColor,
    deleteHighlight,
    applyAssistedFormat,
    attachVisualBoard,
    generateContextualPrompt,
    runCloudlessSync,
    importSampleEpubBook,
    navigatePage,
    setSelectionPopover: interactions.setSelectionPopover,
  };
}
