import { memo } from 'react';
import { useCoverBook } from '../../hooks/useCoverBook';
import { isValidAuthor } from '../library/BookCover';

export interface ReaderPageCoverProps {
  readonly bookHash?: string;
  readonly bookTitle: string;
  readonly bookAuthor?: string;
}

export const ReaderPageCover = memo(function ReaderPageCover({
  bookHash,
  bookTitle,
  bookAuthor,
}: ReaderPageCoverProps) {
  const { coverUrl, handleCoverError } = useCoverBook(bookHash);

  return (
    <div className="w-full flex flex-col items-center justify-center pt-2 pb-8">
      {coverUrl ? (
        <div className="w-full max-w-xs aspect-3/4 rounded-lg overflow-hidden shadow-lg border border-line-subtle/60 bg-surface-subtle">
          <img
            src={coverUrl}
            alt={`Book cover of ${bookTitle}`}
            className="h-full w-full object-cover"
            onError={handleCoverError}
          />
        </div>
      ) : (
        <div className="w-full max-w-xs aspect-3/4 rounded-lg border border-line-subtle/60 bg-surface-subtle p-7 flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center text-[0.6rem] font-medium uppercase tracking-widest text-tx-muted">
            <span>Edition</span>
            <span>Active Study</span>
          </div>
          <div className="text-center my-auto">
            <h1 className="font-serif text-2xl font-bold text-tx-main tracking-tight">
              {bookTitle}
            </h1>
            {isValidAuthor(bookAuthor) && (
              <p className="mt-2 text-xs font-normal text-tx-muted tracking-wide">{bookAuthor}</p>
            )}
          </div>
          <div className="border-t border-line-subtle/50 pt-3 text-center">
            <p className="text-[0.62rem] font-mono text-tx-faint">Page 1</p>
          </div>
        </div>
      )}
    </div>
  );
});
