import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly iconLeft?: ReactNode;
  readonly onClear?: () => void;
  readonly error?: string;
  readonly containerClassName?: string;
}

export function Input({
  iconLeft,
  onClear,
  error,
  value,
  containerClassName = '',
  className = '',
  ...rest
}: InputProps) {
  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`.trim()}>
      <div
        className={`flex items-center rounded-xl border bg-surface-subtle px-3 py-1.5 transition ${
          error
            ? 'border-rose-500 focus-within:border-rose-500'
            : 'border-line-subtle focus-within:border-brand'
        }`}
      >
        {iconLeft && <span className="mr-2 text-xs text-tx-faint shrink-0">{iconLeft}</span>}
        <input
          value={value}
          className={`w-full bg-transparent text-xs text-tx-main placeholder:text-tx-faint focus:outline-none ${className}`.trim()}
          {...rest}
        />
        {onClear && hasValue && (
          <button
            type="button"
            className="ml-1 text-xs text-tx-faint hover:text-tx-main cursor-pointer"
            onClick={onClear}
          >
            ✕
          </button>
        )}
      </div>
      {error && <span className="text-[0.65rem] text-rose-500 font-medium px-1">{error}</span>}
    </div>
  );
}
