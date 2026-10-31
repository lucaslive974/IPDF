import type { ChangeEvent, RefObject } from 'react';
import { memo } from 'react';
import {
  Button,
  IconButton,
  Input,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from '../ui';

export interface LibraryHeaderProps {
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly onImportClick: () => void;
  readonly onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly theme: string;
  readonly onToggleTheme: () => void;
  readonly onOpenSettings: () => void;
}

export const LibraryHeader = memo(function LibraryHeader({
  searchQuery,
  onSearchChange,
  onImportClick,
  onFileChange,
  fileInputRef,
  theme,
  onToggleTheme,
  onOpenSettings,
}: LibraryHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle bg-canvas/80 px-6 py-3.5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-subtle bg-surface text-xs font-semibold tracking-wider text-tx-main shadow-2xs">
          IP
        </div>
        <div>
          <h1 className="text-sm font-semibold text-tx-main tracking-tight">Library</h1>
          <p className="text-[0.65rem] text-tx-muted font-normal">Active Study</p>
        </div>
      </div>

      <div className="flex-1 max-w-sm">
        <Input
          iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          placeholder="Search library..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-tx-main"
          iconLeft={<PlusIcon className="h-3.5 w-3.5" />}
          onClick={onImportClick}
        >
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,.pdf"
          className="hidden"
          onChange={onFileChange}
          aria-label="Upload eBook file"
        />

        <IconButton
          variant="ghost"
          size="sm"
          label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </IconButton>

        <IconButton
          variant="ghost"
          size="sm"
          label="Settings & Directories"
          onClick={onOpenSettings}
        >
          <SettingsIcon className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
});
