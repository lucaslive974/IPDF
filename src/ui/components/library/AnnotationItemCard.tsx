import { memo } from 'react';
import type { Highlight } from '../../../core/domain/Highlight';
import { ArrowRightIcon, Badge, Card, CheckIcon, CopyIcon, IconButton, TrashIcon } from '../ui';

export interface AnnotationItemCardProps {
  readonly highlight: Highlight;
  readonly isCopied: boolean;
  readonly onCopy: () => void;
  readonly onDelete: () => void;
  readonly onJumpToReader: () => void;
}

export const AnnotationItemCard = memo(function AnnotationItemCard({
  highlight,
  isCopied,
  onCopy,
  onDelete,
  onJumpToReader,
}: AnnotationItemCardProps) {
  const pageNumber = highlight.anchor.pageNumber;
  const hasNote = Boolean(highlight.note.trim());

  return (
    <Card
      variant="subtle"
      padding="md"
      rounded="lg"
      className="group relative flex flex-col gap-3 transition-all duration-150 hover:shadow-xs border-l-4"
      style={{ borderLeftColor: highlight.color }}
    >
      {/* Header bar: Page badge & Action buttons */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onJumpToReader}
          className="flex items-center gap-1.5 text-xs text-tx-muted hover:text-tx-main font-mono transition cursor-pointer group-hover:underline"
          title={`Jump to page ${pageNumber} in reader`}
        >
          <Badge variant="faint" size="sm">
            p. {pageNumber}
          </Badge>
          <span className="text-[0.68rem] opacity-0 group-hover:opacity-100 transition-opacity">
            Jump to reader &rarr;
          </span>
        </button>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <IconButton
            variant="ghost"
            size="xs"
            label={isCopied ? 'Copied to clipboard' : 'Copy quote'}
            onClick={onCopy}
            className={isCopied ? 'text-emerald-500' : 'text-tx-muted hover:text-tx-main'}
          >
            {isCopied ? (
              <CheckIcon className="h-3.5 w-3.5" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
          </IconButton>

          <IconButton
            variant="ghost"
            size="xs"
            label="Open in reader"
            onClick={onJumpToReader}
            className="text-tx-muted hover:text-tx-main"
          >
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </IconButton>

          <IconButton
            variant="ghost"
            size="xs"
            label="Delete annotation"
            onClick={onDelete}
            className="text-tx-muted hover:text-red-500"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Quotation text */}
      <blockquote className="text-xs italic text-tx-main leading-relaxed select-text font-serif">
        &ldquo;{highlight.text}&rdquo;
      </blockquote>

      {/* User Note Box (if present) */}
      {hasNote && (
        <div className="rounded-md bg-canvas/70 border border-line-subtle/80 p-2.5 text-xs text-tx-secondary">
          <div className="flex items-center gap-1.5 mb-1 text-[0.68rem] font-semibold text-tx-muted uppercase tracking-wider">
            <span>Note</span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed select-text">{highlight.note}</p>
        </div>
      )}
    </Card>
  );
});
