import type { Highlight } from '@domain/Highlight';
import { usePdfPageRenderer } from '@hooks/usePdfPageRenderer';
import { memo } from 'react';
import { ParagraphMarginNotes } from './ParagraphMarginNotes';
import { PdfHighlightLayer } from './PdfHighlightLayer';

export interface ReaderPagePdfProps {
  readonly pageNumber: number;
  readonly paragraphs: readonly string[];
  readonly highlights: readonly Highlight[];
  readonly cssFontFamily?: string;
  readonly fontSize?: number;
  readonly lineSpacing?: number;
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderPagePdf = memo(function ReaderPagePdf({
  pageNumber,
  paragraphs: _paragraphs,
  highlights,
  cssFontFamily: _cssFontFamily,
  fontSize: _fontSize,
  lineSpacing: _lineSpacing,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderPagePdfProps) {
  const { containerRef, canvasRef, textLayerRef, pageNotes } = usePdfPageRenderer({
    pageNumber,
    highlights,
  });

  return (
    <div
      ref={containerRef}
      data-testid={`reader-page-pdf-${pageNumber}`}
      className="relative w-full overflow-hidden bg-surface select-text min-h-75"
    >
      {/* 1. Underlying rendered PDF Canvas */}
      <canvas
        ref={canvasRef}
        data-testid={`pdf-canvas-${pageNumber}`}
        className="w-full h-auto block"
      />

      {/* 2. Middle transparent PDF.js text layer for pixel-accurate text selection */}
      <div
        ref={textLayerRef}
        data-testid={`pdf-text-layer-${pageNumber}`}
        className="textLayer absolute inset-0 select-text pointer-events-auto"
      />

      {/* 3. Top AABB Highlight Layer */}
      <PdfHighlightLayer
        pageNumber={pageNumber}
        highlights={highlights}
        onHighlightClick={onHighlightClick}
        onHighlightContextMenu={onHighlightContextMenu}
      />

      {/* 4. Margin Notes if present on this page */}
      <ParagraphMarginNotes notes={pageNotes} onNoteClick={onHighlightClick} />
    </div>
  );
});
