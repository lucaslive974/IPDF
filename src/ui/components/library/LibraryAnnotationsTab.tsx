import { memo, useEffect } from 'react';
import { useLibraryAnnotations } from '../../hooks/useLibraryAnnotations';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { BookIcon, Button, EmptyState } from '../ui';
import { BookAnnotationGroupCard } from './BookAnnotationGroupCard';

export interface LibraryAnnotationsTabProps {
  readonly searchQuery?: string;
}

export const LibraryAnnotationsTab = memo(function LibraryAnnotationsTab({
  searchQuery = '',
}: LibraryAnnotationsTabProps) {
  const { books } = useLibraryStore();
  const {
    groupedByBook,
    isLoading,
    selectedBookHash,
    onlyWithNotes,
    copiedHighlightId,
    totalAnnotationsCount,
    setSearchQuery,
    setSelectedBookHash,
    setOnlyWithNotes,
    deleteHighlight,
    jumpToReader,
    copyQuote,
  } = useLibraryAnnotations();

  // Sync external search query from LibraryView header
  useEffect(() => {
    setSearchQuery(searchQuery);
  }, [searchQuery, setSearchQuery]);

  const hasAnyAnnotationsInLibrary =
    books.length > 0 &&
    (totalAnnotationsCount > 0 ||
      Boolean(searchQuery) ||
      selectedBookHash !== 'all' ||
      onlyWithNotes);

  if (isLoading && groupedByBook.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-xs text-tx-muted font-mono animate-pulse">
          Loading annotations from SQLite...
        </span>
      </div>
    );
  }

  if (!hasAnyAnnotationsInLibrary && groupedByBook.length === 0) {
    return (
      <EmptyState
        icon={<BookIcon className="h-8 w-8" />}
        title="No annotations yet"
        description="As you read books and highlight passages, your saved quotes, reflections, and notes will be organized here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters and Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-subtle/50 border border-line-subtle px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Book filter selector */}
          <select
            value={selectedBookHash}
            onChange={(e) => setSelectedBookHash(e.target.value)}
            className="rounded-md border border-line-subtle bg-canvas px-2.5 py-1 text-xs text-tx-main shadow-2xs focus:border-tx-main focus:outline-hidden"
          >
            <option value="all">All Books</option>
            {books.map((book) => (
              <option key={book.bookHash} value={book.bookHash}>
                {book.title}
              </option>
            ))}
          </select>

          {/* Notes only toggle */}
          <Button
            variant={onlyWithNotes ? 'primary' : 'ghost'}
            size="xs"
            onClick={() => setOnlyWithNotes(!onlyWithNotes)}
            className="text-[0.72rem]"
          >
            {onlyWithNotes ? '✓ Notes only' : 'Notes only'}
          </Button>
        </div>

        {/* Metrics */}
        <span className="text-[0.7rem] font-mono text-tx-muted">
          {totalAnnotationsCount} {totalAnnotationsCount === 1 ? 'annotation' : 'annotations'} in{' '}
          {groupedByBook.length} {groupedByBook.length === 1 ? 'book' : 'books'}
        </span>
      </div>

      {/* Empty State when filters yield 0 results */}
      {groupedByBook.length === 0 && (
        <EmptyState
          title="No annotations match your filter"
          description={
            searchQuery
              ? `No quotes or notes matched "${searchQuery}".`
              : 'Try selecting "All Books" or disabling "Notes only".'
          }
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setSelectedBookHash('all');
                setOnlyWithNotes(false);
              }}
            >
              Reset filters
            </Button>
          }
        />
      )}

      {/* Book Groups */}
      <div className="flex flex-col gap-4">
        {groupedByBook.map((group) => (
          <BookAnnotationGroupCard
            key={group.bookHash}
            group={group}
            copiedHighlightId={copiedHighlightId}
            onCopyHighlight={copyQuote}
            onDeleteHighlight={deleteHighlight}
            onJumpToReader={jumpToReader}
          />
        ))}
      </div>
    </div>
  );
});
