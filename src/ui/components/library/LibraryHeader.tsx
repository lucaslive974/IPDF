import {
  Button,
  IconButton,
  Input,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SegmentedControl,
  type SegmentedControlOption,
  SettingsIcon,
  SunIcon,
} from '@ui';
import type { ChangeEvent, RefObject } from 'react';
import { memo } from 'react';
import type { LibraryTabId } from '../LibraryView';

export interface LibraryHeaderProps {
  readonly activeTab: LibraryTabId;
  readonly onTabChange: (tab: LibraryTabId) => void;
  readonly tabOptions: readonly SegmentedControlOption<LibraryTabId>[];
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
  activeTab,
  onTabChange,
  tabOptions,
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
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle bg-canvas/80 px-6 py-2.5 backdrop-blur-md">
      <div className="flex items-center">
        <SegmentedControl
          options={tabOptions}
          value={activeTab}
          onChange={onTabChange}
          ariaLabel="Library navigation tabs"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="w-48 sm:w-60">
          <Input
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange('')}
          />
        </div>

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
