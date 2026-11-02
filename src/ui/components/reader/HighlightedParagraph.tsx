import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import type { TextChunk } from '../../utils/readerTokenizer';

export interface HighlightedParagraphProps {
  readonly chunks: readonly TextChunk[];
  readonly pageNumber: number;
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const HighlightedParagraph = memo(function HighlightedParagraph({
  chunks,
  pageNumber,
  onHighlightClick,
  onHighlightContextMenu,
}: HighlightedParagraphProps) {
  return (
    <p className="text-justify leading-relaxed">
      {chunks.map((chunk, cIdx) => {
        if (!chunk.highlight) {
          return <span key={`c-${cIdx + 1}`}>{chunk.text}</span>;
        }

        const hl = chunk.highlight;

        return (
          <span
            key={`hl-${hl.id}-${cIdx + 1}`}
            className="cursor-pointer select-text transition duration-150 hover:brightness-105 active:opacity-80"
            style={{
              backgroundColor: `${hl.color}33`,
              borderBottom: `1.5px solid ${hl.color}aa`,
              borderRadius: '2px',
            }}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onHighlightClick(hl, {
                x: rect.left + rect.width / 2,
                y: rect.top,
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                onHighlightClick(hl, {
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHighlightContextMenu(e, hl.text, pageNumber);
            }}
          >
            {chunk.text}
          </span>
        );
      })}
    </p>
  );
});
