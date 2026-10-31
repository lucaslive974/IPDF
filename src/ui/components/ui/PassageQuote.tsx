import { memo } from 'react';

export interface PassageQuoteProps {
  readonly text: string;
  readonly maxLines?: number;
  readonly color?: string;
  readonly className?: string;
}

export const PassageQuote = memo(function PassageQuote({
  text,
  maxLines = 3,
  color,
  className = '',
}: PassageQuoteProps) {
  return (
    <blockquote
      className={`rounded-md border-l-2 bg-surface-subtle/70 px-3 py-2 text-xs font-serif italic text-tx-secondary select-text ${className}`}
      style={{
        borderLeftColor: color || 'var(--color-line-subtle)',
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      &ldquo;{text}&rdquo;
    </blockquote>
  );
});
