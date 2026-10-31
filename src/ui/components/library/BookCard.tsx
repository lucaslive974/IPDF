import { memo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { Badge, Button, Card, ProgressBar } from '../ui';
import { BookCover } from './BookCover';

export interface BookCardProps {
  readonly book: BookMetadata;
  readonly onOpenBook: (book: BookMetadata) => void;
}

export const BookCard = memo(function BookCard({ book, onOpenBook }: BookCardProps) {
  return (
    <Card
      variant="interactive"
      padding="md"
      className="group flex flex-col justify-between overflow-hidden"
    >
      <div className="flex flex-col gap-3">
        <BookCover title={book.title} author={book.author} coverImageUrl={book.coverImageUrl} />

        <div className="flex items-center justify-between">
          <Badge variant="neutral" size="xs">
            {book.format}
          </Badge>
          <span className="text-[0.68rem] font-mono text-tx-muted">
            {Math.round(book.percentage)}%
          </span>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-tx-main group-hover:text-tx-secondary transition line-clamp-2">
            {book.title}
          </h3>
          <p className="mt-0.5 text-[0.72rem] text-tx-muted font-normal">{book.author}</p>
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
