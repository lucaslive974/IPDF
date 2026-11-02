import { memo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { Badge, Card } from '../ui';

export interface CollectionGroupCardProps {
  readonly title: string;
  readonly books: readonly BookMetadata[];
  readonly onOpenBook: (book: BookMetadata) => void;
  readonly isTag?: boolean;
}

export const CollectionGroupCard = memo(function CollectionGroupCard({
  title,
  books,
  onOpenBook,
  isTag = false,
}: CollectionGroupCardProps) {
  return (
    <Card variant="surface" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {isTag ? (
          <Badge variant="brand" size="sm">
            {title}
          </Badge>
        ) : (
          <span className="text-xs font-semibold text-tx-main truncate">{title}</span>
        )}
        <span className="text-[0.68rem] text-tx-muted font-mono shrink-0">
          {books.length} {books.length === 1 ? 'book' : 'books'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        {books.map((book) => (
          <button
            key={book.bookHash}
            type="button"
            onClick={() => onOpenBook(book)}
            className="text-left text-xs text-tx-secondary hover:text-tx-main hover:underline truncate cursor-pointer transition"
          >
            &bull; {book.title}
          </button>
        ))}
      </div>
    </Card>
  );
});
