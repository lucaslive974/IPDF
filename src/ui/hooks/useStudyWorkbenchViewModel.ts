import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type { AnnotationFormatterMap } from '../../core/domain/RichAnnotation';
import type { TextFormatStyle } from '../../core/domain/types';
import { useServiceContainer } from '../providers/ServiceContainerContext';

export type AppViewMode = 'library' | 'reader' | 'settings';

export interface StudyDocumentDescriptor {
  readonly bookHash: string;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly chapterTitle: string;
  readonly sampleParagraph: string;
}

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

const DEFAULT_DOCUMENT: StudyDocumentDescriptor = {
  bookHash: 'sha256-plato-republic-book-vii',
  bookTitle: 'The Republic',
  bookAuthor: 'Plato',
  chapterTitle: 'Book VII — Allegory of the Cave',
  sampleParagraph:
    'Behold! human beings living in an underground den, which has a mouth open towards the light ' +
    'and reaching all along the den; here they have been from their childhood, and have their legs ' +
    'and necks chained so that they cannot move, and can only see before them, being prevented by ' +
    'the chains from turning round their heads (noesis vs. doxa).',
};

const FALLBACK_PASSAGE_EXCERPTS = [
  'human beings living in an underground den',
  'mouth open towards the light and reaching all along the den',
  'prevented by the chains from turning round their heads',
];

const createEmptyRect = (): DOMRect =>
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

const ANNOTATION_FORMATTERS: AnnotationFormatterMap<string> = {
  'assisted-markdown': (node) => `[Assisted Text] ${node.rawData}`,
  tldraw: (node) => `[tldraw Board] ${node.rawData} | SVG: ${node.svgPreview}`,
  drawio: (node) => `[draw.io Diagram] ${node.rawData} | SVG: ${node.svgPreview}`,
};

export interface StudyWorkbenchViewModel {
  readonly currentView: AppViewMode;
  readonly document: StudyDocumentDescriptor;
  readonly libraryBooks: BookMetadata[];
  readonly currentPage: number;
  readonly totalPages: number;
  readonly highlights: Highlight[];
  readonly selectedId: string | null;
  readonly activeHighlightPopover: ActiveHighlightPopoverState | null;
  readonly expandedHighlight: Highlight | null;
  readonly selectionPopover: SelectionPopoverState | null;
  readonly noteInput: string;
  readonly formattedAnnotations: string[];
  readonly llmPromptPreview: string;
  readonly syncExportPreview: string;
  setCurrentView(view: AppViewMode): void;
  openReader(book?: BookMetadata): void;
  closeReader(): void;
  openSettings(): void;
  closeSettings(): void;
  selectHighlight(highlightId: string): Promise<void>;
  openHighlightPopover(highlight: Highlight, coords: { x: number; y: number }): void;
  closeHighlightPopover(): void;
  openExpandedHighlightStudio(highlight: Highlight): void;
  closeExpandedHighlightStudio(): void;
  updateNoteDraft(value: string): void;
  updateSelectionRange(start: number, end: number): void;
  createHighlightFromCurrentSelection(color: string): Promise<void>;
  createHighlightWithColor(color: string, overrideText?: string): Promise<void>;
  changeHighlightColor(highlightId: string, colorHex: string): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
  applyAssistedFormat(style: TextFormatStyle): Promise<void>;
  attachVisualBoard(kind: 'tldraw' | 'drawio'): Promise<void>;
  generateContextualPrompt(customText?: string): Promise<void>;
  runCloudlessSync(): Promise<void>;
  importSampleEpubBook(): Promise<void>;
  navigatePage(delta: number): Promise<void>;
  setSelectionPopover(state: SelectionPopoverState | null): void;
}

export function useStudyWorkbenchViewModel(
  document: StudyDocumentDescriptor = DEFAULT_DOCUMENT
): StudyWorkbenchViewModel {
  const { annotationWorkbench, backendGateway } = useServiceContainer();

  const [currentView, setCurrentView] = useState<AppViewMode>('library');
  const [libraryBooks, setLibraryBooks] = useState<BookMetadata[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = 320;

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeHighlightPopover, setActiveHighlightPopover] =
    useState<ActiveHighlightPopoverState | null>(null);
  const [expandedHighlight, setExpandedHighlight] = useState<Highlight | null>(null);
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopoverState | null>(null);

  const selectedIdRef = useRef<string | null>(null);
  const excerptCounterRef = useRef<number>(0);

  const [noteInput, setNoteInput] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [formattedAnnotations, setFormattedAnnotations] = useState<string[]>([]);
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');
  const [llmPromptPreview, setLlmPromptPreview] = useState<string>('');

  const refreshState = useCallback(
    async (activeHighlightId?: string | null, pageNum = 1) => {
      const pageHighlights = annotationWorkbench.getForPage(pageNum);
      setHighlights([...pageHighlights]);

      const targetId = activeHighlightId ?? selectedIdRef.current ?? pageHighlights[0]?.id ?? null;
      if (!targetId) {
        return;
      }

      selectedIdRef.current = targetId;
      setSelectedId(targetId);

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

  useEffect(() => {
    let cancelled = false;
    const initializeBookSession = async () => {
      const books = await backendGateway.listLibraryBooks();
      if (!cancelled) {
        setLibraryBooks(books);
      }
      await annotationWorkbench.loadBookHighlights(document.bookHash);
      if (cancelled) {
        return;
      }
      const existing = annotationWorkbench.getForPage(1);
      if (existing.length === 0) {
        const created = await annotationWorkbench.createFromSelection(
          document.bookHash,
          {
            text: 'noesis vs. doxa',
            surroundingContext: document.sampleParagraph,
            anchor: { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/14!/4/2/1:120)' },
            clientRect: createEmptyRect(),
          },
          '#eab308',
          'Transition from sensory opinion to pure intellection'
        );
        if (!cancelled) {
          await refreshState(created.id, 1);
        }
      } else if (!cancelled) {
        await refreshState(existing[0]?.id, 1);
      }
    };
    void initializeBookSession();
    return () => {
      cancelled = true;
    };
  }, [annotationWorkbench, backendGateway, document, refreshState]);

  const openReader = useCallback((_book?: BookMetadata) => {
    setCurrentView('reader');
  }, []);

  const closeReader = useCallback(() => {
    setCurrentView('library');
    setActiveHighlightPopover(null);
    setSelectionPopover(null);
  }, []);

  const openSettings = useCallback(() => {
    setCurrentView('settings');
  }, []);

  const closeSettings = useCallback(() => {
    setCurrentView('library');
  }, []);

  const selectHighlight = useCallback(
    async (highlightId: string) => {
      await refreshState(highlightId, currentPage);
    },
    [currentPage, refreshState]
  );

  const openHighlightPopover = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      selectedIdRef.current = highlight.id;
      setSelectedId(highlight.id);
      setNoteInput(highlight.note);
      setActiveHighlightPopover({ highlight, x: coords.x, y: coords.y });
    },
    []
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

  const updateNoteDraft = useCallback(
    (value: string) => {
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
            const currentHighlights = annotationWorkbench.getForPage(currentPage);
            setHighlights([...currentHighlights]);
            if (activeHighlightPopover?.highlight.id === currentId) {
              const updated = currentHighlights.find((h) => h.id === currentId);
              if (updated) {
                setActiveHighlightPopover((prev) =>
                  prev ? { ...prev, highlight: updated } : null
                );
              }
            }
          });
      }
    },
    [activeHighlightPopover, annotationWorkbench, currentPage]
  );

  const updateSelectionRange = useCallback((start: number, end: number) => {
    setSelectionRange({ start, end });
  }, []);

  const createHighlightWithColor = useCallback(
    async (color: string, overrideText?: string) => {
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
            pageNumber: currentPage,
            epubCfi: `epubcfi(/6/14!/4/2/${Date.now()}_${excerptCounterRef.current})`,
          },
          clientRect: createEmptyRect(),
        },
        color,
        'Study note'
      );
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      setSelectionPopover(null);
      await refreshState(created.id, currentPage);
    },
    [annotationWorkbench, currentPage, document, refreshState]
  );

  const createHighlightFromCurrentSelection = useCallback(
    async (color: string) => {
      const browserSel =
        typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
      await createHighlightWithColor(color, browserSel);
    },
    [createHighlightWithColor]
  );

  const changeHighlightColor = useCallback(
    async (highlightId: string, colorHex: string) => {
      const target = highlights.find((h) => h.id === highlightId);
      if (!target) {
        return;
      }
      target.changeColor(colorHex);
      await backendGateway.saveHighlight(target);
      await refreshState(highlightId, currentPage);
      if (activeHighlightPopover?.highlight.id === highlightId) {
        setActiveHighlightPopover((prev) => (prev ? { ...prev, highlight: target } : null));
      }
    },
    [activeHighlightPopover, backendGateway, currentPage, highlights, refreshState]
  );

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      await backendGateway.deleteHighlight(highlightId);
      closeHighlightPopover();
      if (expandedHighlight?.id === highlightId) {
        closeExpandedHighlightStudio();
      }
      await annotationWorkbench.loadBookHighlights(document.bookHash);
      await refreshState(null, currentPage);
    },
    [
      annotationWorkbench,
      backendGateway,
      closeExpandedHighlightStudio,
      closeHighlightPopover,
      currentPage,
      document.bookHash,
      expandedHighlight?.id,
      refreshState,
    ]
  );

  const applyAssistedFormat = useCallback(
    async (style: TextFormatStyle) => {
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
      await refreshState(activeId, currentPage);
    },
    [annotationWorkbench, currentPage, noteInput, refreshState, selectionRange]
  );

  const attachVisualBoard = useCallback(
    async (kind: 'tldraw' | 'drawio') => {
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
      await refreshState(activeId, currentPage);
    },
    [annotationWorkbench, currentPage, refreshState]
  );

  const generateContextualPrompt = useCallback(
    async (customText?: string) => {
      const activeId = selectedIdRef.current;
      const active = highlights.find((h) => h.id === activeId);
      const textToQuery = customText ?? active?.text ?? 'noesis';
      const req = await backendGateway.buildTermLookupRequest(
        {
          bookTitle: document.bookTitle,
          bookAuthor: document.bookAuthor,
          chapterTitle: document.chapterTitle,
          selectedText: textToQuery,
          surroundingContext: document.sampleParagraph,
        },
        'en'
      );
      setLlmPromptPreview(JSON.stringify(req, null, 2));
    },
    [backendGateway, document, highlights]
  );

  const runCloudlessSync = useCallback(async () => {
    const exportedJson = await backendGateway.syncBookWorkspace(document.bookHash);
    setSyncExportPreview(exportedJson);
  }, [backendGateway, document.bookHash]);

  const importSampleEpubBook = useCallback(async () => {
    const rawBytes = new TextEncoder().encode('PK\x03\x04kant-critique-pure-reason');
    await backendGateway.importLibraryBook({
      rawBytes,
      title: 'Critique of Pure Reason',
      author: 'Immanuel Kant',
      format: 'epub',
      totalPages: 480,
    });
    const books = await backendGateway.listLibraryBooks();
    setLibraryBooks(books);
  }, [backendGateway]);

  const navigatePage = useCallback(
    async (delta: number) => {
      const next = Math.max(1, Math.min(totalPages, currentPage + delta));
      setCurrentPage(next);
      await backendGateway.updateBookProgress(document.bookHash, next, totalPages);
      const books = await backendGateway.listLibraryBooks();
      setLibraryBooks(books);
      await refreshState(null, next);
    },
    [backendGateway, currentPage, document.bookHash, refreshState]
  );

  return {
    currentView,
    document,
    libraryBooks,
    currentPage,
    totalPages,
    highlights,
    selectedId,
    activeHighlightPopover,
    expandedHighlight,
    selectionPopover,
    noteInput,
    formattedAnnotations,
    llmPromptPreview,
    syncExportPreview,
    setCurrentView,
    openReader,
    closeReader,
    openSettings,
    closeSettings,
    selectHighlight,
    openHighlightPopover,
    closeHighlightPopover,
    openExpandedHighlightStudio,
    closeExpandedHighlightStudio,
    updateNoteDraft,
    updateSelectionRange,
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
    setSelectionPopover,
  };
}
