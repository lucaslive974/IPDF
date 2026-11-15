import type { Highlight } from '@domain/Highlight';
import { memo } from 'react';

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
        return (
          <div key={hl.id} className="group absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 pointer-events-none opacity-25 transition-opacity group-hover:opacity-35">
              {rects.map((box, boxIdx) => (
                <div
                  key={`${hl.id}-fill-${boxIdx}`}
                  className="absolute rounded-xs"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.width * 100}%`,
                    height: `${box.height * 100}%`,
                    backgroundColor: hl.color,
                  }}
                />
              ))}
            </div>

            {rects.map((box, boxIdx) => (
              <button
                type="button"
                key={`${hl.id}-box-${boxIdx}`}
                data-testid={`pdf-highlight-rect-${hl.id}-${boxIdx}`}
                aria-label={`Highlight: ${hl.text}`}
                className="absolute cursor-pointer active:opacity-80 rounded-xs pointer-events-auto before:content-[''] before:absolute before:-inset-6"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
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
            ))}
          </div>
        );
      })}
    </div>
  );
});
