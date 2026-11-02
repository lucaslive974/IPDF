import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';

export interface PdfHighlightLayerProps {
  readonly pageNumber: number;
  readonly highlights: readonly Highlight[];
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const PdfHighlightLayer = memo(function PdfHighlightLayer({
  pageNumber,
  highlights,
  onHighlightClick,
  onHighlightContextMenu,
}: PdfHighlightLayerProps) {
  const pageHighlights = highlights.filter(
    (hl) => hl.anchor.pageNumber === pageNumber && (hl.anchor.pdfRects?.length ?? 0) > 0
  );

  return (
    <div
      data-testid={`pdf-highlight-layer-${pageNumber}`}
      className="absolute inset-0 pointer-events-none z-10"
    >
      {pageHighlights.map((hl) => {
        const rects = hl.anchor.pdfRects ?? [];
        return rects.map((box, boxIdx) => (
          <button
            type="button"
            key={`${hl.id}-box-${boxIdx}`}
            data-testid={`pdf-highlight-rect-${hl.id}-${boxIdx}`}
            aria-label={`Highlight: ${hl.text}`}
            className="absolute cursor-pointer transition hover:brightness-110 active:opacity-80 rounded-xs pointer-events-auto"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
              backgroundColor: `${hl.color}40`,
              borderBottom: `2px solid ${hl.color}cc`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onHighlightClick(hl, { x: e.clientX, y: e.clientY });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHighlightContextMenu(e, hl.text, pageNumber);
            }}
          />
        ));
      })}
    </div>
  );
});
