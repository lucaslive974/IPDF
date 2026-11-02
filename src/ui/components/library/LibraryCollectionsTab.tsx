import { memo } from 'react';
import type { BookMetadata } from '../../../core/domain/BookMetadata';
import { useLibraryCollections } from '../../hooks/useLibraryCollections';
import { BookIcon, EmptyState } from '../ui';
import { CollectionGroupCard } from './CollectionGroupCard';

export interface LibraryCollectionsTabProps {
  readonly onOpenBook?: (book: BookMetadata) => void;
}

export const LibraryCollectionsTab = memo(function LibraryCollectionsTab({
  onOpenBook: propOnOpenBook,
}: LibraryCollectionsTabProps) {
  const { collectionsByTag, collectionsByAuthor, hasAnyCollection, handleOpenBook } =
    useLibraryCollections({ onOpenBook: propOnOpenBook });

  if (!hasAnyCollection) {
    return (
      <EmptyState
        icon={<BookIcon className="h-6 w-6" />}
        title="Curated Collections & Tags"
        description="Organize your library by tags and authors. Use the “Edit Details” option on any book card to add tags (e.g. “Philosophy”, “Epistemology”) or assign authors."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Tags Collections */}
      {collectionsByTag.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Collections by Tag ({collectionsByTag.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collectionsByTag.map(([tag, tagBooks]) => (
              <CollectionGroupCard
                key={tag}
                title={tag}
                books={tagBooks}
                onOpenBook={handleOpenBook}
                isTag
              />
            ))}
          </div>
        </section>
      )}

      {/* Authors Collections */}
      {collectionsByAuthor.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-muted">
              Collections by Author ({collectionsByAuthor.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collectionsByAuthor.map(([author, authorBooks]) => (
              <CollectionGroupCard
                key={author}
                title={author}
                books={authorBooks}
                onOpenBook={handleOpenBook}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
