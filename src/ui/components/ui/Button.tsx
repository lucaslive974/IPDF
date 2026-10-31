import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'danger-subtle';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconLeft?: ReactNode;
  readonly iconRight?: ReactNode;
  readonly fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white shadow-xs hover:bg-brand-hover active:scale-95 disabled:opacity-50 disabled:hover:bg-brand',
  secondary:
    'border border-line-subtle bg-surface-subtle text-tx-secondary hover:bg-surface-hover hover:text-tx-main active:scale-95 disabled:opacity-50',
  outline:
    'border border-line-subtle bg-surface text-tx-secondary hover:bg-surface-subtle hover:text-tx-main active:scale-95 disabled:opacity-50',
  ghost:
    'text-tx-muted hover:bg-surface-subtle hover:text-tx-main active:scale-95 disabled:opacity-50',
  danger: 'bg-rose-600 text-white shadow-xs hover:bg-rose-500 active:scale-95 disabled:opacity-50',
  'danger-subtle':
    'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 active:scale-95 disabled:opacity-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-md',
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
  md: 'px-3.5 py-2 text-xs font-semibold rounded-xl',
  lg: 'px-4 py-2.5 text-sm font-semibold rounded-xl',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass = VARIANT_CLASSES[variant];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 transition select-none cursor-pointer ${sizeClass} ${variantClass} ${widthClass} ${className}`.trim()}
      {...rest}
    >
      {iconLeft && <span className="shrink-0">{iconLeft}</span>}
      {children}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}
