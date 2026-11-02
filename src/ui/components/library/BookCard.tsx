import { memo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { Badge, Button, Card, IconButton, PencilIcon, ProgressBar, TrashIcon } from '../ui';
import { BookCover, isValidAuthor } from './BookCover';

export interface BookCardProps {
  readonly book: BookMetadata;
  readonly onOpenBook: (book: BookMetadata) => void;
  readonly onRenameBook?: (book: BookMetadata) => void;
  readonly onDeleteBook?: (book: BookMetadata) => void;
}

export const BookCard = memo(function BookCard({
  book,
  onOpenBook,
  onRenameBook,
  onDeleteBook,
}: BookCardProps) {
  const showAuthor = isValidAuthor(book.author);

  return (
    <Card
      variant="interactive"
      padding="md"
      className="group flex flex-col justify-between overflow-hidden"
    >
      <div className="flex flex-col gap-3">
        <BookCover
          title={book.title}
          author={book.author}
          coverImageUrl={book.coverImageUrl}
          onClick={() => onOpenBook(book)}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge variant="neutral" size="xs">
              {book.format}
            </Badge>
            {onRenameBook && (
              <IconButton
                variant="ghost"
                size="xs"
                label="Edit details"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-tx-muted hover:text-tx-main"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameBook(book);
                }}
              >
                <PencilIcon className="h-3 w-3" />
              </IconButton>
            )}
            {onDeleteBook && (
              <IconButton
                variant="ghost"
                size="xs"
                label="Delete document"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-tx-muted hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBook(book);
                }}
              >
                <TrashIcon className="h-3 w-3" />
              </IconButton>
            )}
          </div>
          <span className="text-[0.68rem] font-mono text-tx-muted">
            {Math.round(book.percentage)}%
          </span>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-tx-main group-hover:text-tx-secondary transition line-clamp-2">
            <button
              type="button"
              className="text-left cursor-pointer hover:underline focus:outline-hidden"
              onClick={() => onOpenBook(book)}
            >
              {book.title}
            </button>
          </h3>
          {showAuthor && (
            <p className="mt-0.5 text-[0.72rem] text-tx-muted font-normal">{book.author}</p>
          )}
          {book.tags && book.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {book.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="faint" size="xs">
                  {tag}
                </Badge>
              ))}
              {book.tags.length > 2 && (
                <span className="text-[0.65rem] text-tx-muted self-center">
                  +{book.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <ProgressBar progress={book.percentage} size="xs" />

        <div className="flex items-center justify-between text-[0.68rem] text-tx-muted">
          <span>
            Page {book.currentPage} of {book.totalPages}
          </span>
          <Button variant="ghost" size="xs" onClick={() => onOpenBook(book)}>
            Read &rarr;
          </Button>
        </div>
      </div>
    </Card>
  );
});
