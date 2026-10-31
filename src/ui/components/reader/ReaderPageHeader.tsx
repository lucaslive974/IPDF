import { memo } from 'react';
import { isValidAuthor } from '../library/BookCover';

export interface ReaderPageHeaderProps {
  readonly chapterTitle: string;
  readonly bookAuthor?: string;
  readonly pageNumber: number;
  readonly totalPages: number;
  readonly cssFontFamily: string;
}

export const ReaderPageHeader = memo(function ReaderPageHeader({
  chapterTitle,
  bookAuthor,
  pageNumber,
  totalPages,
  cssFontFamily,
}: ReaderPageHeaderProps) {
  const authorPrefix = isValidAuthor(bookAuthor) ? `${bookAuthor} \u2022 ` : '';

  return (
    <div className="text-center mb-4">
      <h2
        className="text-xl font-semibold text-tx-main sm:text-2xl tracking-tight"
        style={{ fontFamily: cssFontFamily }}
      >
        {chapterTitle}
      </h2>
      <p className="mt-1.5 text-[0.65rem] text-tx-muted tracking-wider uppercase font-medium">
        {authorPrefix}Page {pageNumber} of {totalPages}
      </p>
    </div>
  );
});
