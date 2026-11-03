import type { Highlight } from '@domain/Highlight';
import { useServiceContainer } from '@providers/ServiceContainerContext';
import { memo, useEffect, useMemo, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const { pdfViewer } = useServiceContainer();

  useEffect(() => {
    let isCancelled = false;

    const render = async () => {
      if (canvasRef.current) {
        await pdfViewer.renderPageCanvas(pageNumber, canvasRef.current);
      }
      if (textLayerRef.current && !isCancelled) {
        await pdfViewer.renderPageTextLayer(pageNumber, textLayerRef.current);
      }
    };

    void render();

    return () => {
      isCancelled = true;
    };
  }, [pdfViewer, pageNumber]);

  const pageNotes = useMemo(
    () =>
      highlights.filter(
        (hl) => hl.anchor.pageNumber === pageNumber && Boolean(hl.note && hl.note.trim().length > 0)
      ),
    [highlights, pageNumber]
  );

  return (
    <div
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
