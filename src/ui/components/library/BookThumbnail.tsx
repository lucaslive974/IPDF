import { BookIcon } from '@ui';
import { memo } from 'react';
import { useCoverBook } from '../../hooks/useCoverBook';

export interface BookThumbnailProps {
  readonly bookHash?: string;
  readonly title: string;
  readonly className?: string;
}

export const BookThumbnail = memo(function BookThumbnail({
  bookHash,
  title,
  className = '',
}: BookThumbnailProps) {
  const { coverUrl, handleCoverError } = useCoverBook(bookHash);

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        loading="lazy"
        onError={handleCoverError}
        className={`h-9 w-7 shrink-0 rounded object-cover shadow-2xs border border-line-subtle ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`flex h-9 w-7 shrink-0 items-center justify-center rounded bg-surface-subtle text-tx-muted border border-line-subtle ${className}`.trim()}
      aria-label={`Cover fallback for ${title}`}
    >
      <BookIcon className="h-4 w-4" />
    </div>
  );
});
