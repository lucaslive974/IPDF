import type { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import { useHighlightsByPage } from '@hooks/useReaderHighlights';
import type { ReaderPaginationController } from '@hooks/useReaderPagination';
import { useReaderStreamContextMenu } from '@hooks/useReaderStreamContextMenu';
import { useReaderStreamVirtualization } from '@hooks/useReaderStreamVirtualization';
import { useReaderUI } from '@hooks/useReaderUI';
import { useReaderZoomGestures } from '@hooks/useReaderZoomGestures';
import { useReaderStore } from '@stores/useReaderStore';
import { useTypographyStore } from '@stores/useTypographyStore';
import { memo, useCallback, useRef } from 'react';
import { ReaderPageItem } from './ReaderPageItem';

export interface ReaderStreamProps {
  readonly pagination: ReaderPaginationController;
}

export const ReaderStream = memo(function ReaderStream({ pagination }: ReaderStreamProps) {
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const getHighlightsForPage = useHighlightsByPage();
  const { openHighlightPopover } = useReaderUI();
  const zoomLevel = useTypographyStore((s) => s.zoomLevel);

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const isPdf = document.format === BookFormat.PDF;

  // Encapsulated Virtual Spacers & Streaming Sentinels
  const { sortedPages, topSentinelRef, bottomSentinelRef, topSpacerHeight, bottomSpacerHeight } =
    useReaderStreamVirtualization({
      pagination,
      contentAreaRef,
      isPdf,
    });

  // Zoom Gestures & Keyboard Shortcuts
  useReaderZoomGestures();

  // Right-Click Context Menu for Selection and Highlights
  const { handleHighlightContextMenu } = useReaderStreamContextMenu({
    contentAreaRef,
    currentPage,
  });

  const handleHighlightClick = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      openHighlightPopover(highlight, coords);
    },
    [openHighlightPopover]
  );

  return (
    <main
      className={
        isPdf
          ? 'flex-1 w-full py-4 sm:py-8 px-2 sm:px-4'
          : 'flex-1 w-full py-12 sm:py-20 px-4 sm:px-8'
      }
    >
      <div
        ref={contentAreaRef}
        className={
          isPdf
            ? 'mx-auto flex flex-col shadow-md rounded-md overflow-hidden bg-surface'
            : 'mx-auto flex flex-col gap-12'
        }
        style={{
          zoom: zoomLevel,
          width: isPdf ? 'min(calc(100vw - 2rem), 48rem)' : 'min(calc(100vw - 2rem), 42rem)',
        }}
      >
        {/* Top virtual spacer for preceding unloaded pages */}
        {topSpacerHeight > 0 && (
          <div
            data-testid="reader-top-spacer"
            style={{ height: `${topSpacerHeight}px` }}
            aria-hidden="true"
          />
        )}

        {/* Top sentinel for reverse scrolling */}
        <div ref={topSentinelRef} className="h-4 w-full pointer-events-none" />

        {/* Render loaded pages seamlessly in continuous streaming scroll */}
        {sortedPages.map((page) => (
          <ReaderPageItem
            key={`page-${page.pageNumber}`}
            page={page}
            totalPages={totalPages}
            bookTitle={document.bookTitle}
            bookAuthor={document.bookAuthor}
            coverImageUrl={document.coverImageUrl}
            bookFormat={document.format ?? BookFormat.EPUB}
            highlights={getHighlightsForPage(page.pageNumber)}
            onHighlightClick={handleHighlightClick}
            onHighlightContextMenu={handleHighlightContextMenu}
          />
        ))}

        {/* Bottom sentinel: triggers next pages on demand before reaching bottom */}
        <div ref={bottomSentinelRef} className="h-16 w-full flex items-center justify-center">
          {currentPage < totalPages && (
            <span className="text-xs text-tx-faint animate-pulse">Loading next pages...</span>
          )}
        </div>

        {/* Bottom virtual spacer for subsequent unloaded pages */}
        {bottomSpacerHeight > 0 && (
          <div
            data-testid="reader-bottom-spacer"
            style={{ height: `${bottomSpacerHeight}px` }}
            aria-hidden="true"
          />
        )}
      </div>
    </main>
  );
});
