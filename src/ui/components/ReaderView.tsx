import { useEffect, useRef } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import type {
  ActiveHighlightPopoverState,
  SelectionPopoverState,
  StudyDocumentDescriptor,
} from '../hooks/useStudyWorkbenchViewModel';
import { HighlightPopover } from './HighlightPopover';
import { SelectionActionMenu } from './SelectionActionMenu';

export interface ReaderViewProps {
  readonly document: StudyDocumentDescriptor;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly highlights: Highlight[];
  readonly selectionPopover: SelectionPopoverState | null;
  readonly activeHighlightPopover: ActiveHighlightPopoverState | null;
  readonly noteDraft: string;
  readonly onBackToLibrary: () => void;
  readonly onOpenSettings: () => void;
  readonly onNavigatePage: (delta: number) => void;
  readonly onSelectText: (state: SelectionPopoverState | null) => void;
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onCloseHighlightPopover: () => void;
  readonly onCreateHighlight: (colorHex: string) => void;
  readonly onChangeHighlightColor: (highlightId: string, colorHex: string) => void;
  readonly onDeleteHighlight: (highlightId: string) => void;
  readonly onNoteChange: (text: string) => void;
  readonly onExpandHighlight: () => void;
  readonly onExplainSelection: () => void;
  readonly onDefineSelection: () => void;
  readonly onTranslateSelection: () => void;
}

export function ReaderView({
  document,
  currentPage,
  totalPages,
  highlights,
  selectionPopover,
  activeHighlightPopover,
  noteDraft,
  onBackToLibrary,
  onOpenSettings,
  onNavigatePage,
  onSelectText,
  onHighlightClick,
  onCloseHighlightPopover,
  onCreateHighlight,
  onChangeHighlightColor,
  onDeleteHighlight,
  onNoteChange,
  onExpandHighlight,
  onExplainSelection,
  onDefineSelection,
  onTranslateSelection,
}: ReaderViewProps) {
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
        onSelectText({
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
  }, [onSelectText]);

  const percentage = Math.round((currentPage / totalPages) * 100);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400/30 selection:text-amber-200">
      {/* 1. Minimal distraction-free Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 py-3 backdrop-blur-md transition-all">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white active:scale-95"
            onClick={onBackToLibrary}
          >
            <span>&larr;</span>
            <span>Library</span>
          </button>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-semibold text-slate-200">
              {document.bookAuthor} &mdash; {document.bookTitle}
            </span>
            <span className="text-[0.7rem] text-slate-400">{document.chapterTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-300">
            <span className="font-mono text-sky-400">{percentage}%</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            onClick={onOpenSettings}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* 2. Main Reader Document Surface */}
      <main className="flex-1 flex justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl flex flex-col gap-8">
          <div className="text-center">
            <h1 className="text-2xl font-serif font-bold text-slate-100 sm:text-3xl tracking-tight">
              {document.chapterTitle}
            </h1>
            <p className="mt-1 text-xs text-slate-400 tracking-wider uppercase font-semibold">
              {document.bookAuthor} &bull; {document.bookTitle}
            </p>
          </div>

          <div
            ref={contentAreaRef}
            className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6 sm:p-10 text-lg leading-relaxed text-slate-200 font-serif tracking-normal shadow-sm"
          >
            <p className="indent-6 mb-6">{document.sampleParagraph}</p>

            <p className="indent-6">
              And if they were in the habit of conferring honours among themselves on those who were
              quickest to observe the passing shadows and to remark which of them went before, and
              which followed after, and which were together; and who were therefore best able to
              draw conclusions as to the future, do you think that he would care for such honours
              and glories, or envy the possessors of them?
            </p>

            {/* Render active page highlights */}
            {highlights.length > 0 && (
              <div className="mt-8 border-t border-slate-800/80 pt-4 flex flex-col gap-2">
                <span className="text-[0.7rem] uppercase tracking-wider font-semibold text-slate-400">
                  Highlights on this page ({highlights.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {highlights.map((hl) => (
                    <button
                      key={hl.id}
                      type="button"
                      className="group flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-700 hover:bg-slate-800 active:scale-95"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onHighlightClick(hl, {
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
                      {hl.note && <span className="text-slate-400">📝</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 3. Floating Bottom Navigation Controller */}
      <footer className="sticky bottom-4 z-20 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/90 px-5 py-2 shadow-2xl backdrop-blur-md text-xs font-semibold">
          <button
            type="button"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition active:scale-95 disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => onNavigatePage(-1)}
          >
            <span>&larr;</span>
            <span>Prev</span>
          </button>

          <span className="text-slate-500">|</span>

          <span className="font-mono text-slate-300">
            {currentPage} / {totalPages}
          </span>

          <span className="text-slate-500">|</span>

          <button
            type="button"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition active:scale-95 disabled:opacity-40"
            disabled={currentPage >= totalPages}
            onClick={() => onNavigatePage(1)}
          >
            <span>Next</span>
            <span>&rarr;</span>
          </button>
        </div>
      </footer>

      {/* Floating Selection Action Popover Menu */}
      {selectionPopover && (
        <SelectionActionMenu
          text={selectionPopover.text}
          x={selectionPopover.x}
          y={selectionPopover.y}
          onHighlight={(color) => onCreateHighlight(color)}
          onExplain={onExplainSelection}
          onDefineTerm={onDefineSelection}
          onTranslate={onTranslateSelection}
          onClose={() => onSelectText(null)}
        />
      )}

      {/* Floating Highlight Quick Popover */}
      {activeHighlightPopover && (
        <HighlightPopover
          highlight={activeHighlightPopover.highlight}
          x={activeHighlightPopover.x}
          y={activeHighlightPopover.y}
          noteDraft={noteDraft}
          onNoteChange={onNoteChange}
          onChangeColor={(color) =>
            onChangeHighlightColor(activeHighlightPopover.highlight.id, color)
          }
          onDelete={() => onDeleteHighlight(activeHighlightPopover.highlight.id)}
          onExpand={onExpandHighlight}
          onClose={onCloseHighlightPopover}
        />
      )}
    </div>
  );
}
