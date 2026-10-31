import { memo } from 'react';

export interface ColorOption {
  readonly value: string;
  readonly label: string;
}

export const DEFAULT_HIGHLIGHT_COLORS: readonly ColorOption[] = [
  { value: '#FFEB3B', label: 'Yellow' },
  { value: '#4CAF50', label: 'Green' },
  { value: '#2196F3', label: 'Blue' },
  { value: '#E91E63', label: 'Pink' },
];

export interface ColorPickerProps {
  readonly selectedColor: string;
  readonly onSelectColor: (color: string) => void;
  readonly colors?: readonly ColorOption[];
  readonly size?: 'sm' | 'md';
  readonly className?: string;
  readonly ariaLabel?: string;
}

export const ColorPicker = memo(function ColorPicker({
  selectedColor,
  onSelectColor,
  colors = DEFAULT_HIGHLIGHT_COLORS,
  size = 'md',
  className = '',
  ariaLabel = 'Highlight color selection',
}: ColorPickerProps) {
  const buttonSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex items-center gap-2 ${className}`}
    >
      {colors.map((c) => {
        const isSelected = selectedColor.toUpperCase() === c.value.toUpperCase();
        return (
          <button
            key={c.value}
            role="radio"
            type="button"
            aria-checked={isSelected}
            aria-label={c.label}
            title={c.label}
            className={`rounded-full transition-all cursor-pointer ${buttonSize} ${
              isSelected
                ? 'scale-115 ring-2 ring-tx-main ring-offset-2 ring-offset-surface'
                : 'opacity-70 hover:opacity-100 hover:scale-105'
            }`}
            style={{ backgroundColor: c.value }}
            onClick={() => onSelectColor(c.value)}
          />
        );
      })}
    </div>
  );
});
