import type { Highlight } from '../../core/domain/Highlight';

export interface HighlightCardProps {
  readonly highlight: Highlight;
  readonly isActive: boolean;
  readonly onSelect: (highlightId: string) => void;
}

export function HighlightCard({ highlight, isActive, onSelect }: HighlightCardProps) {
  return (
    <div
      className={`cursor-pointer rounded-lg border border-slate-800 border-l-[5px] bg-slate-950 p-3.5 transition hover:border-slate-700 ${
        isActive ? 'ring-2 ring-sky-400' : ''
      }`}
      style={{ borderLeftColor: highlight.color }}
      onClick={() => onSelect(highlight.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onSelect(highlight.id);
        }
      }}
    >
      <strong className="text-sm font-semibold text-slate-100">“{highlight.text}”</strong>
      <div className="mt-1 text-xs text-slate-400">Note: {highlight.note || '(empty)'}</div>
    </div>
  );
}
