import type { TextFormatStyle } from '@domain/types';
import { Button } from './ui';

export interface FormattingActionItem {
  readonly id: string;
  readonly label: string;
  readonly style: TextFormatStyle;
}

const DEFAULT_FORMATTING_ACTIONS: FormattingActionItem[] = [
  { id: 'bold', label: 'Bold', style: { kind: 'bold' } },
  { id: 'italic', label: 'Italic', style: { kind: 'italic' } },
  { id: 'underline', label: 'Underline', style: { kind: 'underline' } },
  { id: 'color-amber', label: 'Amber', style: { kind: 'textColor', colorHex: '#d97706' } },
  {
    id: 'bg-yellow',
    label: 'Highlight',
    style: { kind: 'backgroundColor', colorHex: '#d97706' },
  },
  { id: 'blockquote', label: 'Quote', style: { kind: 'blockquote' } },
];

export interface AssistedFormattingToolbarProps {
  readonly actions?: FormattingActionItem[];
  readonly onApplyFormat: (style: TextFormatStyle) => void;
}

export function AssistedFormattingToolbar({
  actions = DEFAULT_FORMATTING_ACTIONS,
  onApplyFormat,
}: AssistedFormattingToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="secondary"
          size="xs"
          onClick={() => onApplyFormat(action.style)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
