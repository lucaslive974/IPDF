import type { Highlight } from '@domain/Highlight';
import { BookFormat } from '@domain/types';
import type { DocumentPage } from '@ports/IReaderService';
import { FONT_FAMILY_DEFINITIONS, useTypographyStore } from '@stores/useTypographyStore';
import { memo } from 'react';
import { ReaderPageCover } from './ReaderPageCover';
import { ReaderPageHeader } from './ReaderPageHeader';
import { ReaderPageParagraphs, type ReaderPageParagraphsProps } from './ReaderPageParagraphs';
import { ReaderPagePdf } from './ReaderPagePdf';

export { type TextChunk, tokenizeTextWithHighlights } from './ReaderPageParagraphs';

export type PageRendererComponent = React.ComponentType<ReaderPageParagraphsProps>;

export const PAGE_RENDERERS: Record<BookFormat, PageRendererComponent> = {
  [BookFormat.EPUB]: ReaderPageParagraphs,
  [BookFormat.PDF]: ReaderPagePdf,
};

export interface ReaderPageItemProps {
  readonly page: DocumentPage;
  readonly totalPages: number;
  readonly bookHash?: string;
  readonly bookTitle: string;
  readonly bookAuthor?: string;
  readonly bookFormat?: BookFormat;
  readonly highlights: readonly Highlight[];
  readonly showChapterHeader?: boolean;
  readonly onHighlightClick: (highlight: Highlight, coords: { x: number; y: number }) => void;
  readonly onHighlightContextMenu: (e: React.MouseEvent, text: string, pageNumber: number) => void;
}

export const ReaderPageItem = memo(function ReaderPageItem({
  page,
  totalPages,
  bookHash,
  bookTitle,
  bookAuthor,
  bookFormat = BookFormat.EPUB,
  highlights,
  showChapterHeader = true,
  onHighlightClick,
  onHighlightContextMenu,
}: ReaderPageItemProps) {
  const fontSize = useTypographyStore((s) => s.fontSize);
  const fontFamily = useTypographyStore((s) => s.fontFamily);
  const lineSpacing = useTypographyStore((s) => s.lineSpacing);

  const def = FONT_FAMILY_DEFINITIONS[fontFamily];
  const Renderer = PAGE_RENDERERS[bookFormat] ?? ReaderPageParagraphs;
  const isPdf = bookFormat === BookFormat.PDF;

  return (
    <article
      data-page-number={page.pageNumber}
      className={
        isPdf
          ? 'w-full flex flex-col'
          : 'w-full min-h-225 flex flex-col gap-6 py-8 border-b border-line-subtle/30'
      }
    >
      {!isPdf && page.pageNumber === 1 && (
        <ReaderPageCover bookHash={bookHash} bookTitle={bookTitle} bookAuthor={bookAuthor} />
      )}

      {!isPdf && showChapterHeader && (
        <ReaderPageHeader
          chapterTitle={page.chapterTitle}
          bookAuthor={bookAuthor}
          pageNumber={page.pageNumber}
          totalPages={totalPages}
          cssFontFamily={def.cssFontFamily}
        />
      )}

      <Renderer
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
