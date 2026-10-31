import { useState } from 'react';
import type { Highlight } from '../../core/domain/Highlight';
import type { TextFormatStyle } from '../../core/domain/types';
import { AssistedFormattingToolbar } from './AssistedFormattingToolbar';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-opacity duration-200">
      <div className="relative flex h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="h-3.5 w-3.5 rounded-full"
              style={{ backgroundColor: highlight.color }}
            />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Annotation Studio &mdash; Page {highlight.anchor.pageNumber}
              </h3>
              <p className="max-w-xl truncate text-xs text-slate-400">
                &ldquo;{highlight.text}&rdquo;
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-95"
            onClick={onClose}
          >
            Done ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6">
          <button
            type="button"
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'text'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('text')}
          >
            📝 Assisted Text & Notes
          </button>
          <button
            type="button"
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'visual'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('visual')}
          >
            🎨 Boards (tldraw & draw.io)
          </button>
          <button
            type="button"
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'ai'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('ai')}
          >
            ✨ AI Tutor & Context
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'text' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                <span className="text-[0.7rem] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Selected Excerpt
                </span>
                <p className="text-sm italic text-slate-200 leading-relaxed">
                  &ldquo;{highlight.text}&rdquo;
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-300">Assisted Markdown Note</span>
                <AssistedFormattingToolbar onApplyFormat={onApplyFormat} />
                <textarea
                  className="min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-xs text-slate-200 leading-relaxed placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
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
                  <span className="text-xs font-semibold text-slate-400">
                    Compiled Rich Annotations ({formattedAnnotations.length})
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {formattedAnnotations.map((item, idx) => (
                      <div
                        key={`formatted-${idx + 1}`}
                        className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 font-mono text-xs text-slate-300"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'visual' && (
            <div className="flex flex-col gap-5">
              <p className="text-xs text-slate-400">
                Attach freehand concept maps (<code className="text-slate-300">tldraw</code>) or
                structured architectural flowcharts (<code className="text-slate-300">draw.io</code>
                ) tied directly to this passage:
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 p-4 text-left transition hover:border-sky-500 hover:bg-slate-900 active:scale-98"
                  onClick={() => onAttachBoard('tldraw')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-100">✏️ tldraw Whiteboard</span>
                    <span className="text-xs text-sky-400">+ Attach Board</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Freeform infinite sketching canvas for philosophical mind maps.
                  </p>
                </button>

                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 p-4 text-left transition hover:border-sky-500 hover:bg-slate-900 active:scale-98"
                  onClick={() => onAttachBoard('drawio')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-100">📊 draw.io Diagram</span>
                    <span className="text-xs text-sky-400">+ Attach Diagram</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Structured nodes, logical hierarchies, and relational diagrams.
                  </p>
                </button>
              </div>

              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                Visual studio canvas viewport will load interactively in this container.
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Philosophical Tutor Prompt Construction
                </span>
                <button
                  type="button"
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-500 transition active:scale-95"
                  onClick={onGeneratePrompt}
                >
                  Regenerate Context Prompt
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-sky-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                {llmPromptPreview ||
                  'Click "Regenerate Context Prompt" to inspect structured LLM prompt payload.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
