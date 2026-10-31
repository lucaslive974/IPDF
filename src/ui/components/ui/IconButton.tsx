import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonVariant = 'outline' | 'subtle' | 'ghost' | 'danger';
export type IconButtonSize = 'xs' | 'sm' | 'md';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: IconButtonVariant;
  readonly size?: IconButtonSize;
  readonly label?: string;
  readonly children: ReactNode;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  outline:
    'border border-line-subtle bg-surface text-tx-secondary hover:bg-surface-subtle hover:text-tx-main',
  subtle:
    'border border-line-subtle bg-surface-subtle text-tx-secondary hover:bg-surface-hover hover:text-tx-main',
  ghost: 'text-tx-faint hover:bg-surface-subtle hover:text-tx-main',
  danger: 'text-rose-500 hover:bg-rose-500/10 hover:text-rose-600',
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  xs: 'p-1 text-xs rounded-md',
  sm: 'p-1.5 text-xs rounded-lg',
  md: 'p-2 text-sm rounded-xl',
};

export function IconButton({
  variant = 'outline',
  size = 'md',
  label,
  children,
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  const variantClass = VARIANT_CLASSES[variant];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-40 ${sizeClass} ${variantClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
