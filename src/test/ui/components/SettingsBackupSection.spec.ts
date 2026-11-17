import { SettingsBackupSection } from '@components/settings/SettingsBackupSection';
import type { UseBackupReturn } from '@hooks/useBackup';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

function renderBackupSection(state: Partial<UseBackupReturn> = {}): string {
  const mock = new MockBackend();
  const fullState: UseBackupReturn = {
    backups: [],
    isLoading: false,
    isCreating: false,
    isRestoring: false,
    pendingRestoreId: null,
    statusMessage: null,
    error: null,
    refreshBackups: vi.fn(),
    createBackup: vi.fn(),
    requestRestore: vi.fn(),
    cancelRestore: vi.fn(),
    confirmRestore: vi.fn(),
    deleteBackup: vi.fn(),
    ...state,
  };

  return renderToStaticMarkup(
    React.createElement(
      ServiceContainerProvider,
      {
        backupService: mock,
        libraryService: mock,
        highlightService: mock,
      },
      React.createElement(SettingsBackupSection, { state: fullState })
    )
  );
}

describe('SettingsBackupSection component', () => {
  it('renders empty state when no backups exist', () => {
    const markup = renderBackupSection();

    expect(markup).toContain('Backups');
    expect(markup).toContain('Create Backup');
    expect(markup).toContain('No local backups yet');
  });

  it('renders backup artifacts, restore confirmation, and status banner', () => {
    const markup = renderBackupSection({
      backups: [
        {
          id: 'scholarium-backup-1700000000000.zip',
          name: 'scholarium-backup-1700000000000.zip',
          sizeBytes: 1_572_864,
          createdAtMs: 1_700_000_000_000,
        },
      ],
      pendingRestoreId: 'scholarium-backup-1700000000000.zip',
      statusMessage: 'Backup created: 1 book, 1 cover (1.5 MB)',
    });

    expect(markup).toContain('scholarium-backup-1700000000000.zip');
    expect(markup).toContain('1.5 MB');
    expect(markup).toContain('Backup created: 1 book, 1 cover (1.5 MB)');
    expect(markup).toContain('Confirm Restore');
    expect(markup).toContain('Cancel');
  });
});
