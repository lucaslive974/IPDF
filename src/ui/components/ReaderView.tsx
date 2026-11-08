import type { BookMetadata } from '@domain/BookMetadata';
import { useReaderBootstrapper } from '@hooks/useReaderBootstrapper';
import { useReaderPagination } from '@hooks/useReaderPagination';
import { useReaderView } from '@hooks/useReaderView';
import { useNavigation } from '@providers/NavigationContext';
import { useReaderStore } from '@stores/useReaderStore';
import { memo } from 'react';
import { ReaderBottomBar } from './reader/ReaderBottomBar';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderLoadingView } from './reader/ReaderLoadingView';
import { ReaderOverlays } from './reader/ReaderOverlays';
import { ReaderStream } from './reader/ReaderStream';

export interface ReaderViewProps {
  readonly bookOverride?: BookMetadata | null;
}

export const ReaderView = memo(function ReaderView({ bookOverride }: ReaderViewProps) {
  const navigation = useNavigation();
  const book = bookOverride ?? navigation.selectedBook;

  useReaderBootstrapper(book);

  const isLoadingPages = useReaderStore((s) => s.isLoadingPages);
  const isStreamReady = useReaderStore((s) => s.isStreamReady);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const document = useReaderStore((s) => s.document);

  const isReady = !isLoadingPages && loadedPages.length > 0;
  const showLoadingOverlay = !isReady || !isStreamReady;

  const { handleCloseReader, handleViewportClick, toggleChrome } = useReaderView();
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
