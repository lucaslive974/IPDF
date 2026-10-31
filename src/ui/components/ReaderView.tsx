import { useCallback, useEffect, useRef, useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import { useNavigation } from '../hooks/useNavigation';
import { useReader } from '../hooks/useReader';
import { ExplainDialog } from './ExplainDialog';
import { HighlightDetailModal } from './HighlightDetailModal';
import { HighlightPopover } from './HighlightPopover';
import { NoteDialog } from './NoteDialog';
import { ReaderContextMenu } from './ReaderContextMenu';
import { TranslateDialog } from './TranslateDialog';
import { Button, IconButton } from './ui';

interface TextChunk {
  readonly text: string;
  readonly highlight?: Highlight;
}

function tokenizeTextWithHighlights(
  paragraph: string,
  highlights: readonly Highlight[]
): TextChunk[] {
  if (highlights.length === 0) {
    return [{ text: paragraph }];
  }

  interface Match {
    start: number;
    end: number;
    highlight: Highlight;
  }

  const matches: Match[] = [];
  for (const hl of highlights) {
    if (!hl.text || hl.text.trim().length === 0) continue;
    const idx = paragraph.indexOf(hl.text);
    if (idx !== -1) {
      matches.push({
        start: idx,
        end: idx + hl.text.length,
        highlight: hl,
      });
    }
  }

  if (matches.length === 0) {
    return [{ text: paragraph }];
  }

  matches.sort((a, b) => a.start - b.start);

  const chunks: TextChunk[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    if (match.start > cursor) {
      chunks.push({ text: paragraph.slice(cursor, match.start) });
    }
    chunks.push({
      text: paragraph.slice(match.start, match.end),
      highlight: match.highlight,
    });
    cursor = match.end;
  }

  if (cursor < paragraph.length) {
    chunks.push({ text: paragraph.slice(cursor) });
  }

  return chunks;
}

export function ReaderView() {
  const reader = useReader();
  const navigation = useNavigation();

  const [isChromeVisible, setIsChromeVisible] = useState<boolean>(false);

  // Dropdown Context Menu and Dedicated Feature Dialogs
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: string;
    pageNumber: number;
  } | null>(null);

  const [activeNoteDialog, setActiveNoteDialog] = useState<{
    text: string;
    pageNumber: number;
  } | null>(null);

  const [activeExplainDialog, setActiveExplainDialog] = useState<{
    text: string;
    pageNumber: number;
  } | null>(null);

  const [activeTranslateDialog, setActiveTranslateDialog] = useState<{
    text: string;
    pageNumber: number;
  } | null>(null);

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  const onPageVisibleRef = useRef(reader.onPageVisible);
  onPageVisibleRef.current = reader.onPageVisible;

  const [pageInputValue, setPageInputValue] = useState<string>(String(reader.currentPage));
  const isPageInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!isPageInputFocusedRef.current) {
      setPageInputValue(String(reader.currentPage));
    }
  }, [reader.currentPage]);

  // 1. Right Click Context Menu (Dropdown) Handler
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }
      const text = selection.toString().trim();
      if (text.length === 0) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const article = target?.closest('article[data-page-number]');
      const pageNumber = article
        ? Number(article.getAttribute('data-page-number'))
        : reader.currentPage;

      e.preventDefault();
      setContextMenu({
        text,
        x: e.clientX,
        y: e.clientY,
        pageNumber: pageNumber || reader.currentPage,
      });
    };

    const container = contentAreaRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
    }
    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [reader.currentPage]);

  // 2. Infinite Scroll Sentinel Observer (Loads 5 pages ahead on demand)
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void reader.loadMorePages('next');
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [reader]);

  // Top Sentinel for upward infinite scroll
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && reader.currentPage > 1) {
          void reader.loadMorePages('prev');
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [reader]);

  // 3. Dynamic Page Focal Tracker (Tracks active page at 60fps based on comfortable reading line)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const articles = document.querySelectorAll<HTMLElement>('article[data-page-number]');
          if (articles.length === 0) {
            ticking = false;
            return;
          }

          const focalY = window.innerHeight * 0.35;
          let activePage: number | null = null;
          let closestDistance = Number.POSITIVE_INFINITY;

          for (const article of articles) {
            const rect = article.getBoundingClientRect();
            if (rect.top <= focalY && rect.bottom >= focalY) {
              activePage = Number(article.getAttribute('data-page-number'));
              break;
            }
            const dist = Math.abs(rect.top - focalY);
            if (dist < closestDistance) {
              closestDistance = dist;
              activePage = Number(article.getAttribute('data-page-number'));
            }
          }

          if (activePage && activePage > 0) {
            onPageVisibleRef.current(activePage);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 4. Smooth Page Scrolling Navigation for buttons
  const scrollToPage = useCallback(
    (pageNum: number) => {
      const target = Math.max(1, Math.min(reader.totalPages, pageNum));
      const el = document.querySelector(`article[data-page-number="${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        void reader.goToPage(target).then(() => {
          setTimeout(() => {
            const newEl = document.querySelector(`article[data-page-number="${target}"]`);
            newEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        });
      }
    },
    [reader]
  );

  // 5. Immersive Click / Tap Toggle for Chrome
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
    setIsChromeVisible((prev) => !prev);
  };

  return (
    <section
      aria-label="Book Reader Document"
      className="relative min-h-screen w-full bg-canvas text-tx-main flex flex-col justify-between overflow-x-hidden select-text transition-colors duration-200 outline-none"
      onClick={handleViewportClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setIsChromeVisible((prev) => !prev);
        }
      }}
    >
      {/* 1. Immersive Auto-Hiding Top Navigation */}
      <header
        className={`fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-line-subtle bg-surface/90 px-6 py-3 backdrop-blur-md transition-all duration-300 ease-in-out ${
          isChromeVisible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" iconLeft="←" onClick={navigation.closeReader}>
            Library
          </Button>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-semibold text-tx-main">
              {reader.document.bookAuthor} &mdash; {reader.document.bookTitle}
            </span>
            <span className="text-[0.7rem] text-tx-muted">
              {reader.chapterTitle || reader.document.chapterTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line-subtle bg-surface px-3 py-1 text-xs text-tx-secondary">
            <span className="font-mono font-bold text-tx-main">
              Page {reader.currentPage} of {reader.totalPages}
            </span>
          </div>
          <IconButton
            variant="outline"
            size="sm"
            label="Settings"
            onClick={navigation.openSettings}
          >
            ⚙️
          </IconButton>
        </div>
      </header>

      {/* 2. Full-Screen Streaming Book Surface with Infinite On-Demand Virtual Scroll */}
      <main className="flex-1 w-full flex flex-col items-center px-4 sm:px-12 py-12 sm:py-20">
        <div ref={contentAreaRef} className="w-full max-w-2xl flex flex-col gap-12">
          {/* Top sentinel for reverse scrolling */}
          <div ref={topSentinelRef} className="h-4 w-full pointer-events-none" />

          {/* Render loaded pages seamlessly in continuous streaming scroll */}
          {reader.loadedPages.map((page) => {
            const pageHighlights = reader.getHighlightsForPage(page.pageNumber);

            return (
              <article
                key={`page-${page.pageNumber}`}
                data-page-number={page.pageNumber}
                className="w-full flex flex-col gap-6 py-6 border-b border-line-subtle/25"
              >
                {/* Page 1 Front Book Cover */}
                {page.pageNumber === 1 && (
                  <div className="w-full flex flex-col items-center justify-center pt-2 pb-8">
                    {reader.document.coverImageUrl ? (
                      <div className="w-full max-w-xs aspect-3/4 rounded-xl overflow-hidden shadow-2xl border border-line-subtle/60 bg-surface-subtle transition-all duration-300 hover:shadow-brand/20">
                        <img
                          src={reader.document.coverImageUrl}
                          alt={`Book cover of ${reader.document.bookTitle}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full max-w-xs aspect-3/4 rounded-xl border border-line-subtle/60 bg-linear-to-b from-surface-subtle via-surface to-surface-subtle p-6 flex flex-col justify-between shadow-2xl">
                        <div className="flex justify-between items-center text-[0.65rem] font-bold uppercase tracking-widest text-tx-muted">
                          <span>Classical Edition</span>
                          <span>IPDF</span>
                        </div>
                        <div className="text-center my-auto">
                          <h1 className="text-2xl font-serif font-black text-tx-main tracking-tight">
                            {reader.document.bookTitle}
                          </h1>
                          <div className="w-12 h-0.5 bg-brand mx-auto my-3" />
                          <p className="text-sm text-tx-muted font-serif italic">
                            {reader.document.bookAuthor}
                          </p>
                        </div>
                        <p className="text-center text-[0.65rem] text-tx-muted tracking-wider uppercase font-semibold">
                          First Page &bull; Active Study
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Chapter Heading & Page Indicator */}
                <div className="text-center mb-2">
                  <h2 className="text-xl font-serif font-bold text-tx-main sm:text-2xl tracking-tight">
                    {page.chapterTitle}
                  </h2>
                  <p className="mt-1 text-[0.68rem] text-tx-muted tracking-wider uppercase font-semibold">
                    {reader.document.bookAuthor} &bull; Page {page.pageNumber} of{' '}
                    {reader.totalPages}
                  </p>
                </div>

                {/* Paragraphs with tokenized inline highlights */}
                <div className="space-y-6 text-lg sm:text-xl leading-relaxed text-tx-main font-serif tracking-normal">
                  {page.paragraphs.map((paragraph, pIdx) => {
                    const chunks = tokenizeTextWithHighlights(paragraph, pageHighlights);

                    return (
                      <p key={`p-${page.pageNumber}-${pIdx + 1}`} className="indent-6 text-justify">
                        {chunks.map((chunk, cIdx) => {
                          if (!chunk.highlight) {
                            return <span key={`c-${cIdx + 1}`}>{chunk.text}</span>;
                          }

                          const hl = chunk.highlight;
                          return (
                            <button
                              key={`hl-${hl.id}-${cIdx + 1}`}
                              type="button"
                              className="inline cursor-pointer rounded-xs px-0.5 text-inherit transition duration-150 select-text hover:brightness-110 active:opacity-80"
                              style={{
                                backgroundColor: `${hl.color}44`,
                                borderBottom: `2px solid ${hl.color}`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                reader.openHighlightPopover(hl, {
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenu({
                                  text: hl.text,
                                  x: e.clientX,
                                  y: e.clientY,
                                  pageNumber: page.pageNumber,
                                });
                              }}
                            >
                              {chunk.text}
                            </button>
                          );
                        })}
                      </p>
                    );
                  })}
                </div>
              </article>
            );
          })}

          {/* Bottom sentinel: triggers next 5 pages on demand before reaching bottom */}
          <div ref={bottomSentinelRef} className="h-16 w-full flex items-center justify-center">
            {reader.currentPage < reader.totalPages && (
              <span className="text-xs text-tx-faint animate-pulse">Loading next pages...</span>
            )}
          </div>
        </div>
      </main>

      {/* 3. Immersive Bottom Page Jump Controller */}
      <footer
        className={`fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 transition-all duration-300 ease-in-out ${
          isChromeVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-12 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-line-subtle bg-surface/95 px-4 py-1.5 shadow-xl backdrop-blur-md text-xs font-semibold">
          <span className="text-tx-muted">Page</span>
          <input
            type="number"
            min={1}
            max={reader.totalPages}
            value={pageInputValue}
            onFocus={() => {
              isPageInputFocusedRef.current = true;
            }}
            onChange={(e) => setPageInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = Number.parseInt(pageInputValue, 10);
                if (!Number.isNaN(target) && target >= 1 && target <= reader.totalPages) {
                  scrollToPage(target);
                  (e.target as HTMLInputElement).blur();
                }
              }
            }}
            onBlur={() => {
              isPageInputFocusedRef.current = false;
              const target = Number.parseInt(pageInputValue, 10);
              if (!Number.isNaN(target) && target >= 1 && target <= reader.totalPages) {
                if (target !== reader.currentPage) {
                  scrollToPage(target);
                }
              } else {
                setPageInputValue(String(reader.currentPage));
              }
            }}
            className="w-16 rounded-md border border-line-subtle bg-surface-subtle px-2 py-0.5 text-center font-mono text-xs font-bold text-tx-main focus:border-brand outline-none"
            aria-label="Direct page number jump"
          />
          <span className="text-tx-muted font-mono">of {reader.totalPages}</span>
        </div>
      </footer>

      {/* Subtle Always-Visible Bottom Right Page Number Hint */}
      {!isChromeVisible && (
        <div className="fixed bottom-3 right-4 z-20 text-[0.65rem] font-mono text-tx-faint/60 select-none pointer-events-none transition-opacity duration-300">
          {reader.currentPage} / {reader.totalPages}
        </div>
      )}

      {/* 4. Right-Click Context Menu (Dropdown) */}
      {contextMenu && (
        <ReaderContextMenu
          text={contextMenu.text}
          x={contextMenu.x}
          y={contextMenu.y}
          isOpen={true}
          onHighlightColor={(color) => {
            void reader.createHighlightWithColor(
              color,
              contextMenu.text,
              undefined,
              contextMenu.pageNumber
            );
          }}
          onOpenNoteDialog={() => {
            setActiveNoteDialog({
              text: contextMenu.text,
              pageNumber: contextMenu.pageNumber,
            });
          }}
          onOpenExplainDialog={() => {
            setActiveExplainDialog({
              text: contextMenu.text,
              pageNumber: contextMenu.pageNumber,
            });
          }}
          onOpenTranslateDialog={() => {
            setActiveTranslateDialog({
              text: contextMenu.text,
              pageNumber: contextMenu.pageNumber,
            });
          }}
          onCopyText={() => {
            if (typeof navigator !== 'undefined') {
              void navigator.clipboard.writeText(contextMenu.text);
            }
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 5. Note Creation Dialog */}
      {activeNoteDialog && (
        <NoteDialog
          isOpen={true}
          text={activeNoteDialog.text}
          onSave={(color, note) => {
            void reader.createHighlightWithColor(
              color,
              activeNoteDialog.text,
              note,
              activeNoteDialog.pageNumber
            );
            setActiveNoteDialog(null);
          }}
          onOpenStudio={() => {
            void reader
              .createHighlightWithColor(
                '#eab308',
                activeNoteDialog.text,
                '',
                activeNoteDialog.pageNumber
              )
              .then((hl) => {
                if (hl) reader.openExpandedStudio(hl);
              });
            setActiveNoteDialog(null);
          }}
          onClose={() => setActiveNoteDialog(null)}
        />
      )}

      {/* 6. AI Explanation Dialog */}
      {activeExplainDialog && (
        <ExplainDialog
          isOpen={true}
          text={activeExplainDialog.text}
          bookTitle={`${reader.document.bookTitle} (${reader.document.chapterTitle})`}
          onSaveAsAnnotation={(explanation) => {
            void reader.createHighlightWithColor(
              '#a855f7',
              activeExplainDialog.text,
              `[IA Explanation]: ${explanation}`,
              activeExplainDialog.pageNumber
            );
            setActiveExplainDialog(null);
          }}
          onClose={() => setActiveExplainDialog(null)}
        />
      )}

      {/* 7. Translation Dialog */}
      {activeTranslateDialog && (
        <TranslateDialog
          isOpen={true}
          text={activeTranslateDialog.text}
          onSaveAsNote={(translation) => {
            void reader.createHighlightWithColor(
              '#38bdf8',
              activeTranslateDialog.text,
              `[Tradução]: ${translation}`,
              activeTranslateDialog.pageNumber
            );
            setActiveTranslateDialog(null);
          }}
          onClose={() => setActiveTranslateDialog(null)}
        />
      )}

      {/* Floating Highlight Quick Popover (Anchored right above the in-place highlight) */}
      {reader.activeHighlightPopover && (
        <HighlightPopover
          highlight={reader.activeHighlightPopover.highlight}
          x={reader.activeHighlightPopover.x}
          y={reader.activeHighlightPopover.y}
          noteDraft={reader.noteInput}
          onNoteChange={reader.updateNoteDraft}
          onChangeColor={(color) =>
            void reader.changeHighlightColor(
              reader.activeHighlightPopover?.highlight.id ?? '',
              color
            )
          }
          onDelete={() =>
            void reader.deleteHighlight(reader.activeHighlightPopover?.highlight.id ?? '')
          }
          onExpand={() => {
            if (reader.activeHighlightPopover) {
              reader.openExpandedStudio(reader.activeHighlightPopover.highlight);
            }
          }}
          onClose={reader.closeHighlightPopover}
        />
      )}

      {/* Dedicated Expanded Studio Modal */}
      {reader.expandedHighlight && (
        <HighlightDetailModal
          highlight={reader.expandedHighlight}
          noteInput={reader.noteInput}
          formattedAnnotations={reader.formattedAnnotations}
          llmPromptPreview={reader.llmPromptPreview}
          onNoteChange={reader.updateNoteDraft}
          onSelectionChange={reader.updateSelectionRange}
          onApplyFormat={(style) => void reader.applyAssistedFormat(style)}
          onAttachBoard={(kind) => void reader.attachVisualBoard(kind)}
          onGeneratePrompt={() => void reader.generateContextualPrompt()}
          onClose={reader.closeExpandedStudio}
        />
      )}
    </section>
  );
}
