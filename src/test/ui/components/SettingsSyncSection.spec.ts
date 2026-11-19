import { SettingsSyncSection } from '@components/settings/SettingsSyncSection';
import type { UseCloudSyncReturn } from '@hooks/useCloudSync';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

function createMockState(overrides: Partial<UseCloudSyncReturn> = {}): UseCloudSyncReturn {
  return {
    status: {
      state: 'idle',
      connected: false,
      providerId: null,
      accountLabel: null,
      intervalSecs: 120,
      lastSyncedAtMs: null,
      lastRevision: 0,
      lastPulledBooks: 0,
      lastPushedBooks: 0,
      lastError: null,
      availableProviders: [
        { id: 'google_drive', displayName: 'Google Drive', authKind: 'oAuthPkce' },
      ],
    },
    availabilities: {},
    downloadingHashes: {},
    pendingAuthUrl: null,
    isBusy: false,
    error: null,
    refreshStatus: vi.fn(),
    beginGoogleOAuth: vi.fn(),
    completeGoogleOAuth: vi.fn(),
    connectGoogleDrive: vi.fn(),
    disconnect: vi.fn(),
    syncNow: vi.fn(),
    setIntervalSecs: vi.fn(),
    downloadBook: vi.fn(),
    evictLocalBook: vi.fn(),
    clearCloudData: vi.fn(),
    ...overrides,
  };
}

function renderSyncSection(overrides: Partial<UseCloudSyncReturn> = {}): string {
  const backend = new MockBackend();
  return renderToStaticMarkup(
    createElement(
      ServiceContainerProvider,
      {
        libraryService: backend,
        highlightService: backend,
        readerService: backend,
        presenceService: backend,
        settingsService: backend,
        logService: backend,
        backupService: backend,
      },
      createElement(SettingsSyncSection, { state: createMockState(overrides) })
    )
  );
}

describe('SettingsSyncSection', () => {
  it('renders disconnected state with OAuth flow controls', () => {
    const html = renderSyncSection({
      pendingAuthUrl: 'https://accounts.google.com/o/oauth2/v2/auth?test=1',
    });

    expect(html).toContain('Cloud Sync');
    expect(html).toContain('Local Only');
    expect(html).toContain('Connect Google Drive');
    expect(html).not.toContain('BYOC Google OAuth Client ID');
    expect(html).toContain('Complete Sign-In');
    expect(html).toContain('https://accounts.google.com/o/oauth2/v2/auth?test=1');
  });

  it('renders connected state with interval selector, Sync Now, Clear Cloud Data, and error banner', () => {
    const html = renderSyncSection({
      status: {
        state: 'synced',
        connected: true,
        providerId: 'google_drive',
        accountLabel: 'reader@example.com',
        intervalSecs: 300,
        lastSyncedAtMs: 1_795_000_000_000,
        lastRevision: 7,
        lastPulledBooks: 1,
        lastPushedBooks: 1,
        lastError: null,
        availableProviders: [
          { id: 'google_drive', displayName: 'Google Drive', authKind: 'oAuthPkce' },
        ],
      },
      error: 'Temporary network error',
    });

    expect(html).toContain('Connected');
    expect(html).toContain('reader@example.com');
    expect(html).toContain('Rev 7');
    expect(html).toContain('Sync Now');
    expect(html).toContain('Disconnect');
    expect(html).toContain('Auto-sync interval:');
    expect(html).toContain('Clear Cloud Data');
    expect(html).toContain('Temporary network error');
  });
});
