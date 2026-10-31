export type BookFormat = 'epub' | 'pdf';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HighlightAnchor {
  format: BookFormat;
  pageNumber: number;
  epubCfi?: string;
  pdfRects?: BoundingBox[];
}

export interface TextSelection {
  text: string;
  surroundingContext: string;
  anchor: HighlightAnchor;
  clientRect: DOMRect;
}

export interface PageInfo {
  currentPage: number;
  totalPages: number;
  chapterTitle?: string;
  percentage: number;
}

export interface SentenceNode {
  id: string;
  text: string;
  anchor: HighlightAnchor;
}

export type RichAnnotationType = 'assisted-markdown' | 'tldraw' | 'drawio';

export type TextFormatStyle =
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'underline' }
  | { kind: 'strikethrough' }
  | { kind: 'textColor'; colorHex: string }
  | { kind: 'backgroundColor'; colorHex: string }
  | { kind: 'heading'; level: 1 | 2 | 3 }
  | { kind: 'bulletList' }
  | { kind: 'orderedList' }
  | { kind: 'blockquote' };

export type AssistedMarkdownCommand =
  | {
      target: 'assisted-markdown';
      action: 'insert-text';
      text: string;
    }
  | {
      target: 'assisted-markdown';
      action: 'replace-text';
      text: string;
    }
  | {
      target: 'assisted-markdown';
      action: 'apply-format';
      selectionRange: { start: number; end: number };
      formatStyle: TextFormatStyle;
    };

export type TldrawCommand =
  | {
      target: 'tldraw';
      action: 'save-snapshot';
      snapshotJson: string;
      svgPreview?: string;
    }
  | {
      target: 'tldraw';
      action: 'clear-canvas';
      svgPreview?: string;
    };

export type DrawioCommand =
  | {
      target: 'drawio';
      action: 'save-diagram';
      xmlOrJsonDiagram: string;
      svgPreview?: string;
    }
  | {
      target: 'drawio';
      action: 'clear-diagram';
      svgPreview?: string;
    };

export type AnnotationCommand = AssistedMarkdownCommand | TldrawCommand | DrawioCommand;
