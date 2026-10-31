import { memo } from 'react';

export interface ProgressBarProps {
  readonly progress: number; // 0 to 100
  readonly size?: 'xs' | 'sm' | 'md';
  readonly className?: string;
  readonly ariaLabel?: string;
}

export const ProgressBar = memo(function ProgressBar({
  progress,
  size = 'xs',
  className = '',
  ariaLabel = 'Reading progress',
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  const heightClass = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
  }[size];

  return (
    <div
      role="progressbar"
      tabIndex={0}
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={`w-full overflow-hidden rounded-full bg-line-subtle/60 ${heightClass} ${className}`}
    >
      <div
        className="h-full bg-tx-main transition-all duration-300 ease-out rounded-full"
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
});
