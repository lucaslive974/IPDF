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
      className="w-full flex flex-col gap-6 py-6 border-b border-line-subtle/25"
    >
      {/* Page 1 Front Book Cover */}
      {page.pageNumber === 1 && (
        <div className="w-full flex flex-col items-center justify-center pt-2 pb-8">
          {coverImageUrl ? (
            <div className="w-full max-w-xs aspect-3/4 rounded-xl overflow-hidden shadow-2xl border border-line-subtle/60 bg-surface-subtle transition-all duration-300 hover:shadow-brand/20">
              <img
                src={coverImageUrl}
                alt={`Book cover of ${bookTitle}`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full max-w-xs aspect-3/4 rounded-xl border border-line-subtle/60 bg-linear-to-b from-surface-subtle via-surface to-surface-subtle p-6 flex flex-col justify-between shadow-2xl">
              <div className="flex justify-between items-center text-[0.65rem] font-bold uppercase tracking-widest text-tx-muted">
                <span>Classical Edition</span>
                <span>IPDF</span>
              </div>
              <div className="text-center my-auto">
                <h1 className="font-serif text-2xl font-black text-tx-main tracking-tight">
                  {bookTitle}
                </h1>
                <p className="mt-2 text-xs font-semibold text-brand tracking-wide">{bookAuthor}</p>
              </div>
              <div className="border-t border-line-subtle pt-3 text-center">
                <p className="text-[0.65rem] font-mono text-tx-faint">
                  First Page &bull; Active Study
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chapter Heading & Page Indicator */}
      <div className="text-center mb-2">
        <h2 className="text-xl font-serif font-bold text-tx-main sm:text-2xl tracking-tight">
          {page.chapterTitle}
        </h2>
        <p className="mt-1 text-[0.68rem] text-tx-muted tracking-wider uppercase font-semibold">
          {bookAuthor} &bull; Page {page.pageNumber} of {totalPages}
        </p>
      </div>

      {/* Paragraphs with tokenized inline highlights */}
      <div className="space-y-6 text-lg sm:text-xl leading-relaxed text-tx-main font-serif tracking-normal">
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
                    className="inline cursor-pointer rounded-xs px-0.5 text-inherit transition duration-150 select-text hover:brightness-110 active:opacity-80"
                    style={{
                      backgroundColor: `${hl.color}44`,
                      borderBottom: `2px solid ${hl.color}`,
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
