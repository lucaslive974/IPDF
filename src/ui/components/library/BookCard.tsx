import type { BookMetadata } from '@domain/BookMetadata';
import { Badge, Card, CheckIcon, IconButton, PencilIcon, ProgressBar, TrashIcon } from '@ui';
import { memo } from 'react';
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
  const isCompleted = book.percentage >= 100;
  const isStarted = !isCompleted && (book.currentPage > 1 || book.percentage > 1);
  const roundedPercentage = Math.round(book.percentage);

  return (
    <Card
      variant="interactive"
      padding="sm"
      className="group flex flex-col justify-between overflow-hidden transition-all duration-200"
      onClick={() => onOpenBook(book)}
    >
      <div className="flex flex-col gap-2.5">
        {/* Cover Container with Floating Badge & Quick Actions */}
        <div className="relative w-full">
          <BookCover
            title={book.title}
            author={book.author}
            coverImageUrl={book.coverImageUrl}
            onClick={() => onOpenBook(book)}
          />

          {/* Format Badge (Overlay top-left, visible on hover) */}
          <div className="absolute top-2 left-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[0.6rem] font-semibold tracking-wider uppercase bg-surface/90 text-tx-secondary backdrop-blur-xs border border-line-subtle/60 shadow-2xs">
              {book.format}
            </span>
          </div>

          {/* Quick Actions (Overlay top-right, visible on hover) */}
          {(onRenameBook || onDeleteBook) && (
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-surface/90 backdrop-blur-xs p-0.5 rounded-md border border-line-subtle/60 shadow-xs">
              {onRenameBook && (
                <IconButton
                  variant="ghost"
                  size="xs"
                  label="Edit details"
                  className="text-tx-muted hover:text-tx-main"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameBook(book);
                  }}
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </IconButton>
              )}
              {onDeleteBook && (
                <IconButton
                  variant="ghost"
                  size="xs"
                  label="Delete document"
                  className="text-tx-muted hover:text-red-500 hover:bg-red-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBook(book);
                  }}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </div>
          )}
        </div>

        {/* Title, Author & Tags */}
        <div className="flex flex-col gap-1 px-0.5">
          <h3 className="text-xs font-semibold text-tx-main group-hover:text-tx-secondary transition-colors line-clamp-2 leading-snug">
            {book.title}
          </h3>

          {showAuthor && (
            <p className="text-[0.72rem] text-tx-muted font-normal line-clamp-1">{book.author}</p>
          )}

          {book.tags && book.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {book.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="faint" size="xs">
                  {tag}
                </Badge>
              ))}
              {book.tags.length > 2 && (
                <span className="text-[0.62rem] text-tx-muted self-center">
                  +{book.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reading Progress / Status Footer */}
      <div className="mt-3 pt-2 border-t border-line-subtle/50 px-0.5">
        {isCompleted ? (
          <div className="flex items-center gap-1.5 text-[0.68rem] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="h-3.5 w-3.5" />
            <span>Completed</span>
          </div>
        ) : isStarted ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[0.68rem] text-tx-muted">
              <span>
                Page {book.currentPage} of {book.totalPages}
              </span>
              <span className="font-mono font-medium text-tx-secondary">{roundedPercentage}%</span>
            </div>
            <ProgressBar progress={book.percentage} size="xs" />
          </div>
        ) : (
          <div className="flex items-center justify-between text-[0.68rem] text-tx-muted">
            <span>
              {book.totalPages} {book.totalPages === 1 ? 'page' : 'pages'}
            </span>
            <span className="text-[0.62rem] font-medium uppercase tracking-wider text-tx-faint">
              Unread
            </span>
          </div>
        )}
      </div>
    </Card>
  );
});
