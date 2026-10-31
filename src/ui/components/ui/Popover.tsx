import { type HTMLAttributes, type ReactNode, useEffect, useRef } from 'react';

export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  readonly x: number;
  readonly y: number;
  readonly width?: string;
  readonly offsetY?: number;
  readonly onClose?: () => void;
  readonly children: ReactNode;
}

export function Popover({
  x,
  y,
  width = 'w-76',
  offsetY = 110,
  className = '',
  onClose,
  children,
  style,
  ...rest
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onClose) return;

    let isMounted = false;
    const timer = setTimeout(() => {
      isMounted = true;
    }, 50);

    const handlePointerDown = (event: PointerEvent) => {
      if (!isMounted) return;
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className={`fixed z-50 flex ${width} -translate-x-1/2 flex-col gap-2.5 rounded-xl border border-line-subtle bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200 ${className}`.trim()}
      style={{
        left: `${x}px`,
        top: `${Math.max(16, y - offsetY)}px`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
