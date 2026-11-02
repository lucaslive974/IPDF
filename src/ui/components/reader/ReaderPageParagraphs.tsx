import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import { getExpandedWordSelection } from '../../utils/domSelection';

export { getExpandedWordSelection };

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
        const notesMap = new Map<string, Highlight>();
        for (const chunk of chunks) {
          if (chunk.highlight?.note && chunk.highlight.note.trim().length > 0) {
            notesMap.set(chunk.highlight.id, chunk.highlight);
          }
        }
        const paragraphNotes = Array.from(notesMap.values());

        return (
          <div key={`p-wrap-${pageNumber}-${pIdx + 1}`} className="relative group">
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

            {paragraphNotes.length > 0 && (
              <div className="absolute -right-8 sm:-right-9 top-0.5 flex flex-col gap-1.5 select-none opacity-60 hover:opacity-100 transition-opacity">
                {paragraphNotes.map((hl) => (
                  <button
                    key={`p-note-${hl.id}`}
                    type="button"
                    aria-label="View annotation note"
                    title={hl.note}
                    className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-surface/80 border border-line-subtle/80 text-tx-muted hover:text-tx-main hover:bg-surface-subtle transition shadow-2xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onHighlightClick(hl, {
                        x: rect.left,
                        y: rect.top,
                      });
                    }}
                  >
                    <svg
                      className="h-2.5 w-2.5 fill-current"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h1.75v2.25a.75.75 0 0 0 1.28.53L8.06 13H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 3h-11Z" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
