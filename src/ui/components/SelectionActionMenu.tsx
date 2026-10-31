export interface SelectionActionMenuProps {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly onHighlight: (colorHex: string) => void;
  readonly onExplain: () => void;
  readonly onDefineTerm: () => void;
  readonly onTranslate: () => void;
  readonly onClose: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Yellow', hex: '#eab308', classBg: 'bg-amber-400' },
  { label: 'Green', hex: '#22c55e', classBg: 'bg-emerald-500' },
  { label: 'Blue', hex: '#38bdf8', classBg: 'bg-sky-400' },
  { label: 'Purple', hex: '#a855f7', classBg: 'bg-purple-500' },
  { label: 'Rose', hex: '#f43f5e', classBg: 'bg-rose-500' },
];

export function SelectionActionMenu({
  text,
  x,
  y,
  onHighlight,
  onExplain,
  onDefineTerm,
  onTranslate,
  onClose,
}: SelectionActionMenuProps) {
  return (
    <div
      className="fixed z-50 flex -translate-x-1/2 flex-col gap-2 rounded-xl border border-line-subtle bg-surface/95 p-2 shadow-xl backdrop-blur-md transition-all duration-200"
      style={{
        left: `${x}px`,
        top: `${Math.max(16, y - 60)}px`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 border-r border-line-subtle pr-1.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={`Highlight ${c.label}`}
              className={`h-5 w-5 rounded-full ${c.classBg} transition hover:scale-110 active:scale-95`}
              onClick={() => onHighlight(c.hex)}
            />
          ))}
        </div>

        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-tx-secondary hover:bg-surface-subtle hover:text-tx-main active:scale-95 transition"
          onClick={onExplain}
        >
          <span>✨</span>
          <span>Explain</span>
        </button>

        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-tx-secondary hover:bg-surface-subtle hover:text-tx-main active:scale-95 transition"
          onClick={onDefineTerm}
        >
          <span>📖</span>
          <span>Term</span>
        </button>

        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-tx-secondary hover:bg-surface-subtle hover:text-tx-main active:scale-95 transition"
          onClick={onTranslate}
        >
          <span>🌐</span>
          <span>Translate</span>
        </button>

        <button
          type="button"
          className="ml-1 rounded-md px-1.5 py-0.5 text-xs text-tx-faint hover:bg-surface-subtle hover:text-tx-main"
          onClick={onClose}
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="max-w-64 truncate text-[0.65rem] text-tx-muted italic px-1">
        &ldquo;{text}&rdquo;
      </div>
    </div>
  );
}
