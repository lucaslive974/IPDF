import type { Highlight } from '../../core/domain/Highlight';
import type { StudyDocumentDescriptor } from '../hooks/useStudyWorkbenchViewModel';
import { HighlightCard } from './HighlightCard';

export interface HighlightColorOption {
  readonly id: string;
  readonly label: string;
  readonly colorHex: string;
  readonly isPrimary?: boolean;
}

const DEFAULT_HIGHLIGHT_COLORS: HighlightColorOption[] = [
  { id: 'yellow', label: '+ Highlight Yellow', colorHex: '#eab308', isPrimary: true },
  { id: 'green', label: '+ Highlight Green', colorHex: '#22c55e' },
  { id: 'blue', label: '+ Highlight Blue', colorHex: '#38bdf8' },
];

export interface PassageReaderPanelProps {
  readonly document: StudyDocumentDescriptor;
  readonly highlights: Highlight[];
  readonly selectedHighlightId: string | null;
  readonly colorOptions?: HighlightColorOption[];
  readonly onCreateHighlight: (colorHex: string) => void;
  readonly onSelectHighlight: (highlightId: string) => void;
  readonly onGeneratePrompt: () => void;
  readonly onSyncBook: () => void;
}

export function PassageReaderPanel({
  document,
  highlights,
  selectedHighlightId,
  colorOptions = DEFAULT_HIGHLIGHT_COLORS,
  onCreateHighlight,
  onSelectHighlight,
  onGeneratePrompt,
  onSyncBook,
}: PassageReaderPanelProps) {
  return (
    <section className="panel">
      <div className="header-bar">
        <div>
          <h2 style={{ margin: 0 }}>
            {document.bookAuthor} — {document.bookTitle} ({document.chapterTitle})
          </h2>
          <small style={{ color: 'var(--text-muted)' }}>
            SHA-256 Hash: <code>{document.bookHash}</code>
          </small>
        </div>
        <span className="badge">Phase 1 Core Workbench</span>
      </div>

      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Select any passage below (or click a color button) to create a polymorphic highlight managed
        by <code>HighlightManager</code>:
      </p>

      <div className="book-passage">{document.sampleParagraph}</div>

      <div className="toolbar">
        {colorOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.isPrimary ? 'primary' : undefined}
            onClick={() => onCreateHighlight(option.colorHex)}
          >
            {option.label}
          </button>
        ))}
        <button type="button" onClick={onGeneratePrompt}>
          Generate Contextual Prompt (LLM)
        </button>
        <button type="button" onClick={onSyncBook}>
          Sync LWW (CloudlessSyncEngine)
        </button>
      </div>

      <h3 style={{ margin: '0.5rem 0 0 0' }}>Page 1 Highlights ({highlights.length})</h3>
      {highlights.map((highlight) => (
        <HighlightCard
          key={highlight.id}
          highlight={highlight}
          isActive={highlight.id === selectedHighlightId}
          onSelect={onSelectHighlight}
        />
      ))}
    </section>
  );
}
