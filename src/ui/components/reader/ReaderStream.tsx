import type { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import { useHighlightsByPage } from '@hooks/useReaderHighlights';
import { useReaderStreamContextMenu } from '@hooks/useReaderStreamContextMenu';
import { useReaderUI } from '@hooks/useReaderUI';
import { useReaderZoom } from '@hooks/useReaderZoom';
import type { DocumentPage } from '@ports/IReaderService';
import { type LoadedPagesInfo, useReaderStore } from '@stores/useReaderStore';
import { memo, useCallback, useMemo, useRef } from 'react';
import { ReaderPageItem } from './ReaderPageItem';

/**
 * Builds the complete list of pages (1..totalPages) for the document stream,
 * merging loaded page content with lightweight placeholders for unloaded slots in O(1) per page.
 */
export function buildStreamPages(totalPages: number, loadedPages: LoadedPagesInfo): DocumentPage[] {
  const count = Math.max(1, totalPages, loadedPages.maxPage);

  return Array.from({ length: count }, (_, index) => {
    const pageNumber = index + 1;
    return (
      loadedPages.byPage.get(pageNumber) ?? {
        pageNumber,
        chapterTitle: '',
        paragraphs: [],
        cfiBase: '',
      }
    );
  });
}

export const ReaderStream = memo(function ReaderStream() {
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const totalPages = useReaderStore((s) => s.totalPages);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const getHighlightsForPage = useHighlightsByPage();
  const { openHighlightPopover } = useReaderUI();

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const isPdf = document.format === BookFormat.PDF;

  const streamPages = useMemo(
    () => buildStreamPages(totalPages, loadedPages),
    [totalPages, loadedPages]
  );

  const { mainRef, wrapperRef, wrapperStyle, contentStyle } = useReaderZoom({
    isPdf,
    contentAreaRef,
  });

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
      ref={mainRef}
      className={
        isPdf
          ? 'flex-1 w-full overflow-x-auto py-4 sm:py-8 px-2 sm:px-4'
          : 'flex-1 w-full overflow-x-auto py-12 sm:py-20 px-4 sm:px-8'
      }
    >
      <div ref={wrapperRef} className="mx-auto" style={wrapperStyle}>
        <div
          ref={contentAreaRef}
          className={
            isPdf
              ? 'flex flex-col shadow-md rounded-md overflow-hidden bg-surface'
              : 'flex flex-col gap-12'
          }
          style={contentStyle}
        >
          {streamPages.map((page) => {
            const prevChapterTitle = loadedPages.byPage.get(page.pageNumber - 1)?.chapterTitle;
            const hasTitle = page.chapterTitle.trim().length > 0;
            const showChapterHeader =
              hasTitle && (!prevChapterTitle || prevChapterTitle !== page.chapterTitle);

            return (
              <ReaderPageItem
                key={`page-${page.pageNumber}`}
                page={page}
                totalPages={totalPages}
                bookHash={document.bookHash}
                bookTitle={document.bookTitle}
                bookAuthor={document.bookAuthor}
                bookFormat={document.format ?? BookFormat.EPUB}
                highlights={getHighlightsForPage(page.pageNumber)}
                showChapterHeader={showChapterHeader}
                onHighlightClick={handleHighlightClick}
                onHighlightContextMenu={handleHighlightContextMenu}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
});
