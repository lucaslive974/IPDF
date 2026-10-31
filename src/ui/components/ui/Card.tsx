import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'surface' | 'subtle' | 'interactive' | 'dashed';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardRounded = 'lg' | 'xl' | '2xl';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
  readonly padding?: CardPadding;
  readonly rounded?: CardRounded;
  readonly children: ReactNode;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  surface: 'border border-line-subtle bg-surface shadow-xs',
  subtle: 'border border-line-subtle bg-surface-subtle',
  interactive:
    'border border-line-subtle bg-surface shadow-xs transition hover:border-line-strong hover:shadow-sm active:scale-[0.99] cursor-pointer',
  dashed: 'border border-dashed border-line-subtle bg-transparent',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-7',
};

const ROUNDED_CLASSES: Record<CardRounded, string> = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
};

export function Card({
  variant = 'surface',
  padding = 'md',
  rounded = 'xl',
  className = '',
  children,
  ...rest
}: CardProps) {
  const variantClass = VARIANT_CLASSES[variant];
  const paddingClass = PADDING_CLASSES[padding];
  const roundedClass = ROUNDED_CLASSES[rounded];

  return (
    <div
      className={`relative ${roundedClass} ${variantClass} ${paddingClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
