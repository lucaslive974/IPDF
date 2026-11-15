import type { BookFormat } from '@domain/types';
import { BookIcon } from '@ui';
import { memo } from 'react';
import { useCoverBook } from '../../hooks/useCoverBook';

export function isValidAuthor(author?: string | null): boolean {
  if (!author) return false;
  const trimmed = author.trim();
  if (trimmed.length === 0) return false;
  const lower = trimmed.toLowerCase();
  return lower !== 'unknown' && lower !== 'unknown author' && lower !== 'local file';
}

export interface BookCoverProps {
  readonly bookHash?: string;
  readonly format?: BookFormat;
  readonly coverVersion?: number;
  readonly title: string;
  readonly author?: string;
  readonly className?: string;
  readonly onClick?: () => void;
}

export const BookCover = memo(function BookCover({
  bookHash,
  format,
  coverVersion,
  title,
  author,
  className = '',
  onClick,
}: BookCoverProps) {
  const { coverUrl, handleCoverError } = useCoverBook(bookHash, format, coverVersion);

  const interactiveClasses = onClick
    ? 'cursor-pointer hover:opacity-95 active:scale-[0.99] transition duration-150'
    : '';

  const handleKeyDown = onClick
    ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;

  if (coverUrl) {
    return (
      <div
        className={`relative aspect-3/4 landscape-compact-cover w-full overflow-hidden rounded-md bg-surface-subtle shadow-xs border border-line-subtle/60 flex items-center justify-center p-1.5 ${interactiveClasses} ${className}`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <img
          src={coverUrl}
          alt={`Cover of ${title}`}
          className="h-full w-full object-contain rounded-xs transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          onError={handleCoverError}
        />
      </div>
    );
  }

  return (
    <div
      className={`aspect-3/4 landscape-compact-cover w-full rounded-md bg-surface-subtle border border-line-subtle/50 p-4 flex flex-col justify-between shadow-2xs ${interactiveClasses} ${className}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className="text-[0.62rem] font-medium uppercase tracking-widest text-tx-muted">
        Edition
      </span>
      <div>
        <p className="font-serif font-bold text-sm text-tx-main line-clamp-2">{title}</p>
        {isValidAuthor(author) && <p className="text-xs text-tx-muted mt-1">{author}</p>}
      </div>
      <BookIcon className="h-4 w-4 text-tx-faint" />
    </div>
  );
});
