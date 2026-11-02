import {
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Input, type InputProps } from './Input';

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
}

export const AutocompleteInput = memo(function AutocompleteInput({
  suggestions = [],
  onSelectSuggestion,
  maxSuggestions = 8,
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
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

  const filteredSuggestions = filterSuggestions(suggestions, currentQuery).slice(0, maxSuggestions);

  const handleSelect = useCallback(
    (suggestion: string) => {
      setCurrentQuery(suggestion);
      setIsOpen(false);
      setHighlightedIndex(-1);

      if (onSelectSuggestion) {
        onSelectSuggestion(suggestion);
      }

      if (inputRef.current) {
        inputRef.current.value = suggestion;
        // Dispatch synthetic change event for react-hook-form / standard listeners
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    [onSelectSuggestion]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
    }
    if (e.defaultPrevented) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredSuggestions[highlightedIndex]);
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
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      onBlur(e);
    }
    // Only close if focus moved outside the entire autocomplete container
    if (!containerRef.current?.contains(e.relatedTarget as Node | null)) {
      setIsOpen(false);
      setHighlightedIndex(-1);
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
        onBlur={handleBlur}
        autoComplete="off"
        {...rest}
      />

      {isOpen && filteredSuggestions.length > 0 && (
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
        </div>
      )}
    </div>
  );
});
