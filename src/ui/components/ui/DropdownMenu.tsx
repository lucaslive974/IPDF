import { type HTMLAttributes, type ReactNode, useEffect, useRef, useState } from 'react';

export interface DropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  readonly x: number;
  readonly y: number;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly width?: string;
  readonly children: ReactNode;
}

export function DropdownMenu({
  x,
  y,
  isOpen,
  onClose,
  width = 'w-64',
  className = '',
  children,
  ...rest
}: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x, y });

  useEffect(() => {
    if (!isOpen) return;

    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;

    const estimatedW = 260;
    const estimatedH = 320;

    const clampedX = Math.max(12, Math.min(x, viewportW - estimatedW - 12));
    const clampedY = Math.max(12, Math.min(y, viewportH - estimatedH - 12));

    setAdjustedPos({ x: clampedX, y: clampedY });
  }, [isOpen, x, y]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = false;
    const timer = setTimeout(() => {
      isMounted = true;
    }, 40);

    const handlePointerDown = (event: PointerEvent) => {
      if (!isMounted) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className={`fixed z-50 flex ${width} flex-col rounded-xl border border-line-subtle bg-surface/95 p-1.5 shadow-2xl backdrop-blur-md transition-all duration-150 ${className}`.trim()}
      style={{
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuItemProps {
  readonly icon?: ReactNode;
  readonly label: string;
  readonly description?: string;
  readonly shortcut?: string;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

export function DropdownMenuItem({
  icon,
  label,
  description,
  shortcut,
  danger = false,
  disabled = false,
  onClick,
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-500 hover:bg-red-500/10 active:bg-red-500/20'
          : 'text-tx-secondary hover:bg-surface-subtle hover:text-tx-main active:bg-surface-hover'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-sm shrink-0 w-4 text-center">{icon}</span>}
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate">{label}</span>
          {description && (
            <span className="text-[0.65rem] text-tx-muted truncate">{description}</span>
          )}
        </div>
      </div>
      {shortcut && <span className="ml-2 text-[0.65rem] font-mono text-tx-faint">{shortcut}</span>}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <hr className="my-1 border-0 h-px bg-line-subtle" />;
}

export interface DropdownMenuHeaderProps {
  readonly title: string;
  readonly children?: ReactNode;
}

export function DropdownMenuHeader({ title, children }: DropdownMenuHeaderProps) {
  return (
    <div className="px-2.5 py-1 flex items-center justify-between">
      <span className="text-[0.65rem] font-semibold text-tx-muted uppercase tracking-wider">
        {title}
      </span>
      {children}
    </div>
  );
}
