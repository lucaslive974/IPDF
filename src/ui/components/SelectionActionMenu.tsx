import { Button, IconButton, Popover } from './ui';

export interface SelectionActionMenuProps {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly onHighlight: (colorHex: string) => void;
  readonly onExplain: () => void;
  readonly onDefineTerm: () => void;
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
  onHighlight,
  onExplain,
  onDefineTerm,
  onTranslate,
  onClose,
}: SelectionActionMenuProps) {
  return (
    <Popover x={x} y={y} width="w-auto" offsetY={60} className="p-2 gap-2">
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 border-r border-line-subtle pr-1.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={`Highlight ${c.label}`}
              className={`h-5 w-5 rounded-full ${c.classBg} transition hover:scale-110 active:scale-95 cursor-pointer`}
              onClick={() => onHighlight(c.hex)}
            />
          ))}
        </div>

        <Button variant="ghost" size="xs" iconLeft="✨" onClick={onExplain}>
          Explain
        </Button>

        <Button variant="ghost" size="xs" iconLeft="📖" onClick={onDefineTerm}>
          Term
        </Button>

        <Button variant="ghost" size="xs" iconLeft="🌐" onClick={onTranslate}>
          Translate
        </Button>

        <IconButton variant="ghost" size="xs" label="Dismiss" onClick={onClose}>
          ✕
        </IconButton>
      </div>

      <div className="max-w-64 truncate text-[0.65rem] text-tx-muted italic px-1">
        &ldquo;{text}&rdquo;
      </div>
    </Popover>
  );
}
