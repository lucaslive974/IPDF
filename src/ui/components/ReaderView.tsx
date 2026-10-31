import { useEffect, useRef } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useReader } from '../hooks/useReader';
import { HighlightDetailModal } from './HighlightDetailModal';
import { HighlightPopover } from './HighlightPopover';
import { SelectionActionMenu } from './SelectionActionMenu';
import { Button, IconButton } from './ui';

export function ReaderView() {
  const reader = useReader();
  const navigation = useNavigation();
  const contentAreaRef = useRef<HTMLDivElement>(null);

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

  const percentage = Math.round((reader.currentPage / reader.totalPages) * 100);

  return (
    <div className="relative min-h-screen bg-canvas text-tx-main flex flex-col justify-between selection:bg-amber-300/40 selection:text-amber-900 dark:selection:bg-amber-400/30 dark:selection:text-amber-200">
      {/* 1. Minimal distraction-free Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line-subtle bg-surface/80 px-6 py-3 backdrop-blur-md transition-all">
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

      {/* 2. Main Reader Document Surface */}
      <main className="flex-1 flex justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl flex flex-col gap-8">
          <div className="text-center">
            <h1 className="text-2xl font-serif font-bold text-tx-main sm:text-3xl tracking-tight">
              {reader.document.chapterTitle}
            </h1>
            <p className="mt-1 text-xs text-tx-muted tracking-wider uppercase font-semibold">
              {reader.document.bookAuthor} &bull; {reader.document.bookTitle}
            </p>
          </div>

          <div
            ref={contentAreaRef}
            className="rounded-2xl border border-line-subtle bg-surface p-6 sm:p-10 text-lg leading-relaxed text-tx-main font-serif tracking-normal shadow-xs"
          >
            <p className="indent-6 mb-6">{reader.document.sampleParagraph}</p>

            <p className="indent-6">
              And if they were in the habit of conferring honours among themselves on those who were
              quickest to observe the passing shadows and to remark which of them went before, and
              which followed after, and which were together; and who were therefore best able to
              draw conclusions as to the future, do you think that he would care for such honours
              and glories, or envy the possessors of them?
            </p>

            {/* Render active page highlights */}
            {reader.highlights.length > 0 && (
              <div className="mt-8 border-t border-line-subtle pt-4 flex flex-col gap-2">
                <span className="text-[0.7rem] uppercase tracking-wider font-semibold text-tx-muted">
                  Highlights on this page ({reader.highlights.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {reader.highlights.map((hl) => (
                    <Button
                      key={hl.id}
                      variant="secondary"
                      size="xs"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        reader.openHighlightPopover(hl, {
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: hl.color }}
                      />
                      <span className="max-w-44 truncate italic">&ldquo;{hl.text}&rdquo;</span>
                      {hl.note && <span className="text-tx-muted">📝</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 3. Floating Bottom Navigation Controller */}
      <footer className="sticky bottom-4 z-20 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line-subtle bg-surface/90 px-5 py-2 shadow-xl backdrop-blur-md text-xs font-semibold">
          <Button
            variant="ghost"
            size="xs"
            disabled={reader.currentPage <= 1}
            onClick={() => void reader.navigatePage(-1)}
          >
            &larr; Prev
          </Button>

          <span className="text-tx-faint">|</span>

          <span className="font-mono text-tx-secondary">
            {reader.currentPage} / {reader.totalPages}
          </span>

          <span className="text-tx-faint">|</span>

          <Button
            variant="ghost"
            size="xs"
            disabled={reader.currentPage >= reader.totalPages}
            onClick={() => void reader.navigatePage(1)}
          >
            Next &rarr;
          </Button>
        </div>
      </footer>

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

      {/* Floating Highlight Quick Popover */}
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

      {/* Expanded Studio Modal */}
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
    </div>
  );
}
