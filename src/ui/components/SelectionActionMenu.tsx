import { useState } from 'react';
import { Button, IconButton, Popover } from './ui';

export interface SelectionActionMenuProps {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly onCreateNote: (colorHex: string) => void;
  readonly onHighlight: (colorHex: string) => void;
  readonly onExplain: () => void;
  readonly onDefineTerm?: () => void;
  readonly onTranslate: () => void;
  readonly onClose: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Yellow', hex: '#eab308', classBg: 'bg-amber-400' },
  { label: 'Green', hex: '#22c55e', classBg: 'bg-emerald-500' },
  { label: 'Blue', hex: '#38bdf8', classBg: 'bg-sky-400' },
  { label: 'Purple', hex: '#a855f7', classBg: 'bg-purple-500' },
  { label: 'Rose', hex: '#f43f5e', classBg: 'bg-rose-500' },
];

export function SelectionActionMenu({
  text,
  x,
  y,
  onCreateNote,
  onHighlight,
  onExplain,
  onDefineTerm,
  onTranslate,
  onClose,
}: SelectionActionMenuProps) {
  const [selectedColor, setSelectedColor] = useState<string>('#eab308');

  return (
    <Popover x={x} y={y} width="w-auto" offsetY={60} className="p-2 gap-2" onClose={onClose}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 border-r border-line-subtle pr-1.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={`Highlight ${c.label}`}
              className={`h-5 w-5 rounded-full ${c.classBg} transition hover:scale-110 active:scale-95 cursor-pointer ${
                selectedColor === c.hex ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface' : ''
              }`}
              onClick={() => {
                setSelectedColor(c.hex);
                onHighlight(c.hex);
              }}
            />
          ))}
        </div>

        <Button variant="ghost" size="xs" iconLeft="📝" onClick={() => onCreateNote(selectedColor)}>
          Criar Nota
        </Button>

        <Button variant="ghost" size="xs" iconLeft="✨" onClick={onExplain}>
          Explain
        </Button>

        {onDefineTerm && (
          <Button variant="ghost" size="xs" iconLeft="📖" onClick={onDefineTerm}>
            Term
          </Button>
        )}

        <Button variant="ghost" size="xs" iconLeft="🌐" onClick={onTranslate}>
          Translate
        </Button>

        <IconButton variant="ghost" size="xs" label="Fechar menu" onClick={onClose}>
          ✕
        </IconButton>
      </div>

      <div className="max-w-72 truncate text-[0.65rem] text-tx-muted italic px-1">
        &ldquo;{text}&rdquo;
      </div>
    </Popover>
  );
}
