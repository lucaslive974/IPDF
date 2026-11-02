import { type RefObject, memo, useCallback, useMemo, useRef } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import { BookFormat } from '../../../core/domain/types';
import type { DocumentPage } from '../../../core/ports/IReaderService';
import { useReader } from '../../hooks/useReader';
import { useReaderFocalPageTracker } from '../../hooks/useReaderFocalPageTracker';
import { useReaderInfiniteScroll } from '../../hooks/useReaderInfiniteScroll';
import { useReaderStreamContextMenu } from '../../hooks/useReaderStreamContextMenu';
import { useReaderUI } from '../../hooks/useReaderUI';
import { useReaderZoomGestures } from '../../hooks/useReaderZoomGestures';
import { useTypographyStore } from '../../stores/useTypographyStore';
import { ReaderPageItem } from './ReaderPageItem';

export interface ReaderStreamProps {
  readonly isProgrammaticScrollRef: RefObject<boolean>;
}

export const ReaderStream = memo(function ReaderStream({
  isProgrammaticScrollRef,
}: ReaderStreamProps) {
  const reader = useReader();
  const { openHighlightPopover } = useReaderUI();
  const zoomLevel = useTypographyStore((s) => s.zoomLevel);

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // 1. Zoom Gestures & Keyboard Shortcuts
  useReaderZoomGestures();

  // 2. Continuous Focal Page Tracking (at 35% viewport reading line)
  useReaderFocalPageTracker({
    isProgrammaticScrollRef,
    onPageVisible: reader.onPageVisible,
  });

  // 3. Bidirectional Infinite Scroll with Scroll Anchoring
  useReaderInfiniteScroll({
    contentAreaRef,
    bottomSentinelRef,
    topSentinelRef,
    isProgrammaticScrollRef,
    currentPage: reader.currentPage,
    loadMorePages: reader.loadMorePages,
  });

  // 4. Right-Click Context Menu for Selection and Highlights
  const { handleHighlightContextMenu } = useReaderStreamContextMenu({
    contentAreaRef,
    currentPage: reader.currentPage,
  });

  // Strict ascending order and deduplication of pages
  const sortedPages = useMemo(() => {
    const pageMap = new Map<number, DocumentPage>();
    for (const p of reader.loadedPages) {
      pageMap.set(p.pageNumber, p);
    }
    return Array.from(pageMap.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  }, [reader.loadedPages]);

  const handleHighlightClick = useCallback(
    (highlight: Highlight, coords: { x: number; y: number }) => {
      openHighlightPopover(highlight, coords);
    },
    [openHighlightPopover]
  );

  const isPdf = reader.document.format === BookFormat.PDF;

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
            totalPages={reader.totalPages}
            bookTitle={reader.document.bookTitle}
            bookAuthor={reader.document.bookAuthor}
            coverImageUrl={reader.document.coverImageUrl}
            bookFormat={reader.document.format ?? BookFormat.EPUB}
            highlights={reader.getHighlightsForPage(page.pageNumber)}
            onHighlightClick={handleHighlightClick}
            onHighlightContextMenu={handleHighlightContextMenu}
          />
        ))}

        {/* Bottom sentinel: triggers next 5 pages on demand before reaching bottom */}
        <div ref={bottomSentinelRef} className="h-16 w-full flex items-center justify-center">
          {reader.currentPage < reader.totalPages && (
            <span className="text-xs text-tx-faint animate-pulse">Loading next pages...</span>
          )}
        </div>
      </div>
    </main>
  );
});
