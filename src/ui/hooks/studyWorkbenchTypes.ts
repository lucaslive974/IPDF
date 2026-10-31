import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type { AnnotationFormatterMap } from '../../core/domain/RichAnnotation';
import type { TextFormatStyle } from '../../core/domain/types';

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

export const DEFAULT_DOCUMENT: StudyDocumentDescriptor = {
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

export const FALLBACK_PASSAGE_EXCERPTS = [
  'human beings living in an underground den',
  'mouth open towards the light and reaching all along the den',
  'prevented by the chains from turning round their heads',
];

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
