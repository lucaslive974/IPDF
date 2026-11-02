import { memo, useMemo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { useNavigation } from '../../hooks/useNavigation';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { Badge, BookIcon, Card } from '../ui';
import { isValidAuthor } from './BookCover';

export interface LibraryCollectionsTabProps {
  readonly onOpenBook?: (book: BookMetadata) => void;
}

export const LibraryCollectionsTab = memo(function LibraryCollectionsTab({
  onOpenBook: propOnOpenBook,
}: LibraryCollectionsTabProps) {
  const books = useLibraryStore((s) => s.books);
  const navigation = useNavigation();
  const handleOpenBook = propOnOpenBook ?? navigation.openReader;

  // Group books by tag
  const booksByTag = useMemo(() => {
    const map = new Map<string, BookMetadata[]>();
    for (const book of books) {
      if (book.tags) {
        for (const tag of book.tags) {
          const trimmed = tag.trim();
          if (trimmed) {
            const list = map.get(trimmed) ?? [];
            list.push(book);
            map.set(trimmed, list);
          }
        }
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [books]);

  // Group books by author
  const booksByAuthor = useMemo(() => {
    const map = new Map<string, BookMetadata[]>();
    for (const book of books) {
      if (isValidAuthor(book.author)) {
        const trimmed = book.author.trim();
        const list = map.get(trimmed) ?? [];
        list.push(book);
        map.set(trimmed, list);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [books]);

  const hasAnyCollection = booksByTag.length > 0 || booksByAuthor.length > 0;

  if (!hasAnyCollection) {
    return (
      <div className="flex flex-col gap-4">
        <Card
          variant="dashed"
          padding="lg"
          className="text-center flex flex-col items-center gap-3 py-10"
        >
          <BookIcon className="h-6 w-6 text-tx-faint" />
          <h3 className="text-sm font-semibold text-tx-main">Curated Collections & Tags</h3>
          <p className="max-w-md text-xs text-tx-muted">
            Organize your library by tags and authors. Use the &ldquo;Edit Details&rdquo; option on
            any book card to add tags (e.g. &ldquo;Philosophy&rdquo;, &ldquo;Epistemology&rdquo;) or
            assign authors.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Tags Collections */}
      {booksByTag.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Collections by Tag ({booksByTag.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {booksByTag.map(([tag, tagBooks]) => (
              <Card key={tag} variant="surface" padding="md" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Badge variant="brand" size="sm">
                    {tag}
                  </Badge>
                  <span className="text-[0.68rem] text-tx-muted font-mono">
                    {tagBooks.length} {tagBooks.length === 1 ? 'book' : 'books'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  {tagBooks.map((b) => (
                    <button
                      key={b.bookHash}
                      type="button"
                      onClick={() => handleOpenBook(b)}
                      className="text-left text-xs text-tx-secondary hover:text-tx-main hover:underline truncate cursor-pointer transition"
                    >
                      &bull; {b.title}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Authors Collections */}
      {booksByAuthor.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Collections by Author ({booksByAuthor.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {booksByAuthor.map(([author, authorBooks]) => (
              <Card key={author} variant="surface" padding="md" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-tx-main truncate">{author}</span>
                  <span className="text-[0.68rem] text-tx-muted font-mono shrink-0">
                    {authorBooks.length} {authorBooks.length === 1 ? 'book' : 'books'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  {authorBooks.map((b) => (
                    <button
                      key={b.bookHash}
                      type="button"
                      onClick={() => handleOpenBook(b)}
                      className="text-left text-xs text-tx-secondary hover:text-tx-main hover:underline truncate cursor-pointer transition"
                    >
                      &bull; {b.title}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
