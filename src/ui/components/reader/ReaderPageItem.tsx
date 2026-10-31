import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import type { DocumentPage } from '../../../core/ports/BackendService';

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

export interface ReaderPageItemProps {
  readonly page: DocumentPage;
  readonly totalPages: number;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly coverImageUrl?: string;
  readonly highlights: readonly Highlight[];
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderPageItem = memo(function ReaderPageItem({
  page,
  totalPages,
  bookTitle,
  bookAuthor,
  coverImageUrl,
  highlights,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderPageItemProps) {
  return (
    <article
      data-page-number={page.pageNumber}
      className="w-full flex flex-col gap-6 py-8 border-b border-line-subtle/30"
    >
      {/* Page 1 Front Book Cover */}
      {page.pageNumber === 1 && (
        <div className="w-full flex flex-col items-center justify-center pt-2 pb-8">
          {coverImageUrl ? (
            <div className="w-full max-w-xs aspect-3/4 rounded-lg overflow-hidden shadow-lg border border-line-subtle/60 bg-surface-subtle">
              <img
                src={coverImageUrl}
                alt={`Book cover of ${bookTitle}`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full max-w-xs aspect-3/4 rounded-lg border border-line-subtle/60 bg-surface-subtle p-7 flex flex-col justify-between shadow-md">
              <div className="flex justify-between items-center text-[0.6rem] font-medium uppercase tracking-widest text-tx-muted">
                <span>Edition</span>
                <span>Active Study</span>
              </div>
              <div className="text-center my-auto">
                <h1 className="font-serif text-2xl font-bold text-tx-main tracking-tight">
                  {bookTitle}
                </h1>
                <p className="mt-2 text-xs font-normal text-tx-muted tracking-wide">{bookAuthor}</p>
              </div>
              <div className="border-t border-line-subtle/50 pt-3 text-center">
                <p className="text-[0.62rem] font-mono text-tx-faint">Page 1</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chapter Heading & Page Indicator */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-serif font-semibold text-tx-main sm:text-2xl tracking-tight">
          {page.chapterTitle}
        </h2>
        <p className="mt-1.5 text-[0.65rem] text-tx-muted tracking-wider uppercase font-medium">
          {bookAuthor} &bull; Page {page.pageNumber} of {totalPages}
        </p>
      </div>

      {/* Paragraphs with tokenized inline highlights */}
      <div className="space-y-6 text-lg sm:text-xl leading-[1.85] text-tx-main font-serif tracking-normal">
        {page.paragraphs.map((paragraph, pIdx) => {
          const chunks = tokenizeTextWithHighlights(paragraph, highlights);

          return (
            <p key={`p-${page.pageNumber}-${pIdx + 1}`} className="indent-6 text-justify">
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
                      onHighlightContextMenu(e, hl.text, page.pageNumber);
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
    </article>
  );
});
