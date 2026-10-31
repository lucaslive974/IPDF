import {
  CopyIcon,
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
  GlobeIcon,
  SparklesIcon,
} from './ui';

export interface ReaderContextMenuProps {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly isOpen: boolean;
  readonly onHighlightColor: (colorHex: string) => void;
  readonly onOpenNoteDialog: () => void;
  readonly onOpenExplainDialog: () => void;
  readonly onOpenTranslateDialog: () => void;
  readonly onCopyText: () => void;
  readonly onClose: () => void;
}

const COLOR_PRESETS = [
  { label: 'Amber', hex: '#d97706', classBg: 'bg-amber-600/70' },
  { label: 'Emerald', hex: '#059669', classBg: 'bg-emerald-600/70' },
  { label: 'Sky', hex: '#0284c7', classBg: 'bg-sky-600/70' },
  { label: 'Purple', hex: '#7c3aed', classBg: 'bg-purple-600/70' },
  { label: 'Rose', hex: '#e11d48', classBg: 'bg-rose-600/70' },
];

export function ReaderContextMenu({
  text,
  x,
  y,
  isOpen,
  onHighlightColor,
  onOpenNoteDialog,
  onOpenExplainDialog,
  onOpenTranslateDialog,
  onCopyText,
  onClose,
}: ReaderContextMenuProps) {
  return (
    <DropdownMenu x={x} y={y} isOpen={isOpen} onClose={onClose} width="w-60">
      {/* Quick Color Picker Header */}
      <DropdownMenuHeader title="Highlight">
        <div className="flex items-center gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={`Highlight with ${c.label}`}
              className={`h-3.5 w-3.5 rounded-full ${c.classBg} transition hover:scale-125 active:scale-95 cursor-pointer`}
              onClick={() => {
                onHighlightColor(c.hex);
                onClose();
              }}
            />
          ))}
        </div>
      </DropdownMenuHeader>

      <DropdownMenuSeparator />

      {/* Main Options */}
      <DropdownMenuItem
        label="Add Margin Note..."
        description="Attach note to passage"
        onClick={() => {
          onClose();
          onOpenNoteDialog();
        }}
      />

      <DropdownMenuItem
        icon={<SparklesIcon className="h-3.5 w-3.5" />}
        label="Explain with AI..."
        description="Contextual analysis"
        onClick={() => {
          onClose();
          onOpenExplainDialog();
        }}
      />

      <DropdownMenuItem
        icon={<GlobeIcon className="h-3.5 w-3.5" />}
        label="Translate..."
        description="Contextual translation"
        onClick={() => {
          onClose();
          onOpenTranslateDialog();
        }}
      />

      <DropdownMenuSeparator />

      <DropdownMenuItem
        icon={<CopyIcon className="h-3.5 w-3.5" />}
        label="Copy Passage"
        shortcut="Ctrl+C"
        onClick={() => {
          onCopyText();
          onClose();
        }}
      />

      {/* Excerpt quote preview */}
      <div className="px-2.5 py-1.5 mt-0.5 border-t border-line-subtle/50 text-[0.62rem] text-tx-muted italic truncate">
        &ldquo;{text}&rdquo;
      </div>
    </DropdownMenu>
  );
}
