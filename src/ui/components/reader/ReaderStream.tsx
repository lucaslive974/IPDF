import type { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import { useHighlightsByPage } from '@hooks/useReaderHighlights';
import { useReaderStreamContextMenu } from '@hooks/useReaderStreamContextMenu';
import { useReaderUI } from '@hooks/useReaderUI';
import { useReaderZoomGestures } from '@hooks/useReaderZoomGestures';
import type { DocumentPage } from '@ports/IReaderService';
import { useReaderStore } from '@stores/useReaderStore';
import { useTypographyStore } from '@stores/useTypographyStore';
import { memo, useCallback, useMemo, useRef } from 'react';
import { ReaderPageItem } from './ReaderPageItem';

/**
 * Builds the complete list of pages (1..totalPages) for the document stream,
 * merging loaded page content with lightweight placeholders for unloaded slots.
 */
export function buildStreamPages(
  totalPages: number,
  loadedPages: readonly DocumentPage[]
): DocumentPage[] {
  const loadedByPage = new Map<number, DocumentPage>();
  let maxLoadedPage = 0;

  for (const page of loadedPages) {
    loadedByPage.set(page.pageNumber, page);
    if (page.pageNumber > maxLoadedPage) {
      maxLoadedPage = page.pageNumber;
    }
  }

  const count = Math.max(1, totalPages, maxLoadedPage);
  const pages: DocumentPage[] = [];

  for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
    pages.push(
      loadedByPage.get(pageNumber) ?? {
        pageNumber,
        chapterTitle: '',
        paragraphs: [],
        cfiBase: '',
      }
    );
  }

  return pages;
}

export const ReaderStream = memo(function ReaderStream() {
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const getHighlightsForPage = useHighlightsByPage();
  const { openHighlightPopover } = useReaderUI();
  const zoomLevel = useTypographyStore((s) => s.zoomLevel);

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const isPdf = document.format === BookFormat.PDF;

  const streamPages = useMemo(
    () => buildStreamPages(totalPages, loadedPages),
    [totalPages, loadedPages]
  );

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
        {streamPages.map((page) => (
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
      </div>
    </main>
  );
});
