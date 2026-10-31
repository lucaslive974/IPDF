import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import type { DocumentPage } from '../../../core/ports/BackendService';
import { FONT_FAMILY_DEFINITIONS, useTypographyStore } from '../../stores/useTypographyStore';
import { ReaderPageCover } from './ReaderPageCover';
import { ReaderPageHeader } from './ReaderPageHeader';
import { ReaderPageParagraphs } from './ReaderPageParagraphs';

export { tokenizeTextWithHighlights, type TextChunk } from './ReaderPageParagraphs';

export interface ReaderPageItemProps {
  readonly page: DocumentPage;
  readonly totalPages: number;
  readonly bookTitle: string;
  readonly bookAuthor?: string;
  readonly coverImageUrl?: string;
  readonly highlights: readonly Highlight[];
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderPageItem = memo(function ReaderPageItem({
  page,
  totalPages,
  bookTitle,
  bookAuthor,
  coverImageUrl,
  highlights,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderPageItemProps) {
  const fontSize = useTypographyStore((s) => s.fontSize);
  const fontFamily = useTypographyStore((s) => s.fontFamily);
  const lineSpacing = useTypographyStore((s) => s.lineSpacing);

  const def = FONT_FAMILY_DEFINITIONS[fontFamily];

  return (
    <article
      data-page-number={page.pageNumber}
      className="w-full flex flex-col gap-6 py-8 border-b border-line-subtle/30"
    >
      {page.pageNumber === 1 && (
        <ReaderPageCover
          bookTitle={bookTitle}
          bookAuthor={bookAuthor}
          coverImageUrl={coverImageUrl}
        />
      )}

      <ReaderPageHeader
        chapterTitle={page.chapterTitle}
        bookAuthor={bookAuthor}
        pageNumber={page.pageNumber}
        totalPages={totalPages}
        cssFontFamily={def.cssFontFamily}
      />

      <ReaderPageParagraphs
        pageNumber={page.pageNumber}
        paragraphs={page.paragraphs}
        highlights={highlights}
        cssFontFamily={def.cssFontFamily}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        onHighlightClick={onHighlightClick}
        onHighlightContextMenu={onHighlightContextMenu}
      />
    </article>
  );
});
