import { memo } from 'react';
import { useReaderView } from '../hooks/useReaderView';
import { useReaderStore } from '../stores/useReaderStore';
import { ReaderBottomBar } from './reader/ReaderBottomBar';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderLoadingView } from './reader/ReaderLoadingView';
import { ReaderOverlays } from './reader/ReaderOverlays';
import { ReaderStream } from './reader/ReaderStream';

export const ReaderView = memo(function ReaderView() {
  const {
    isProgrammaticScrollRef,
    scrollToPage,
    handleCloseReader,
    handleViewportClick,
    toggleChrome,
  } = useReaderView();
  const isLoadingPages = useReaderStore((s) => s.isLoadingPages);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const document = useReaderStore((s) => s.document);

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
      {isLoadingPages && loadedPages.length === 0 ? (
        <ReaderLoadingView document={document} />
      ) : (
        <ReaderStream isProgrammaticScrollRef={isProgrammaticScrollRef} />
      )}
      <ReaderBottomBar onScrollToPage={scrollToPage} />
      <ReaderOverlays />
    </section>
  );
});
