import { useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import type { TextFormatStyle } from '../../core/domain/types';
import { AssistedFormattingToolbar } from './AssistedFormattingToolbar';
import { Button, Card, Modal, SegmentedControl, type SegmentedControlOption } from './ui';

export interface HighlightDetailModalProps {
  readonly highlight: Highlight;
  readonly noteInput: string;
  readonly formattedAnnotations: string[];
  readonly llmPromptPreview: string;
  readonly onNoteChange: (text: string) => void;
  readonly onSelectionChange: (start: number, end: number) => void;
  readonly onApplyFormat: (style: TextFormatStyle) => void;
  readonly onAttachBoard: (kind: 'tldraw' | 'drawio') => void;
  readonly onGeneratePrompt: () => void;
  readonly onClose: () => void;
}

type StudioTabId = 'text' | 'visual' | 'ai';

const STUDIO_TABS: readonly SegmentedControlOption<StudioTabId>[] = [
  { id: 'text', label: 'Assisted Notes' },
  { id: 'visual', label: 'Diagram Boards' },
  { id: 'ai', label: 'Contextual Synthesis' },
];

export function HighlightDetailModal({
  highlight,
  noteInput,
  formattedAnnotations,
  llmPromptPreview,
  onNoteChange,
  onSelectionChange,
  onApplyFormat,
  onAttachBoard,
  onGeneratePrompt,
  onClose,
}: HighlightDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'visual' | 'ai'>('text');

  const titleNode = (
    <div className="flex items-center gap-3">
      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: highlight.color }} />
      <span>Annotation Studio &mdash; Page {highlight.anchor.pageNumber}</span>
    </div>
  );

  const subtitleNode = (
    <span className="max-w-xl truncate block">&ldquo;{highlight.text}&rdquo;</span>
  );

  return (
    <Modal isOpen={true} title={titleNode} subtitle={subtitleNode} onClose={onClose}>
      <div className="mb-6">
        <SegmentedControl
          options={STUDIO_TABS}
          value={activeTab}
          onChange={setActiveTab}
          className="w-full flex"
        />
      </div>

      {/* Tab Body */}
      {activeTab === 'text' && (
        <div className="flex flex-col gap-4">
          <Card variant="subtle" padding="sm" rounded="lg">
            <span className="text-[0.7rem] uppercase font-bold tracking-wider text-tx-muted block mb-1">
              Selected Excerpt
            </span>
            <p className="text-sm italic text-tx-main leading-relaxed">
              &ldquo;{highlight.text}&rdquo;
            </p>
          </Card>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-tx-secondary">Assisted Markdown Note</span>
            <AssistedFormattingToolbar onApplyFormat={onApplyFormat} />
            <textarea
              className="min-h-36 w-full rounded-xl border border-line-subtle bg-surface-subtle p-4 font-mono text-xs text-tx-main leading-relaxed placeholder:text-tx-faint focus:border-brand focus:outline-none"
              placeholder="Draft your philosophical analysis or thoughts here..."
              value={noteInput}
              onChange={(e) => onNoteChange(e.target.value)}
              onSelect={(e) => {
                const target = e.currentTarget;
                onSelectionChange(target.selectionStart, target.selectionEnd);
              }}
            />
          </div>

          {formattedAnnotations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-tx-muted">
                Compiled Rich Annotations ({formattedAnnotations.length})
              </span>
              <div className="flex flex-col gap-1.5">
                {formattedAnnotations.map((item, idx) => (
                  <Card
                    key={`formatted-${idx + 1}`}
                    variant="subtle"
                    padding="sm"
                    rounded="lg"
                    className="font-mono text-xs text-tx-secondary"
                  >
                    {item}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'visual' && (
        <div className="flex flex-col gap-5">
          <p className="text-xs text-tx-muted">
            Attach freehand concept maps (
            <code className="text-tx-secondary font-semibold">tldraw</code>) or structured
            architectural flowcharts (
            <code className="text-tx-secondary font-semibold">draw.io</code>) tied directly to this
            passage:
          </p>

          <div className="flex gap-3">
            <Card
              variant="interactive"
              padding="sm"
              rounded="xl"
              className="flex-1 text-left"
              onClick={() => onAttachBoard('tldraw')}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-tx-main">tldraw Canvas</span>
                <span className="text-xs text-tx-muted font-medium">+ Attach</span>
              </div>
              <p className="mt-1 text-xs text-tx-muted">
                Freeform infinite sketching canvas for conceptual mind maps.
              </p>
            </Card>

            <Card
              variant="interactive"
              padding="sm"
              rounded="xl"
              className="flex-1 text-left"
              onClick={() => onAttachBoard('drawio')}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-tx-main">draw.io Diagram</span>
                <span className="text-xs text-tx-muted font-medium">+ Attach</span>
              </div>
              <p className="mt-1 text-xs text-tx-muted">
                Structured nodes, logical hierarchies, and relational diagrams.
              </p>
            </Card>
          </div>

          <Card
            variant="dashed"
            padding="lg"
            rounded="xl"
            className="text-center text-xs text-tx-faint"
          >
            Visual studio canvas viewport will load interactively in this container.
          </Card>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-tx-secondary">
              Philosophical Tutor Prompt Construction
            </span>
            <Button variant="primary" size="sm" onClick={onGeneratePrompt}>
              Regenerate Context Prompt
            </Button>
          </div>

          <Card
            variant="subtle"
            padding="sm"
            rounded="xl"
            className="font-mono text-xs text-brand whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto"
          >
            {llmPromptPreview ||
              'Click "Regenerate Context Prompt" to inspect structured LLM prompt payload.'}
          </Card>
        </div>
      )}
    </Modal>
  );
}
