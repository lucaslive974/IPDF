import type { StudyDocumentDescriptor } from '@stores/useReaderStore';
import { memo } from 'react';
import { BookCover, isValidAuthor } from '../library/BookCover';

export interface ReaderLoadingViewProps {
  readonly document: StudyDocumentDescriptor;
  readonly message?: string;
}

export const ReaderLoadingView = memo(function ReaderLoadingView({
  document,
  message = 'Preparing book for reading...',
}: ReaderLoadingViewProps) {
  const hasAuthor = isValidAuthor(document.bookAuthor);

  return (
    <div
      data-testid="reader-loading-view"
      className="flex-1 w-full flex flex-col items-center justify-center py-20 px-4 select-none min-h-[60vh]"
    >
      <div className="w-36 sm:w-44 shadow-lg rounded-md overflow-hidden transition-transform duration-300">
        <BookCover
          title={document.bookTitle || 'Loading Document'}
          author={document.bookAuthor}
          coverImageUrl={document.coverImageUrl}
          className="w-full"
        />
      </div>

      <div className="mt-8 flex flex-col items-center text-center max-w-md">
        <h2 className="text-xl sm:text-2xl font-serif font-medium text-tx-main line-clamp-2">
          {document.bookTitle || 'Loading Document'}
        </h2>
        {hasAuthor && <p className="mt-1 text-sm font-sans text-tx-muted">{document.bookAuthor}</p>}
      </div>

      <div className="mt-8 flex items-center gap-3 px-5 py-2.5 rounded-full bg-surface border border-line-subtle shadow-xs">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-brand" />
        </span>
        <span className="text-xs font-medium text-tx-muted tracking-wide animate-pulse">
          {message}
        </span>
      </div>
    </div>
  );
});
