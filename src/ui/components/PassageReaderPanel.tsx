import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { Highlight } from '../../core/domain/Highlight';
import type { StudyDocumentDescriptor } from '../hooks/useStudyWorkbenchViewModel';
import { HighlightCard } from './HighlightCard';

export interface HighlightColorOption {
  readonly id: string;
  readonly label: string;
  readonly colorHex: string;
  readonly isPrimary?: boolean;
}

const DEFAULT_HIGHLIGHT_COLORS: HighlightColorOption[] = [
  { id: 'yellow', label: '+ Highlight Yellow', colorHex: '#eab308', isPrimary: true },
  { id: 'green', label: '+ Highlight Green', colorHex: '#22c55e' },
  { id: 'blue', label: '+ Highlight Blue', colorHex: '#38bdf8' },
];

export interface PassageReaderPanelProps {
  readonly document: StudyDocumentDescriptor;
  readonly libraryBooks: BookMetadata[];
  readonly currentPage: number;
  readonly totalPages: number;
  readonly highlights: Highlight[];
  readonly selectedHighlightId: string | null;
  readonly colorOptions?: HighlightColorOption[];
  readonly onCreateHighlight: (colorHex: string) => void;
  readonly onSelectHighlight: (highlightId: string) => void;
  readonly onGeneratePrompt: () => void;
  readonly onSyncBook: () => void;
  readonly onImportSampleBook: () => void;
  readonly onNavigatePage: (delta: number) => void;
}

export function PassageReaderPanel({
  document,
  libraryBooks,
  currentPage,
  totalPages,
  highlights,
  selectedHighlightId,
  colorOptions = DEFAULT_HIGHLIGHT_COLORS,
  onCreateHighlight,
  onSelectHighlight,
  onGeneratePrompt,
  onSyncBook,
  onImportSampleBook,
  onNavigatePage,
}: PassageReaderPanelProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {document.bookAuthor} — {document.bookTitle} ({document.chapterTitle})
          </h2>
          <small className="text-xs text-slate-400">
            SHA-256 Hash: <code className="font-mono text-sky-400">{document.bookHash}</code>
          </small>
        </div>
        <span className="rounded-full border border-sky-400/35 bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-400">
          Phase 2 Library & EPUB
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="font-semibold text-slate-400">Library ({libraryBooks.length}):</span>
          {libraryBooks.map((book) => (
            <span
              key={book.bookHash}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-200"
            >
              {book.title} ({Math.round(book.percentage)}%)
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700"
            onClick={() => onNavigatePage(-1)}
          >
            Prev Page
          </button>
          <span className="font-mono text-sky-400">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="cursor-pointer rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700"
            onClick={() => onNavigatePage(1)}
          >
            Next Page
          </button>
          <button
            type="button"
            className="cursor-pointer rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300 hover:bg-emerald-500/25"
            onClick={onImportSampleBook}
          >
            + Import EPUB (SQLite)
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-400">
        Select any passage below (or click a color button) to create a polymorphic highlight managed
        by <code className="font-mono text-slate-300">AnnotationWorkbenchService</code>:
      </p>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-[1.05rem] leading-relaxed text-slate-200">
        {document.sampleParagraph}
      </div>

      <div className="flex flex-wrap gap-2">
        {colorOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={
              option.isPrimary
                ? 'cursor-pointer rounded-md border border-sky-400 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-500'
                : 'cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700'
            }
            onClick={() => onCreateHighlight(option.colorHex)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700"
          onClick={onGeneratePrompt}
        >
          Generate Contextual Prompt (LLM)
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-slate-700"
          onClick={onSyncBook}
        >
          Sync LWW (CloudlessSyncEngine)
        </button>
      </div>

      <h3 className="mt-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Page {currentPage} Highlights ({highlights.length})
      </h3>
      <div className="flex flex-col gap-2.5">
        {highlights.map((highlight) => (
          <HighlightCard
            key={highlight.id}
            highlight={highlight}
            isActive={highlight.id === selectedHighlightId}
            onSelect={onSelectHighlight}
          />
        ))}
      </div>
    </section>
  );
}
