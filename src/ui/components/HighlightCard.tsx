import type { Highlight } from '../../core/domain/Highlight';

export interface HighlightCardProps {
  readonly highlight: Highlight;
  readonly isActive: boolean;
  readonly onSelect: (highlightId: string) => void;
}

export function HighlightCard({ highlight, isActive, onSelect }: HighlightCardProps) {
  return (
    <div
      className={`highlight-card ${isActive ? 'active' : ''}`}
      style={{ borderLeftColor: highlight.color }}
      onClick={() => onSelect(highlight.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onSelect(highlight.id);
        }
      }}
    >
      <strong>“{highlight.text}”</strong>
      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        Note: {highlight.note || '(empty)'}
      </div>
    </div>
  );
}
