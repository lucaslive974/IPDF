import { memo } from 'react';
import { useLibraryAnnotations } from '../../hooks/useLibraryAnnotations';
import { BookIcon, Button, EmptyState } from '../ui';
import { AnnotationsToolbar } from './AnnotationsToolbar';
import { BookAnnotationGroupCard } from './BookAnnotationGroupCard';

export interface LibraryAnnotationsTabProps {
  readonly searchQuery?: string;
}

export const LibraryAnnotationsTab = memo(function LibraryAnnotationsTab({
  searchQuery = '',
}: LibraryAnnotationsTabProps) {
  const {
    groupedByBook,
    isLoading,
    isEmptyLibrary,
    isFilterEmpty,
    selectedBookHash,
    onlyWithNotes,
    bookFilterOptions,
    totalAnnotationsCount,
    copiedHighlightId,
    setSelectedBookHash,
    setOnlyWithNotes,
    resetFilters,
    deleteHighlight,
    jumpToReader,
    copyQuote,
  } = useLibraryAnnotations({ searchQuery });

  if (isLoading && groupedByBook.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-xs text-tx-muted font-mono animate-pulse">
          Loading annotations from SQLite...
        </span>
      </div>
    );
  }

  if (isEmptyLibrary) {
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
      <AnnotationsToolbar
        selectedBookHash={selectedBookHash}
        bookFilterOptions={bookFilterOptions}
        onlyWithNotes={onlyWithNotes}
        totalCount={totalAnnotationsCount}
        booksCount={groupedByBook.length}
        onSelectBook={setSelectedBookHash}
        onToggleNotesOnly={() => setOnlyWithNotes(!onlyWithNotes)}
      />

      {isFilterEmpty ? (
        <EmptyState
          title="No annotations match your filter"
          description={
            searchQuery
              ? `No quotes or notes matched "${searchQuery}".`
              : 'Try selecting "All Books" or disabling "Notes only".'
          }
          action={
            <Button variant="outline" size="xs" onClick={resetFilters}>
              Reset filters
            </Button>
          }
        />
      ) : (
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
      )}
    </div>
  );
});
