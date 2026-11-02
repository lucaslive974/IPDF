import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';

export interface ParagraphMarginNotesProps {
  readonly notes: readonly Highlight[];
  readonly onNoteClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
}

export const ParagraphMarginNotes = memo(function ParagraphMarginNotes({
  notes,
  onNoteClick,
}: ParagraphMarginNotesProps) {
  if (notes.length === 0) return null;

  return (
    <div
      className="absolute -right-8 sm:-right-9 top-0.5 flex flex-col gap-1.5 select-none opacity-60 hover:opacity-100 transition-opacity"
      aria-label="Margin notes"
    >
      {notes.map((hl) => (
        <button
          key={`p-note-${hl.id}`}
          type="button"
          aria-label="View annotation note"
          title={hl.note}
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-surface/80 border border-line-subtle/80 text-tx-muted hover:text-tx-main hover:bg-surface-subtle transition shadow-2xs"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onNoteClick(hl, {
              x: rect.left,
              y: rect.top,
            });
          }}
        >
          <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h1.75v2.25a.75.75 0 0 0 1.28.53L8.06 13H13.5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 3h-11Z" />
          </svg>
        </button>
      ))}
    </div>
  );
});
