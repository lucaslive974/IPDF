import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';

export interface TextChunk {
  readonly text: string;
  readonly highlight?: Highlight;
}

export function tokenizeTextWithHighlights(
  paragraph: string,
  highlights: readonly Highlight[]
): TextChunk[] {
  if (highlights.length === 0) {
    return [{ text: paragraph }];
  }

  interface Match {
    start: number;
    end: number;
    highlight: Highlight;
  }

  const matches: Match[] = [];
  for (const hl of highlights) {
    if (!hl.text || hl.text.trim().length === 0) continue;
    const idx = paragraph.indexOf(hl.text);
    if (idx !== -1) {
      matches.push({
        start: idx,
        end: idx + hl.text.length,
        highlight: hl,
      });
    }
  }

  if (matches.length === 0) {
    return [{ text: paragraph }];
  }

  matches.sort((a, b) => a.start - b.start);

  const chunks: TextChunk[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    if (match.start > cursor) {
      chunks.push({ text: paragraph.slice(cursor, match.start) });
    }
    chunks.push({
      text: paragraph.slice(match.start, match.end),
      highlight: match.highlight,
    });
    cursor = match.end;
  }

  if (cursor < paragraph.length) {
    chunks.push({ text: paragraph.slice(cursor) });
  }

  return chunks;
}

export interface ReaderPageParagraphsProps {
  readonly pageNumber: number;
  readonly paragraphs: readonly string[];
  readonly highlights: readonly Highlight[];
  readonly cssFontFamily: string;
  readonly fontSize: number;
  readonly lineSpacing: number;
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderPageParagraphs = memo(function ReaderPageParagraphs({
  pageNumber,
  paragraphs,
  highlights,
  cssFontFamily,
  fontSize,
  lineSpacing,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderPageParagraphsProps) {
  return (
    <div
      className="space-y-6 text-tx-main tracking-normal"
      style={{
        fontFamily: cssFontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: lineSpacing,
      }}
    >
      {paragraphs.map((paragraph, pIdx) => {
        const chunks = tokenizeTextWithHighlights(paragraph, highlights);

        return (
          <p key={`p-${pageNumber}-${pIdx + 1}`} className="indent-6 text-justify">
            {chunks.map((chunk, cIdx) => {
              if (!chunk.highlight) {
                return <span key={`c-${cIdx + 1}`}>{chunk.text}</span>;
              }

              const hl = chunk.highlight;
              return (
                <button
                  key={`hl-${hl.id}-${cIdx + 1}`}
                  type="button"
                  className="inline cursor-pointer rounded-xs px-0.5 text-inherit transition duration-150 select-text hover:brightness-105 active:opacity-80"
                  style={{
                    backgroundColor: `${hl.color}33`,
                    borderBottom: `1.5px solid ${hl.color}aa`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onHighlightClick(hl, {
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHighlightContextMenu(e, hl.text, pageNumber);
                  }}
                >
                  {chunk.text}
                </button>
              );
            })}
          </p>
        );
      })}
    </div>
  );
});
