import type { Highlight } from '@domain/Highlight';
import type { BookAnnotationGroup } from '@hooks/useLibraryAnnotations';
import { Badge, Card } from '@ui';
import { memo } from 'react';
import { AnnotationItemCard } from './AnnotationItemCard';
import { BookThumbnail } from './BookThumbnail';

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
    <Card variant="surface" padding="md" className="flex flex-col gap-3">
      {/* Book header */}
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <BookThumbnail coverImageUrl={group.coverImageUrl} title={group.bookTitle} />

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
    </Card>
  );
});
