import { memo, useEffect, useMemo, useRef } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import { BookFormat } from '../../../core/domain/types';
import { useServiceContainer } from '../../providers/ServiceContainerContext';
import { ParagraphMarginNotes } from './ParagraphMarginNotes';
import { PdfHighlightLayer } from './PdfHighlightLayer';

export interface ReaderPagePdfProps {
  readonly pageNumber: number;
  readonly paragraphs: readonly string[];
  readonly highlights: readonly Highlight[];
  readonly cssFontFamily: string;
  readonly fontSize: number;
  readonly lineSpacing: number;
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderPagePdf = memo(function ReaderPagePdf({
  pageNumber,
  paragraphs,
  highlights,
  cssFontFamily,
  fontSize,
  lineSpacing,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderPagePdfProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getViewer } = useServiceContainer();

  useEffect(() => {
    const viewer = getViewer(BookFormat.PDF);
    if (canvasRef.current && 'renderPageCanvas' in viewer) {
      const pdfViewer = viewer as {
        renderPageCanvas(
          pageNumber: number,
          canvas: HTMLCanvasElement
        ): Promise<{ width: number; height: number }>;
      };
      void pdfViewer.renderPageCanvas(pageNumber, canvasRef.current);
    }
  }, [getViewer, pageNumber]);

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

      {/* 2. Middle transparent text layer for text selection & word tracking */}
      <div
        data-testid={`pdf-text-layer-${pageNumber}`}
        className="absolute inset-0 select-text text-transparent p-4 flex flex-col gap-4 pointer-events-auto leading-relaxed"
        style={{
          fontFamily: cssFontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: lineSpacing,
        }}
      >
        {paragraphs.map((p, idx) => (
          <p
            key={`pdf-text-p-${pageNumber}-${idx + 1}`}
            className="whitespace-pre-wrap select-text"
          >
            {p}
          </p>
        ))}
      </div>

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
