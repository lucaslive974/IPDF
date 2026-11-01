import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import type { BookAnnotationGroup } from '../../hooks/useLibraryAnnotations';
import { Badge, BookIcon } from '../ui';
import { AnnotationItemCard } from './AnnotationItemCard';

export interface BookAnnotationGroupCardProps {
  readonly group: BookAnnotationGroup;
  readonly copiedHighlightId: string | null;
  readonly onCopyHighlight: (highlight: Highlight) => void;
  readonly onDeleteHighlight: (id: string) => void;
  readonly onJumpToReader: (highlight: Highlight) => void;
}

export const BookAnnotationGroupCard = memo(function BookAnnotationGroupCard({
  group,
  copiedHighlightId,
  onCopyHighlight,
  onDeleteHighlight,
  onJumpToReader,
}: BookAnnotationGroupCardProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line-subtle bg-surface/50 p-4 shadow-2xs">
      {/* Book header */}
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {group.coverImageUrl ? (
            <img
              src={group.coverImageUrl}
              alt={group.bookTitle}
              className="h-9 w-7 shrink-0 rounded object-cover shadow-2xs border border-line-subtle"
            />
          ) : (
            <div className="flex h-9 w-7 shrink-0 items-center justify-center rounded bg-surface-subtle text-tx-muted border border-line-subtle">
              <BookIcon className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-tx-main truncate">{group.bookTitle}</h4>
            {group.bookAuthor && (
              <p className="text-xs text-tx-muted truncate">{group.bookAuthor}</p>
            )}
          </div>
        </div>

        <Badge variant="neutral" size="sm">
          {group.highlights.length} {group.highlights.length === 1 ? 'quote' : 'quotes'}
        </Badge>
      </div>

      {/* Annotations list */}
      <div className="flex flex-col gap-2.5">
        {group.highlights.map((hl) => (
          <AnnotationItemCard
            key={hl.id}
            highlight={hl}
            isCopied={copiedHighlightId === hl.id}
            onCopy={() => onCopyHighlight(hl)}
            onDelete={() => onDeleteHighlight(hl.id)}
            onJumpToReader={() => onJumpToReader(hl)}
          />
        ))}
      </div>
    </section>
  );
});
