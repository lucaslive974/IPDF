import type { Highlight } from '@domain/Highlight';
import { Badge, Button, CloseIcon, IconButton, Popover, TrashIcon } from './ui';

export interface HighlightPopoverProps {
  readonly highlight: Highlight;
  readonly x: number;
  readonly y: number;
  readonly noteDraft: string;
  readonly onNoteChange: (text: string) => void;
  readonly onChangeColor: (colorHex: string) => void;
  readonly onExpand: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

const COLOR_PRESETS = [
  { label: 'Amber', hex: '#d97706', classBg: 'bg-amber-600/70' },
  { label: 'Emerald', hex: '#059669', classBg: 'bg-emerald-600/70' },
  { label: 'Sky', hex: '#0284c7', classBg: 'bg-sky-600/70' },
  { label: 'Purple', hex: '#7c3aed', classBg: 'bg-purple-600/70' },
  { label: 'Rose', hex: '#e11d48', classBg: 'bg-rose-600/70' },
];

export function HighlightPopover({
  highlight,
  x,
  y,
  noteDraft,
  onNoteChange,
  onChangeColor,
  onExpand,
  onDelete,
  onClose,
}: HighlightPopoverProps) {
  const annotationsCount = highlight.getAllRichAnnotations().length;

  return (
    <Popover x={x} y={y} onClose={onClose}>
      <div className="flex items-center justify-between border-b border-line-subtle pb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: highlight.color }}
          />
          <span className="text-xs font-medium text-tx-main">Highlight</span>
          {annotationsCount > 0 && (
            <Badge variant="neutral" size="xs">
              {annotationsCount} rich
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton variant="ghost" size="xs" label="Delete Highlight" onClick={onDelete}>
            <TrashIcon className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton variant="ghost" size="xs" label="Close" onClick={onClose}>
            <CloseIcon className="h-3 w-3" />
          </IconButton>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color.hex}
            type="button"
            className={`h-4 w-4 rounded-full ${color.classBg} transition hover:scale-110 active:scale-95 cursor-pointer ${
              highlight.color === color.hex
                ? 'ring-2 ring-tx-main ring-offset-1 ring-offset-surface'
                : ''
            }`}
            onClick={() => onChangeColor(color.hex)}
            title={color.label}
          />
        ))}
      </div>

      <textarea
        className="w-full rounded-md border border-line-subtle bg-surface-subtle p-2 text-xs text-tx-main placeholder:text-tx-faint focus:border-line-strong focus:outline-none resize-none transition-colors"
        rows={2}
        placeholder="Add a margin note..."
        value={noteDraft}
        onChange={(e) => onNoteChange(e.target.value)}
      />

      <div className="flex items-center justify-end pt-1 border-t border-line-subtle">
        <Button variant="secondary" size="xs" onClick={onExpand}>
          Studio &rarr;
        </Button>
      </div>
    </Popover>
  );
}
