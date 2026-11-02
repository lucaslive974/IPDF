import { type KeyboardEvent, memo, useState } from 'react';
import { AutocompleteInput } from './AutocompleteInput';
import { Badge } from './Badge';
import { CloseIcon } from './icons';

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
  const [inputValue, setInputValue] = useState('');

  const handleAdd = (val?: string) => {
    const candidate = (val ?? inputValue).trim();
    if (!candidate || disabled) return;
    onAddTag(candidate);
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
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

      <AutocompleteInput
        id={id}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        suggestions={availableSuggestions}
        onSelectSuggestion={(selected) => handleAdd(selected)}
        clearOnSelect={true}
        allowCustomInput={true}
        customInputLabel={(query) => `Add tag "${query}"`}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
      />
    </div>
  );
});
