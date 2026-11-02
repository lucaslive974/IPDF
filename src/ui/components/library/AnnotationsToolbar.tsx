import { memo } from 'react';
import type { BookFilterOption } from '../../hooks/useLibraryAnnotations';
import { BookIcon, Button, FilterButton } from '../ui';

export interface AnnotationsToolbarProps {
  readonly selectedBookHash: string | 'all';
  readonly bookFilterOptions: readonly BookFilterOption[];
  readonly onlyWithNotes: boolean;
  readonly totalCount: number;
  readonly booksCount: number;
  readonly onSelectBook: (bookHash: string | 'all') => void;
  readonly onToggleNotesOnly: () => void;
}

export const AnnotationsToolbar = memo(function AnnotationsToolbar({
  selectedBookHash,
  bookFilterOptions,
  onlyWithNotes,
  totalCount,
  booksCount,
  onSelectBook,
  onToggleNotesOnly,
}: AnnotationsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          icon={<BookIcon className="h-3.5 w-3.5" />}
          value={selectedBookHash}
          options={bookFilterOptions}
          onChange={onSelectBook}
          ariaLabel="Filter annotations by book"
        />

        <Button
          variant={onlyWithNotes ? 'secondary' : 'minimal'}
          size="xs"
          onClick={onToggleNotesOnly}
          className="text-[0.72rem]"
        >
          {onlyWithNotes ? '✓ Notes only' : 'Notes only'}
        </Button>
      </div>

      <span className="text-[0.7rem] font-mono text-tx-muted">
        {totalCount} {totalCount === 1 ? 'annotation' : 'annotations'} in {booksCount}{' '}
        {booksCount === 1 ? 'book' : 'books'}
      </span>
    </div>
  );
});
