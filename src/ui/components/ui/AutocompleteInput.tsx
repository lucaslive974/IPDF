import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Input, type InputProps } from './Input';
import { PlusIcon } from './icons';

export function filterSuggestions(suggestions: readonly string[], query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return Array.from(suggestions);
  }
  return suggestions.filter((s) => s.toLowerCase().includes(trimmed));
}

export interface AutocompleteInputProps extends InputProps {
  readonly suggestions?: readonly string[];
  readonly onSelectSuggestion?: (suggestion: string) => void;
  readonly maxSuggestions?: number;
  readonly clearOnSelect?: boolean;
  readonly allowCustomInput?: boolean;
  readonly customInputLabel?: (query: string) => string;
}

export const AutocompleteInput = memo(function AutocompleteInput({
  suggestions = [],
  onSelectSuggestion,
  maxSuggestions = 8,
  clearOnSelect = false,
  allowCustomInput = false,
  customInputLabel = (q) => `Add "${q}"`,
  value,
  onChange,
  onKeyDown,
  onFocus,
  onClick,
  ref,
  containerClassName = '',
  ...rest
}: AutocompleteInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [currentQuery, setCurrentQuery] = useState(String(value ?? ''));

  // Sync internal query when controlled value changes
  useEffect(() => {
    setCurrentQuery(String(value ?? ''));
  }, [value]);

  // Click outside to dismiss dropdown reliably across webviews
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen]);

  const filteredSuggestions = filterSuggestions(suggestions, currentQuery).slice(0, maxSuggestions);

  const trimmedQuery = currentQuery.trim();
  const hasExactMatch = filteredSuggestions.some(
    (s) => s.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCustomOption = allowCustomInput && trimmedQuery.length > 0 && !hasExactMatch;

  const handleSelect = useCallback(
    (suggestion: string) => {
      if (clearOnSelect) {
        setCurrentQuery('');
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        // Keep focus on input for seamless multi-selection
        inputRef.current?.focus();
        setHighlightedIndex(-1);
      } else {
        setCurrentQuery(suggestion);
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (inputRef.current) {
          inputRef.current.value = suggestion;
          inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      if (onSelectSuggestion) {
        onSelectSuggestion(suggestion);
      }
    },
    [clearOnSelect, onSelectSuggestion]
  );

  const totalOptionsCount = filteredSuggestions.length + (showCustomOption ? 1 : 0);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
    }
    if (e.defaultPrevented) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' && totalOptionsCount > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < totalOptionsCount - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalOptionsCount - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        if (highlightedIndex < filteredSuggestions.length) {
          const selected = filteredSuggestions[highlightedIndex];
          if (selected) {
            handleSelect(selected);
          }
        } else if (showCustomOption) {
          handleSelect(trimmedQuery);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (onFocus) {
      onFocus(e);
    }
    if (suggestions.length > 0 || allowCustomInput) {
      setIsOpen(true);
    }
  };

  const handleClick = (e: ReactMouseEvent<HTMLInputElement>) => {
    if (onClick) {
      onClick(e);
    }
    if ((suggestions.length > 0 || allowCustomInput) && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentQuery(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (onChange) {
      onChange(e);
    }
  };

  // Merge external ref and local inputRef
  const setCombinedRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && 'current' in ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [ref]
  );

  return (
    <div ref={containerRef} className={`relative flex flex-col ${containerClassName}`.trim()}>
      <Input
        ref={setCombinedRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onClick={handleClick}
        autoComplete="off"
        {...rest}
      />

      {isOpen && (filteredSuggestions.length > 0 || showCustomOption) && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-full max-h-52 overflow-y-auto rounded-xl border border-line-subtle bg-surface/95 p-1 shadow-xl backdrop-blur-md transition-all duration-150 flex flex-col gap-0.5">
          {filteredSuggestions.map((suggestion, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                key={suggestion}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition cursor-pointer flex items-center justify-between ${
                  isHighlighted
                    ? 'bg-surface-hover text-tx-main font-medium'
                    : 'text-tx-secondary hover:bg-surface-subtle hover:text-tx-main'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(suggestion);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="truncate">{suggestion}</span>
              </button>
            );
          })}

          {showCustomOption && (
            <button
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5 text-brand font-medium ${
                highlightedIndex === filteredSuggestions.length
                  ? 'bg-surface-hover'
                  : 'hover:bg-surface-subtle'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(trimmedQuery);
              }}
              onMouseEnter={() => setHighlightedIndex(filteredSuggestions.length)}
            >
              <PlusIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{customInputLabel(trimmedQuery)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});
