import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type { AnnotationFormatterMap } from '../../core/domain/RichAnnotation';
import type { TextFormatStyle } from '../../core/domain/types';
import { useServiceContainer } from './ServiceContainerContext';

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

export const DEFAULT_BOOK_HASH = '8c8bf2ed9bff65aaf226bf5db3879eb378a26e72489bd28666abc01c02f2a0c2';

export const DEFAULT_DOCUMENT: StudyDocumentDescriptor = {
  bookHash: DEFAULT_BOOK_HASH,
  bookTitle: 'The Republic',
  bookAuthor: 'Plato',
  chapterTitle: 'Book VII — Allegory of the Cave',
  sampleParagraph:
    'Behold! human beings living in an underground den, which has a mouth open towards the light ' +
    'and reaching all along the den; here they have been from their childhood, and have their legs ' +
    'and necks chained so that they cannot move, and can only see before them, being prevented by ' +
    'the chains from turning round their heads (noesis vs. doxa).',
};

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

export const ANNOTATION_FORMATTERS: AnnotationFormatterMap<string> = {
  'assisted-markdown': (node) => `[Assisted Text] ${node.rawData}`,
  tldraw: (node) => `[tldraw Board] ${node.rawData} | SVG: ${node.svgPreview}`,
  drawio: (node) => `[draw.io Diagram] ${node.rawData} | SVG: ${node.svgPreview}`,
};

export interface ReaderContextValue {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly highlights: Highlight[];
  readonly selectedId: string | null;
  readonly noteInput: string;
  readonly formattedAnnotations: string[];
  readonly selectionPopover: SelectionPopoverState | null;
  readonly activeHighlightPopover: ActiveHighlightPopoverState | null;
  readonly expandedHighlight: Highlight | null;
  readonly llmPromptPreview: string;
  navigatePage(delta: number): Promise<void>;
  selectHighlight(id: string): Promise<void>;
  setSelectionPopover(state: SelectionPopoverState | null): void;
  openHighlightPopover(highlight: Highlight, coords: { x: number; y: number }): void;
  closeHighlightPopover(): void;
  openExpandedStudio(highlight: Highlight): void;
  closeExpandedStudio(): void;
  createHighlightWithColor(
    colorHex: string,
    overrideText?: string,
    initialNote?: string
  ): Promise<Highlight | null>;
  createHighlightFromCurrentSelection(colorHex: string): Promise<void>;
  changeHighlightColor(highlightId: string, colorHex: string): Promise<void>;
  deleteHighlight(highlightId: string): Promise<void>;
  updateNoteDraft(value: string): void;
  updateSelectionRange(start: number, end: number): void;
  applyAssistedFormat(style: TextFormatStyle): Promise<void>;
  attachVisualBoard(kind: 'tldraw' | 'drawio'): Promise<void>;
  generateContextualPrompt(customText?: string): Promise<void>;
}

export const ReaderContext = createContext<ReaderContextValue | null>(null);

export interface ReaderProviderProps {
  readonly children: ReactNode;
  readonly book?: BookMetadata | null;
}

export function ReaderProvider({ children, book }: ReaderProviderProps) {
  const { annotationWorkbench, backendGateway } = useServiceContainer();

  const [document] = useState<StudyDocumentDescriptor>(() => {
    if (book) {
      return {
        bookHash: book.bookHash,
        bookTitle: book.title,
        bookAuthor: book.author,
        chapterTitle: `Chapter ${book.currentPage} &mdash; Reading Session`,
        sampleParagraph:
          book.bookHash === DEFAULT_BOOK_HASH
            ? DEFAULT_DOCUMENT.sampleParagraph
            : `Reading "${book.title}" by ${book.author}. Select any passage in the text to create persistent highlights, add margin notes, or consult AI explanations.`,
      };
    }
    return DEFAULT_DOCUMENT;
  });

  const [currentPage, setCurrentPage] = useState<number>(book?.currentPage || 1);
  const totalPages = book?.totalPages || 320;

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');
  const [formattedAnnotations, setFormattedAnnotations] = useState<string[]>([]);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const [selectionPopover, setSelectionPopover] = useState<SelectionPopoverState | null>(null);
  const [activeHighlightPopover, setActiveHighlightPopover] =
    useState<ActiveHighlightPopoverState | null>(null);
  const [expandedHighlight, setExpandedHighlight] = useState<Highlight | null>(null);
  const [llmPromptPreview, setLlmPromptPreview] = useState<string>('');

  const selectedIdRef = useRef<string | null>(null);
  const excerptCounterRef = useRef<number>(0);

  const refreshState = useCallback(
    async (activeHighlightId?: string | null, pageNum = currentPage) => {
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
    [annotationWorkbench, currentPage]
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrapReader = async () => {
      await annotationWorkbench.loadBookHighlights(document.bookHash);
      if (cancelled) return;

      const existing = annotationWorkbench.getForPage(currentPage);
      await refreshState(existing[0]?.id ?? null, currentPage);
    };

    void bootstrapReader();

    return () => {
      cancelled = true;
    };
  }, [annotationWorkbench, currentPage, document, refreshState]);

  const navigatePage = useCallback(
    async (delta: number) => {
      const next = Math.max(1, Math.min(totalPages, currentPage + delta));
      setCurrentPage(next);
      await backendGateway.updateBookProgress(document.bookHash, next, totalPages);
      await refreshState(null, next);
    },
    [backendGateway, currentPage, document.bookHash, refreshState, totalPages]
  );

  const selectHighlight = useCallback(
    async (id: string) => {
      await refreshState(id, currentPage);
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

  const openExpandedStudio = useCallback((highlight: Highlight) => {
    setExpandedHighlight(highlight);
    setActiveHighlightPopover(null);
  }, []);

  const closeExpandedStudio = useCallback(() => {
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
            const updated = currentHighlights.find((h) => h.id === currentId);
            if (updated) {
              setActiveHighlightPopover((prev) =>
                prev && prev.highlight.id === currentId ? { ...prev, highlight: updated } : prev
              );
              setExpandedHighlight((prev) => (prev && prev.id === currentId ? updated : prev));
            }
          });
      }
    },
    [annotationWorkbench, currentPage]
  );

  const updateSelectionRange = useCallback((start: number, end: number) => {
    setSelectionRange({ start, end });
  }, []);

  const createHighlightWithColor = useCallback(
    async (
      colorHex: string,
      overrideText?: string,
      initialNote?: string
    ): Promise<Highlight | null> => {
      const selected =
        overrideText?.trim() ||
        selectionPopover?.text?.trim() ||
        (typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '') ||
        '';

      if (!selected) {
        return null;
      }

      const textToHighlight = selected;

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
        colorHex,
        initialNote ?? 'Study note'
      );

      excerptCounterRef.current += 1;

      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
      setSelectionPopover(null);
      await refreshState(created.id, currentPage);
      return created;
    },
    [annotationWorkbench, currentPage, document, refreshState, selectionPopover]
  );

  const createHighlightFromCurrentSelection = useCallback(
    async (colorHex: string) => {
      const browserSel =
        typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
      await createHighlightWithColor(colorHex, browserSel);
    },
    [createHighlightWithColor]
  );

  const changeHighlightColor = useCallback(
    async (highlightId: string, colorHex: string) => {
      const target = highlights.find((h) => h.id === highlightId);
      if (!target) return;

      target.changeColor(colorHex);
      await backendGateway.saveHighlight(target);
      await refreshState(highlightId, currentPage);

      setActiveHighlightPopover((prev) =>
        prev && prev.highlight.id === highlightId ? { ...prev, highlight: target } : prev
      );
      setExpandedHighlight((prev) => (prev && prev.id === highlightId ? target : prev));
    },
    [backendGateway, currentPage, highlights, refreshState]
  );

  const deleteHighlight = useCallback(
    async (highlightId: string) => {
      closeHighlightPopover();
      if (expandedHighlight?.id === highlightId) {
        closeExpandedStudio();
      }
      await backendGateway.deleteHighlight(highlightId);
      await annotationWorkbench.loadBookHighlights(document.bookHash);
      await refreshState(null, currentPage);
    },
    [
      annotationWorkbench,
      backendGateway,
      closeExpandedStudio,
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
      if (!activeId) return;

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
      if (!activeId) return;

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

  const value = useMemo<ReaderContextValue>(
    () => ({
      document,
      currentPage,
      totalPages,
      highlights,
      selectedId,
      noteInput,
      formattedAnnotations,
      selectionPopover,
      activeHighlightPopover,
      expandedHighlight,
      llmPromptPreview,
      navigatePage,
      selectHighlight,
      setSelectionPopover,
      openHighlightPopover,
      closeHighlightPopover,
      openExpandedStudio,
      closeExpandedStudio,
      createHighlightWithColor,
      createHighlightFromCurrentSelection,
      changeHighlightColor,
      deleteHighlight,
      updateNoteDraft,
      updateSelectionRange,
      applyAssistedFormat,
      attachVisualBoard,
      generateContextualPrompt,
    }),
    [
      document,
      currentPage,
      totalPages,
      highlights,
      selectedId,
      noteInput,
      formattedAnnotations,
      selectionPopover,
      activeHighlightPopover,
      expandedHighlight,
      llmPromptPreview,
      navigatePage,
      selectHighlight,
      openHighlightPopover,
      closeHighlightPopover,
      openExpandedStudio,
      closeExpandedStudio,
      createHighlightWithColor,
      createHighlightFromCurrentSelection,
      changeHighlightColor,
      deleteHighlight,
      updateNoteDraft,
      updateSelectionRange,
      applyAssistedFormat,
      attachVisualBoard,
      generateContextualPrompt,
    ]
  );

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReaderContext(): ReaderContextValue {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error('useReaderContext must be used within a ReaderProvider');
  }
  return context;
}
