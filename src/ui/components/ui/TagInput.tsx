import { type KeyboardEvent, type MouseEvent, memo, useId, useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';
import { CloseIcon, PlusIcon } from './icons';

export interface TagInputProps {
  readonly tags: readonly string[];
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
  readonly suggestions?: readonly string[];
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly containerClassName?: string;
  readonly id?: string;
}

export const TagInput = memo(function TagInput({
  tags,
  onAddTag,
  onRemoveTag,
  suggestions = [],
  placeholder = 'Type tag and press Enter...',
  disabled = false,
  error,
  containerClassName = '',
  id,
}: TagInputProps) {
  const generatedId = useId();
  const inputId = id ?? `tag-input-${generatedId}`;
  const datalistId = `tag-datalist-${generatedId}`;

  const [inputValue, setInputValue] = useState('');

  const handleAdd = (e?: MouseEvent | KeyboardEvent) => {
    e?.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || disabled) return;
    onAddTag(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd(e);
    }
  };

  const availableSuggestions = suggestions.filter(
    (item) => !tags.some((t) => t.toLowerCase() === item.toLowerCase())
  );

  return (
    <div className={`flex flex-col gap-2 ${containerClassName}`.trim()}>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="brand" size="xs" className="gap-1.5 pr-1">
              <span>{tag}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemoveTag(tag)}
                className="p-0.5 rounded-full hover:bg-surface-hover text-tx-muted hover:text-tx-main cursor-pointer transition disabled:opacity-50"
                aria-label={`Remove tag ${tag}`}
              >
                <CloseIcon className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            id={inputId}
            list={datalistId}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleAdd}
          disabled={disabled || !inputValue.trim()}
          className="h-8 shrink-0"
        >
          <PlusIcon className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {availableSuggestions.length > 0 && (
        <datalist id={datalistId}>
          {availableSuggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </div>
  );
});
