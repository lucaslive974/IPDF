import { useCallback, useEffect, useRef } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { useNavigation } from '../hooks/useNavigation';
import { useReader } from '../hooks/useReader';
import { useReaderUI } from '../hooks/useReaderUI';
import { ReaderBottomBar } from './reader/ReaderBottomBar';
import { ReaderHeader } from './reader/ReaderHeader';
import { ReaderOverlays } from './reader/ReaderOverlays';
import { ReaderStream } from './reader/ReaderStream';

export function ReaderView() {
  const reader = useReader();
  const navigation = useNavigation();
  const library = useLibrary();
  const {
    isChromeVisible,
    toggleChrome,
    contextMenu,
    activeNoteDialog,
    activeExplainDialog,
    activeTranslateDialog,
    closeAllOverlays,
  } = useReaderUI();

  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync reading progress to library and backend on departure
  const lastSavedStateRef = useRef<{
    bookHash: string;
    currentPage: number;
    totalPages: number;
  } | null>(null);

  const saveProgress = useCallback(
    async (bookHash: string, currentPage: number, totalPages: number) => {
      if (
        !bookHash ||
        (lastSavedStateRef.current &&
          lastSavedStateRef.current.bookHash === bookHash &&
          lastSavedStateRef.current.currentPage === currentPage &&
          lastSavedStateRef.current.totalPages === totalPages)
      ) {
        return;
      }
      lastSavedStateRef.current = { bookHash, currentPage, totalPages };
      try {
        await library.updateBookProgress(bookHash, currentPage, totalPages);
      } catch (err) {
        console.warn('Failed to notify library of book progress:', err);
      }
    },
    [library]
  );

  const lastStateRef = useRef({
    bookHash: reader.document.bookHash,
    currentPage: reader.currentPage,
    totalPages: reader.totalPages,
  });

  useEffect(() => {
    lastStateRef.current = {
      bookHash: reader.document.bookHash,
      currentPage: reader.currentPage,
      totalPages: reader.totalPages,
    };
  }, [reader.document.bookHash, reader.currentPage, reader.totalPages]);

  useEffect(() => {
    return () => {
      const { bookHash, currentPage, totalPages } = lastStateRef.current;
      if (bookHash) {
        void saveProgress(bookHash, currentPage, totalPages);
      }
    };
  }, [saveProgress]);

  const handleCloseReader = useCallback(async () => {
    try {
      if (reader.document.bookHash) {
        await saveProgress(reader.document.bookHash, reader.currentPage, reader.totalPages);
      }
    } finally {
      closeAllOverlays();
      navigation.closeReader();
    }
  }, [
    closeAllOverlays,
    navigation,
    reader.currentPage,
    reader.document.bookHash,
    reader.totalPages,
    saveProgress,
  ]);

  // Smooth Page Scrolling Navigation
  const scrollToPage = useCallback(
    (pageNum: number) => {
      const target = Math.max(1, Math.min(reader.totalPages, pageNum));
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 900);

      reader.onPageVisible(target);

      if (target === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const el = document.querySelector(`article[data-page-number="${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        void reader.goToPage(target).then(() => {
          window.requestAnimationFrame(() => {
            if (target === 1) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              const newEl = document.querySelector(`article[data-page-number="${target}"]`);
              newEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        });
      }
    },
    [reader]
  );

  // Immersive Click / Tap Toggle for Chrome
  const handleViewportClick = (e: React.MouseEvent<HTMLElement>) => {
    if (
      contextMenu ||
      activeNoteDialog ||
      activeExplainDialog ||
      activeTranslateDialog ||
      reader.activeHighlightPopover ||
      reader.expandedHighlight
    ) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="button"], input, textarea, pre, [role="menu"]')) {
      return;
    }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      return;
    }
    toggleChrome();
  };

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
      <ReaderStream isProgrammaticScrollRef={isProgrammaticScrollRef} />
      <ReaderBottomBar onScrollToPage={scrollToPage} />
      <ReaderOverlays />
    </section>
  );
}
