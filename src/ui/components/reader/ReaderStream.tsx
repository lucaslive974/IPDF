import type { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import { useHighlightsByPage } from '@hooks/useReaderHighlights';
import { useReaderPagination } from '@hooks/useReaderPagination';
import { useReaderStreamContextMenu } from '@hooks/useReaderStreamContextMenu';
import { useReaderUI } from '@hooks/useReaderUI';
import { useReaderZoomGestures } from '@hooks/useReaderZoomGestures';
import type { DocumentPage } from '@ports/IReaderService';
import { useReaderStore } from '@stores/useReaderStore';
import { useTypographyStore } from '@stores/useTypographyStore';
import { memo, useCallback, useMemo, useRef } from 'react';
import { ReaderPageItem } from './ReaderPageItem';

export const ReaderStream = memo(function ReaderStream() {
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const isStreamReady = useReaderStore((s) => s.isStreamReady);
  const getHighlightsForPage = useHighlightsByPage();
  const { openHighlightPopover } = useReaderUI();
  const zoomLevel = useTypographyStore((s) => s.zoomLevel);

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // 1. Unified Pagination, Continuous Infinite Scroll & Focal Offset Tracking
  const pagination = useReaderPagination({
    contentAreaRef,
    bottomSentinelRef,
    topSentinelRef,
    isStreamReady,
  });

  // 2. Zoom Gestures & Keyboard Shortcuts
  useReaderZoomGestures();

  // 3. Right-Click Context Menu for Selection and Highlights
  const { handleHighlightContextMenu } = useReaderStreamContextMenu({
    contentAreaRef,
    currentPage,
  });

  // Strict ascending order and deduplication of pages
  const sortedPages = useMemo(() => {
    const pageMap = new Map<number, DocumentPage>();
    for (const p of loadedPages) {
      pageMap.set(p.pageNumber, p);
    }
    return Array.from(pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  }, [loadedPages]);

  const handleHighlightClick = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      openHighlightPopover(highlight, coords);
    },
    [openHighlightPopover]
  );

  const isPdf = document.format === BookFormat.PDF;

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

        {/* Bottom sentinel: triggers next 5 pages on demand before reaching bottom */}
        <div ref={bottomSentinelRef} className="h-16 w-full flex items-center justify-center">
          {currentPage < totalPages && (
            <span className="text-xs text-tx-faint animate-pulse">Loading next pages...</span>
          )}
        </div>
      </div>
    </main>
  );
});
