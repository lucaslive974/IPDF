import { memo, useState } from 'react';
import { BookIcon } from '../ui';

export interface BookThumbnailProps {
  readonly coverImageUrl?: string;
  readonly title: string;
  readonly className?: string;
}

export const BookThumbnail = memo(function BookThumbnail({
  coverImageUrl,
  title,
  className = '',
}: BookThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  if (coverImageUrl && !hasError) {
    return (
      <img
        src={coverImageUrl}
        alt={title}
        loading="lazy"
        onError={() => setHasError(true)}
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
