import { useCallback, useEffect, useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import type { IAnnotationVisitor } from '../../core/domain/RichAnnotation';
import type { TextFormatStyle } from '../../core/domain/types';
import { useServiceContainer } from '../providers/ServiceContainerContext';

export interface StudyDocumentDescriptor {
  readonly bookHash: string;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly chapterTitle: string;
  readonly sampleParagraph: string;
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

export interface StudyWorkbenchViewModel {
  readonly document: StudyDocumentDescriptor;
  readonly highlights: Highlight[];
  readonly selectedId: string | null;
  readonly noteInput: string;
  readonly visitorOutput: string[];
  readonly llmPromptPreview: string;
  readonly syncExportPreview: string;
  selectHighlight(highlightId: string): Promise<void>;
  updateNoteDraft(value: string): void;
  updateSelectionRange(start: number, end: number): void;
  createHighlightFromCurrentSelection(color: string): Promise<void>;
  applyAssistedFormat(style: TextFormatStyle): Promise<void>;
  attachVisualBoard(kind: 'tldraw' | 'drawio'): Promise<void>;
  generateContextualPrompt(): void;
  runCloudlessSync(): Promise<void>;
}

export function useStudyWorkbenchViewModel(
  document: StudyDocumentDescriptor = DEFAULT_DOCUMENT
): StudyWorkbenchViewModel {
  const { highlightManager, syncEngine, portabilityService, jsonStrategy, promptBuilder } =
    useServiceContainer();

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [visitorOutput, setVisitorOutput] = useState<string[]>([]);
  const [syncExportPreview, setSyncExportPreview] = useState<string>('');
  const [llmPromptPreview, setLlmPromptPreview] = useState<string>('');

  const refreshState = useCallback(
    async (activeHighlightId?: string | null) => {
      const pageHighlights = highlightManager.getForPage(1);
      setHighlights([...pageHighlights]);

      const targetId = activeHighlightId ?? selectedId ?? pageHighlights[0]?.id ?? null;
      if (!targetId) {
        return;
      }

      setSelectedId(targetId);
      const found = pageHighlights.find((h) => h.id === targetId);
      if (found) {
        setNoteInput(found.note);
        const visitor: IAnnotationVisitor<string> = {
          visitAssistedText: (node) => `[Assisted Text] ${node.rawData}`,
          visitTldrawBoard: (node) => `[tldraw Board] ${node.rawData} | SVG: ${node.svgPreview}`,
          visitDrawioDiagram: (node) =>
            `[draw.io Diagram] ${node.rawData} | SVG: ${node.svgPreview}`,
        };
        setVisitorOutput(highlightManager.visitHighlightAnnotations(targetId, visitor));
      }
    },
    [highlightManager, selectedId]
  );

  useEffect(() => {
    const initializeBookSession = async () => {
      await highlightManager.loadBookHighlights(document.bookHash);
      const existing = highlightManager.getForPage(1);
      if (existing.length === 0) {
        const created = await highlightManager.createFromSelection(
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
        await refreshState(created.id);
      } else {
        await refreshState(existing[0].id);
      }
    };
    void initializeBookSession();
  }, [document, highlightManager, refreshState]);

  const selectHighlight = useCallback(
    async (highlightId: string) => {
      await refreshState(highlightId);
    },
    [refreshState]
  );

  const updateNoteDraft = useCallback((value: string) => {
    setNoteInput(value);
  }, []);

  const updateSelectionRange = useCallback((start: number, end: number) => {
    setSelectionRange({ start, end });
  }, []);

  const createHighlightFromCurrentSelection = useCallback(
    async (color: string) => {
      const browserSel = window.getSelection()?.toString().trim();
      const textToHighlight =
        browserSel && browserSel.length > 0
          ? browserSel
          : 'human beings living in an underground den';

      const created = await highlightManager.createFromSelection(
        document.bookHash,
        {
          text: textToHighlight,
          surroundingContext: document.sampleParagraph,
          anchor: {
            format: 'epub',
            pageNumber: 1,
            epubCfi: `epubcfi(/6/14!/4/2/${Date.now()})`,
          },
          clientRect: createEmptyRect(),
        },
        color,
        'New section study annotation'
      );
      await refreshState(created.id);
    },
    [document, highlightManager, refreshState]
  );

  const applyAssistedFormat = useCallback(
    async (style: TextFormatStyle) => {
      if (!selectedId) {
        return;
      }
      await highlightManager.interactWithAnnotation(selectedId, 'assisted-markdown', {
        target: 'assisted-markdown',
        action: 'replace-text',
        text: noteInput,
      });

      const range =
        selectionRange.end > selectionRange.start
          ? selectionRange
          : { start: 0, end: noteInput.length };

      await highlightManager.interactWithAnnotation(selectedId, 'assisted-markdown', {
        target: 'assisted-markdown',
        action: 'apply-format',
        selectionRange: range,
        formatStyle: style,
      });
      await refreshState(selectedId);
    },
    [highlightManager, noteInput, refreshState, selectedId, selectionRange]
  );

  const attachVisualBoard = useCallback(
    async (kind: 'tldraw' | 'drawio') => {
      if (!selectedId) {
        return;
      }
      if (kind === 'tldraw') {
        await highlightManager.interactWithAnnotation(selectedId, 'tldraw', {
          target: 'tldraw',
          action: 'save-snapshot',
          snapshotJson: '{"shapes":[{"type":"arrow","from":"Doxa","to":"Noesis"}]}',
          svgPreview: '<svg viewBox="0 0 120 40"><text>tldraw: Doxa -> Noesis</text></svg>',
        });
      } else {
        await highlightManager.interactWithAnnotation(selectedId, 'drawio', {
          target: 'drawio',
          action: 'save-diagram',
          xmlOrJsonDiagram:
            '<mxGraphModel><root><mxCell id="intelligible-realm"/></root></mxGraphModel>',
          svgPreview: '<svg viewBox="0 0 120 40"><text>draw.io: Divided Line</text></svg>',
        });
      }
      await refreshState(selectedId);
    },
    [highlightManager, refreshState, selectedId]
  );

  const generateContextualPrompt = useCallback(() => {
    const active = highlights.find((h) => h.id === selectedId);
    const req = promptBuilder.buildTermLookupRequest(
      {
        bookTitle: document.bookTitle,
        bookAuthor: document.bookAuthor,
        chapterTitle: document.chapterTitle,
        selectedText: active?.text ?? 'noesis',
        surroundingContext: document.sampleParagraph,
      },
      'en'
    );
    setLlmPromptPreview(JSON.stringify(req, null, 2));
  }, [document, highlights, promptBuilder, selectedId]);

  const runCloudlessSync = useCallback(async () => {
    await syncEngine.syncBookState(document.bookHash);
    const exported = await portabilityService.exportData(
      { bookHashes: [document.bookHash], includeBookFiles: false, format: 'json-only' },
      jsonStrategy
    );
    setSyncExportPreview(
      typeof exported === 'string'
        ? JSON.stringify(JSON.parse(exported), null, 2)
        : 'Binary Uint8Array'
    );
  }, [document.bookHash, jsonStrategy, portabilityService, syncEngine]);

  return {
    document,
    highlights,
    selectedId,
    noteInput,
    visitorOutput,
    llmPromptPreview,
    syncExportPreview,
    selectHighlight,
    updateNoteDraft,
    updateSelectionRange,
    createHighlightFromCurrentSelection,
    applyAssistedFormat,
    attachVisualBoard,
    generateContextualPrompt,
    runCloudlessSync,
  };
}
