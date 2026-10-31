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
  epubCfi?: string; // Obrigatório quando format === 'epub'
  pdfRects?: BoundingBox[]; // Obrigatório quando format === 'pdf'
}

export interface TextSelection {
  text: string;
  surroundingContext: string; // Parágrafo completo onde o trecho está inserido (para LLM)
  anchor: HighlightAnchor;
  clientRect: DOMRect; // Coordenada de tela para ancorar Popover UI
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

/**
 * Comandos assistidos de formatação para que o usuário nunca precise digitar
 * sintaxe Markdown manualmente (negrito, sublinhado, cores, listas, etc.).
 */
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

export type AnnotationCommand =
  | {
      target: 'assisted-markdown';
      action: 'insert-text' | 'replace-text' | 'apply-format';
      text?: string;
      selectionRange?: { start: number; end: number };
      formatStyle?: TextFormatStyle;
    }
  | {
      target: 'tldraw';
      action: 'save-snapshot' | 'clear-canvas';
      snapshotJson?: string;
      svgPreview?: string;
    }
  | {
      target: 'drawio';
      action: 'save-diagram' | 'clear-diagram';
      xmlOrJsonDiagram?: string;
      svgPreview?: string;
    };
