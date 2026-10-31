import { memo } from 'react';
import { BookIcon } from '../ui';

export interface BookCoverProps {
  readonly title: string;
  readonly author: string;
  readonly coverImageUrl?: string;
  readonly className?: string;
}

export const BookCover = memo(function BookCover({
  title,
  author,
  coverImageUrl,
  className = '',
}: BookCoverProps) {
  if (coverImageUrl) {
    return (
      <div
        className={`relative aspect-3/4 w-full overflow-hidden rounded-md bg-surface-subtle shadow-xs border border-line-subtle/60 flex items-center justify-center ${className}`}
      >
        <img
          src={coverImageUrl}
          alt={`Cover of ${title}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`aspect-3/4 w-full rounded-md bg-surface-subtle border border-line-subtle/50 p-4 flex flex-col justify-between shadow-2xs ${className}`}
    >
      <span className="text-[0.62rem] font-medium uppercase tracking-widest text-tx-muted">
        Edition
      </span>
      <div>
        <p className="font-serif font-bold text-sm text-tx-main line-clamp-2">{title}</p>
        <p className="text-xs text-tx-muted mt-1">{author}</p>
      </div>
      <BookIcon className="h-4 w-4 text-tx-faint" />
    </div>
  );
});
