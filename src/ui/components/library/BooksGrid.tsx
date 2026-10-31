import { memo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { BookIcon, EmptyState } from '../ui';
import { BookCard } from './BookCard';

export interface BooksGridProps {
  readonly books: readonly BookMetadata[];
  readonly onOpenBook: (book: BookMetadata) => void;
  readonly onRenameBook?: (book: BookMetadata) => void;
  readonly onImportClick?: () => void;
}

export const BooksGrid = memo(function BooksGrid({
  books,
  onOpenBook,
  onRenameBook,
  onImportClick,
}: BooksGridProps) {
  if (books.length === 0) {
    return (
      <EmptyState
        icon={<BookIcon className="h-6 w-6" />}
        title="No books found"
        description="Import an EPUB or PDF file to start your active study reading session."
        action={
          onImportClick && (
            <button
              type="button"
              className="text-xs font-semibold text-tx-main underline hover:opacity-80 cursor-pointer"
              onClick={onImportClick}
            >
              Import a book
            </button>
          )
        }
        className="col-span-full py-14"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {books.map((book) => (
        <BookCard
          key={book.bookHash}
          book={book}
          onOpenBook={onOpenBook}
          onRenameBook={onRenameBook}
        />
      ))}
    </div>
  );
});
