import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'minimal'
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
    'bg-tx-main text-canvas shadow-xs hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:hover:opacity-40',
  secondary:
    'border border-line-subtle bg-surface-subtle text-tx-secondary hover:bg-surface-hover hover:text-tx-main active:scale-[0.98] disabled:opacity-40',
  outline:
    'border border-line-subtle bg-surface/80 text-tx-secondary hover:bg-surface-subtle hover:text-tx-main active:scale-[0.98] disabled:opacity-40',
  ghost:
    'text-tx-muted hover:bg-surface-subtle hover:text-tx-main active:scale-[0.98] disabled:opacity-40',
  minimal:
    'text-tx-secondary hover:text-tx-main hover:bg-surface-subtle active:scale-[0.98] disabled:opacity-40',
  danger:
    'bg-red-700 text-white shadow-xs hover:bg-red-800 active:scale-[0.98] disabled:opacity-40',
  'danger-subtle':
    'border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-40',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-md font-medium',
  sm: 'px-3 py-1.5 text-xs font-medium rounded-lg',
  md: 'px-3.5 py-1.5 text-xs font-medium rounded-lg',
  lg: 'px-4.5 py-2 text-sm font-medium rounded-xl',
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
