import type { BookMetadata } from '@domain/BookMetadata';
import { BookFormat } from '@domain/types';
import { useReaderBootstrapper } from '@hooks/useReaderBootstrapper';
import { useReaderPagination } from '@hooks/useReaderPagination';
import { useReaderView } from '@hooks/useReaderView';
import { useReaderStore } from '@stores/useReaderStore';
import { useReaderUIStore } from '@stores/useReaderUIStore';
import { memo } from 'react';
import { ReaderBottomBar } from './reader/ReaderBottomBar';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderLoadingView } from './reader/ReaderLoadingView';
import { ReaderOverlays } from './reader/ReaderOverlays';
import { ReaderStream } from './reader/ReaderStream';
import { ReaderViewportChapterIndicator } from './reader/ReaderViewportChapterIndicator';

export interface ReaderViewProps {
  readonly book?: BookMetadata | null;
  readonly onClose?: () => void;
}

export const ReaderView = memo(function ReaderView({ book, onClose }: ReaderViewProps) {
  useReaderBootstrapper(book);

  const isLoadingPages = useReaderStore((s) => s.isLoadingPages);
  const isStreamReady = useReaderStore((s) => s.isStreamReady);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const document = useReaderStore((s) => s.document);

  const isReady = !isLoadingPages && loadedPages.byPage.size > 0;
  const showLoadingOverlay = !isReady || !isStreamReady;
  const isPdf = document.format === BookFormat.PDF;
  const chapterTitle = useReaderStore((s) => s.chapterTitle) || document.chapterTitle;
  const isChromeVisible = useReaderUIStore((s) => s.isChromeVisible);

  const { handleCloseReader, handleViewportClick, toggleChrome } = useReaderView({ onClose });
  const pagination = useReaderPagination({ isStreamReady });

  return (
    <section
      aria-label="Book Reader Document"
      className="relative min-h-screen w-full bg-canvas text-tx-main flex flex-col justify-between overflow-x-auto select-text transition-colors duration-200 outline-none"
      onClick={handleViewportClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          toggleChrome();
        }
      }}
    >
      <ReaderHeader onClose={handleCloseReader} />
      <ReaderViewportChapterIndicator
        chapterTitle={chapterTitle}
        isVisible={!isPdf && !isChromeVisible}
      />
      {showLoadingOverlay && (
        <div className="fixed inset-0 z-30 bg-canvas flex flex-col justify-center">
          <ReaderLoadingView document={document} />
        </div>
      )}
      {isReady && <ReaderStream />}
      <ReaderBottomBar onScrollToPage={pagination.goToPage} />
      <ReaderOverlays />
    </section>
  );
});
