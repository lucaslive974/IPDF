import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';

export interface TextChunk {
  readonly text: string;
  readonly highlight?: Highlight;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findHighlightMatchesInParagraph(
  paragraph: string,
  hlText: string
): { start: number; end: number }[] {
  const trimmed = hlText.trim();
  if (!trimmed) return [];

  // 1. Direct exact match first (fast path)
  const exactIdx = paragraph.indexOf(trimmed);
  if (exactIdx !== -1) {
    return [{ start: exactIdx, end: exactIdx + trimmed.length }];
  }

  // 2. Flexible whitespace match (matches \n, \r, tabs and multiple spaces across paragraph text)
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const pattern = tokens.map(escapeRegex).join('\\s+');
  const regex = new RegExp(pattern, 'g');
  const matches: { start: number; end: number }[] = [];

  let m: RegExpExecArray | null = regex.exec(paragraph);
  while (m !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
    m = regex.exec(paragraph);
  }

  if (matches.length > 0) {
    return matches;
  }

  // 3. Multi-line segments (if selection spanned across paragraphs or line breaks)
  const lines = trimmed
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  if (lines.length > 1) {
    for (const line of lines) {
      const lineTokens = line.split(/\s+/).filter(Boolean);
      if (lineTokens.length === 0) continue;
      const linePattern = lineTokens.map(escapeRegex).join('\\s+');
      const lineRegex = new RegExp(linePattern, 'g');
      let lm: RegExpExecArray | null = lineRegex.exec(paragraph);
      while (lm !== null) {
        matches.push({ start: lm.index, end: lm.index + lm[0].length });
        lm = lineRegex.exec(paragraph);
      }
    }
  }

  return matches;
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
    const ranges = findHighlightMatchesInParagraph(paragraph, hl.text);
    for (const r of ranges) {
      matches.push({
        start: r.start,
        end: r.end,
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
                  className="inline p-0 m-0 border-0 bg-transparent text-left whitespace-normal cursor-pointer rounded-xs px-0.5 text-inherit transition duration-150 select-text hover:brightness-105 active:opacity-80"
                  style={{
                    font: 'inherit',
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
