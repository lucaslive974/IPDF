import type { Highlight } from '@domain/Highlight';
import { Card } from './ui';

export interface HighlightCardProps {
  readonly highlight: Highlight;
  readonly isActive: boolean;
  readonly onSelect: (highlightId: string) => void;
}

export function HighlightCard({ highlight, isActive, onSelect }: HighlightCardProps) {
  return (
    <Card
      variant="interactive"
      padding="sm"
      rounded="lg"
      className={`border-l-4 transition ${isActive ? 'ring-2 ring-tx-main' : ''}`}
      style={{ borderLeftColor: highlight.color }}
      onClick={() => onSelect(highlight.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onSelect(highlight.id);
        }
      }}
    >
      <p className="text-xs font-medium text-tx-main leading-relaxed">
        &ldquo;{highlight.text}&rdquo;
      </p>
      {highlight.note && <p className="mt-1 text-[0.68rem] text-tx-muted">{highlight.note}</p>}
    </Card>
  );
}
