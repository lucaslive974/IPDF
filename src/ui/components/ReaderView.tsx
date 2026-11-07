import { ReaderContext } from '@hooks/useReader';
import { useReaderView } from '@hooks/useReaderView';
import { useReaderStore } from '@stores/useReaderStore';
import { memo } from 'react';
import { ReaderBottomBar } from './reader/ReaderBottomBar';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderLoadingView } from './reader/ReaderLoadingView';
import { ReaderOverlays } from './reader/ReaderOverlays';
import { ReaderStream } from './reader/ReaderStream';

export const ReaderView = memo(function ReaderView() {
  const {
    reader,
    isProgrammaticScrollRef,
    scrollToPage,
    handleCloseReader,
    handleViewportClick,
    toggleChrome,
  } = useReaderView();
  const isLoadingPages = useReaderStore((s) => s.isLoadingPages);
  const isStreamReady = useReaderStore((s) => s.isStreamReady);
  const loadedPages = useReaderStore((s) => s.loadedPages);
  const document = useReaderStore((s) => s.document);

  const showLoadingOverlay = isLoadingPages || loadedPages.length === 0 || !isStreamReady;

  return (
    <ReaderContext.Provider value={reader}>
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
        {!isLoadingPages && loadedPages.length > 0 && (
          <ReaderStream isProgrammaticScrollRef={isProgrammaticScrollRef} />
        )}
        <ReaderBottomBar onScrollToPage={scrollToPage} />
        <ReaderOverlays />
      </section>
    </ReaderContext.Provider>
  );
});
