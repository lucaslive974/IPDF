import { SettingsBackupSection } from '@components/settings/SettingsBackupSection';
import type { UseBackupReturn } from '@hooks/useBackup';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

function renderBackupSection(
  state: Partial<UseBackupReturn> = {},
  isCloudConnected = false
): string {
  const mock = new MockBackend();
  const fullState: UseBackupReturn = {
    backups: [],
    isLoading: false,
    isCreating: false,
    isRestoring: false,
    uploadingBackupId: null,
    exportingBackupId: null,
    deletingBackupId: null,
    uploadToCloud: false,
    pendingRestoreId: null,
    statusMessage: null,
    error: null,
    setUploadToCloud: vi.fn(),
    refreshBackups: vi.fn(),
    createBackup: vi.fn(),
    requestRestore: vi.fn(),
    cancelRestore: vi.fn(),
    confirmRestore: vi.fn(),
    deleteBackup: vi.fn(),
    uploadBackupToCloud: vi.fn(),
    deleteRemoteBackup: vi.fn(),
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
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
      React.createElement(SettingsBackupSection, { state: fullState, isCloudConnected })
    )
  );
}

describe('SettingsBackupSection component', () => {
  it('renders empty state when no backups exist', () => {
    const markup = renderBackupSection();

    expect(markup).toContain('Backups');
    expect(markup).toContain('Create Backup');
    expect(markup).toContain('Import Backup…');
    expect(markup).toContain('No backups yet');
  });

  it('renders backup artifacts, restore confirmation, and status banner', () => {
    const markup = renderBackupSection({
      backups: [
        {
          id: 'scholarium-backup-lucas_notebook-linux-1700000000000.zip',
          name: 'scholarium-backup-lucas_notebook-linux-1700000000000.zip',
          deviceLabel: 'lucas_notebook',
          platform: 'linux',
          sizeBytes: 1_572_864,
          createdAtMs: 1_700_000_000_000,
          location: 'local',
        },
      ],
      pendingRestoreId: 'scholarium-backup-lucas_notebook-linux-1700000000000.zip',
      statusMessage: 'Backup created: 1 book, 1 cover (1.5 MB)',
    });

    expect(markup).toContain('Lucas Notebook');
    expect(markup).toContain('Linux');
    expect(markup).toContain('Local');
    expect(markup).toContain('scholarium-backup-lucas_notebook-linux-1700000000000.zip');
    expect(markup).toContain('1.5 MB');
    expect(markup).toContain('Backup created: 1 book, 1 cover (1.5 MB)');
    expect(markup).toContain('Save As…');
    expect(markup).toContain('Confirm Restore');
    expect(markup).toContain('Cancel');
  });

  it('renders cloud location badges and explicit cloud actions when connected', () => {
    const markup = renderBackupSection(
      {
        backups: [
          {
            id: 'local-only.zip',
            name: 'local-only.zip',
            deviceLabel: 'laptop',
            platform: 'linux',
            sizeBytes: 1024,
            createdAtMs: 1_700_000_000_000,
            location: 'local',
          },
          {
            id: 'remote-only.zip',
            name: 'remote-only.zip',
            deviceLabel: 'phone',
            platform: 'android',
            sizeBytes: 2048,
            createdAtMs: 1_700_000_001_000,
            location: 'remote',
          },
          {
            id: 'synced.zip',
            name: 'synced.zip',
            deviceLabel: 'desktop',
            platform: 'linux',
            sizeBytes: 4096,
            createdAtMs: 1_700_000_002_000,
            location: 'both',
          },
        ],
      },
      true
    );

    expect(markup).toContain('Also upload newly created or imported backups to Google Drive');
    expect(markup).toContain('Remote');
    expect(markup).toContain('Local + Cloud');
    expect(markup).toContain('Upload to Cloud');
    expect(markup).toContain('Remove from Cloud');
  });
});
