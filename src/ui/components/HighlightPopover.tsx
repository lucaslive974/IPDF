import type { Highlight } from '../../core/domain/Highlight';

export interface HighlightPopoverProps {
  readonly highlight: Highlight;
  readonly x: number;
  readonly y: number;
  readonly noteDraft: string;
  readonly onNoteChange: (text: string) => void;
  readonly onChangeColor: (colorHex: string) => void;
  readonly onExpand: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

const COLOR_PRESETS = [
  { label: 'Yellow', hex: '#eab308', classBg: 'bg-amber-400' },
  { label: 'Green', hex: '#22c55e', classBg: 'bg-emerald-500' },
  { label: 'Blue', hex: '#38bdf8', classBg: 'bg-sky-400' },
  { label: 'Purple', hex: '#a855f7', classBg: 'bg-purple-500' },
  { label: 'Rose', hex: '#f43f5e', classBg: 'bg-rose-500' },
];

export function HighlightPopover({
  highlight,
  x,
  y,
  noteDraft,
  onNoteChange,
  onChangeColor,
  onExpand,
  onDelete,
  onClose,
}: HighlightPopoverProps) {
  const annotationsCount = highlight.getAllRichAnnotations().length;

  return (
    <div
      className="fixed z-50 flex w-76 -translate-x-1/2 flex-col gap-2.5 rounded-xl border border-line-subtle bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200"
      style={{
        left: `${x}px`,
        top: `${Math.max(16, y - 110)}px`,
      }}
    >
      <div className="flex items-center justify-between border-b border-line-subtle pb-2">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: highlight.color }} />
          <span className="text-xs font-semibold text-tx-main">Highlight</span>
          {annotationsCount > 0 && (
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-sky-600 dark:text-sky-400">
              {annotationsCount} rich
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1 text-xs text-rose-500 hover:bg-rose-500/10 transition"
            onClick={onDelete}
            title="Delete Highlight"
          >
            🗑️
          </button>
          <button
            type="button"
            className="rounded p-1 text-xs text-tx-faint hover:bg-surface-subtle hover:text-tx-main"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="max-h-16 overflow-y-auto text-xs text-tx-secondary italic border-l-2 border-line-strong pl-2">
        &ldquo;{highlight.text}&rdquo;
      </div>

      <div className="flex items-center gap-1.5 py-1">
        <span className="text-[0.7rem] text-tx-muted">Color:</span>
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.hex}
            type="button"
            className={`h-4 w-4 rounded-full ${c.classBg} transition hover:scale-125 ${
              highlight.color === c.hex ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface' : ''
            }`}
            onClick={() => onChangeColor(c.hex)}
          />
        ))}
      </div>

      <textarea
        className="w-full rounded-lg border border-line-subtle bg-surface-subtle p-2 text-xs text-tx-main placeholder:text-tx-faint focus:border-brand focus:outline-none"
        rows={2}
        placeholder="Add personal note..."
        value={noteDraft}
        onChange={(e) => onNoteChange(e.target.value)}
      />

      <div className="flex items-center justify-between pt-1">
        <span className="text-[0.65rem] text-tx-faint">Page {highlight.anchor.pageNumber}</span>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md bg-linear-to-r from-sky-600 to-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-md transition hover:from-sky-500 hover:to-indigo-500 active:scale-95"
          onClick={onExpand}
        >
          <span>Studio Expand</span>
          <span>↗</span>
        </button>
      </div>
    </div>
  );
}
