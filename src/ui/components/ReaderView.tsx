import { useCallback, useEffect, useRef, useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import { useNavigation } from '../hooks/useNavigation';
import { useReader } from '../hooks/useReader';
import { HighlightDetailModal } from './HighlightDetailModal';
import { HighlightPopover } from './HighlightPopover';
import { SelectionActionMenu } from './SelectionActionMenu';
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
    let searchIndex = 0;
    while (searchIndex < paragraph.length) {
      const idx = paragraph.indexOf(hl.text, searchIndex);
      if (idx === -1) break;
      matches.push({
        start: idx,
        end: idx + hl.text.length,
        highlight: hl,
      });
      searchIndex = idx + hl.text.length;
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
  const [touchOffset, setTouchOffset] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const wheelAccumulatorRef = useRef<number>(0);
  const wheelLockRef = useRef<boolean>(false);

  const contentAreaRef = useRef<HTMLDivElement>(null);

  const turnPage = useCallback(
    async (delta: number) => {
      if (isAnimating) return;
      if (delta < 0 && reader.currentPage <= 1) return;
      if (delta > 0 && reader.currentPage >= reader.totalPages) return;

      setIsAnimating(true);
      await reader.navigatePage(delta);
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    },
    [isAnimating, reader]
  );

  // 1. Mouse Selection Popover Handler
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }
      const text = selection.toString().trim();
      if (text.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        reader.setSelectionPopover({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
    };

    const container = contentAreaRef.current;
    if (container) {
      container.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      if (container) {
        container.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [reader.setSelectionPopover]);

  // 2. Mouse Wheel Scroll (Continuous Scroll / Infinite Turn Feeling)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (reader.expandedHighlight) return;

      wheelAccumulatorRef.current += e.deltaY;

      if (wheelLockRef.current) return;

      const threshold = 60;
      if (wheelAccumulatorRef.current > threshold) {
        wheelLockRef.current = true;
        wheelAccumulatorRef.current = 0;
        void turnPage(1);
        setTimeout(() => {
          wheelLockRef.current = false;
        }, 350);
      } else if (wheelAccumulatorRef.current < -threshold) {
        wheelLockRef.current = true;
        wheelAccumulatorRef.current = 0;
        void turnPage(-1);
        setTimeout(() => {
          wheelLockRef.current = false;
        }, 350);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [reader.expandedHighlight, turnPage]);

  // 3. Touch Drag / Swipe Gestures on Mobile & Touchscreens
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwipingRef.current = true;
      setTouchOffset(deltaX * 0.4);
    }
  };

  const handleTouchEnd = () => {
    const currentOffset = touchOffset;
    setTouchOffset(0);

    if (!isSwipingRef.current) return;

    const swipeThreshold = 40;
    if (currentOffset < -swipeThreshold) {
      void turnPage(1);
    } else if (currentOffset > swipeThreshold) {
      void turnPage(-1);
    }
  };

  // 4. Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (reader.expandedHighlight || reader.selectionPopover) return;
      if (e.key === 'Escape') {
        setIsChromeVisible((prev) => !prev);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        void turnPage(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        void turnPage(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [reader.expandedHighlight, reader.selectionPopover, turnPage]);

  // 5. Immersive Click / Tap Toggle for Chrome
  const handleViewportClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="button"], input, textarea, pre')) {
      return;
    }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      return;
    }
    setIsChromeVisible((prev) => !prev);
  };

  const percentage = Math.round((reader.currentPage / reader.totalPages) * 100);

  // Paragraph texts representing continuous book content
  const sampleParagraphs = [
    reader.document.sampleParagraph,
    'Above and behind them a fire is blazing at a distance, and between the fire and the prisoners there is a raised way; and you will see, if you look, a low wall built along the way, like the screen which marionette players have in front of them, over which they show the puppets.',
    'And if they were in the habit of conferring honours among themselves on those who were quickest to observe the passing shadows and to remark which of them went before, and which followed after, and which were together; and who were therefore best able to draw conclusions as to the future, do you think that he would care for such honours and glories, or envy the possessors of them?',
  ];

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
            <span className="text-[0.7rem] text-tx-muted">{reader.document.chapterTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line-subtle bg-surface px-3 py-1 text-xs text-tx-secondary">
            <span className="font-mono text-sky-600 dark:text-sky-400">{percentage}%</span>
            <span className="text-tx-faint">&bull;</span>
            <span className="text-tx-muted">
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

      {/* 2. Full-Screen Book Reading Surface (100% Immersive) */}
      <main className="flex-1 flex justify-center items-center px-4 sm:px-12 py-12 sm:py-20">
        <div
          ref={contentAreaRef}
          className="w-full max-w-2xl flex flex-col gap-8 transition-transform duration-200 ease-out"
          style={{
            transform: `translateX(${touchOffset}px)`,
          }}
        >
          {/* Chapter Heading */}
          <div className="text-center mb-2">
            <h1 className="text-2xl font-serif font-bold text-tx-main sm:text-3xl tracking-tight">
              {reader.document.chapterTitle}
            </h1>
            <p className="mt-1 text-xs text-tx-muted tracking-wider uppercase font-semibold">
              {reader.document.bookAuthor} &bull; {reader.document.bookTitle}
            </p>
          </div>

          {/* Book Page Content with Inline Highlights directly over text */}
          <div className="space-y-6 text-lg sm:text-xl leading-relaxed text-tx-main font-serif tracking-normal">
            {sampleParagraphs.map((paragraph, pIdx) => {
              const chunks = tokenizeTextWithHighlights(paragraph, reader.highlights);

              return (
                <p key={`p-${pIdx + 1}`} className="indent-6 text-justify">
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
                      >
                        {chunk.text}
                      </button>
                    );
                  })}
                </p>
              );
            })}
          </div>
        </div>
      </main>

      {/* 3. Immersive Bottom Controller (Shows on click / tap) */}
      <footer
        className={`fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 transition-all duration-300 ease-in-out ${
          isChromeVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-12 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 rounded-full border border-line-subtle bg-surface/90 px-5 py-2 shadow-xl backdrop-blur-md text-xs font-semibold">
          <Button
            variant="ghost"
            size="xs"
            disabled={reader.currentPage <= 1}
            onClick={() => void turnPage(-1)}
          >
            &larr; Prev
          </Button>

          <span className="text-tx-faint">|</span>

          <span className="font-mono text-tx-secondary">
            Page {reader.currentPage} of {reader.totalPages}
          </span>

          <span className="text-tx-faint">|</span>

          <Button
            variant="ghost"
            size="xs"
            disabled={reader.currentPage >= reader.totalPages}
            onClick={() => void turnPage(1)}
          >
            Next &rarr;
          </Button>
        </div>
      </footer>

      {/* Subtle Always-Visible Bottom Right Page Number Hint */}
      {!isChromeVisible && (
        <div className="fixed bottom-3 right-4 z-20 text-[0.65rem] font-mono text-tx-faint/60 select-none pointer-events-none transition-opacity duration-300">
          {reader.currentPage} / {reader.totalPages}
        </div>
      )}

      {/* Floating Selection Action Popover Menu */}
      {reader.selectionPopover && (
        <SelectionActionMenu
          text={reader.selectionPopover.text}
          x={reader.selectionPopover.x}
          y={reader.selectionPopover.y}
          onHighlight={(color) => void reader.createHighlightWithColor(color)}
          onExplain={() => void reader.generateContextualPrompt()}
          onDefineTerm={() => void reader.generateContextualPrompt('Define philosophical term')}
          onTranslate={() =>
            void reader.generateContextualPrompt('Translate passage into Portuguese')
          }
          onClose={() => reader.setSelectionPopover(null)}
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
