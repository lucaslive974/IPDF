import { NoopSyncService } from '@adapters/ipc/NoopSyncService';
import { CloudSyncOverlay, resolveSyncBadgePhase } from '@components/CloudSyncOverlay';
import { ServiceContainerProvider } from '@providers/ServiceContainerContext';
import { useSyncStore } from '@stores/useSyncStore';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockBackend } from '../../mocks/MockBackend';

describe('CloudSyncOverlay', () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
  });

  it('resolves badge phase transitions cleanly', () => {
    expect(resolveSyncBadgePhase('syncing', false)).toBe('syncing');
    expect(resolveSyncBadgePhase('synced', true)).toBe('synced');
    expect(resolveSyncBadgePhase('error', true)).toBe('error');
    expect(resolveSyncBadgePhase('synced', false)).toBe('hidden');
    expect(resolveSyncBadgePhase('idle', false)).toBe('hidden');
  });

  it('renders nothing when disconnected or idle', () => {
    const backend = new MockBackend();
    const markup = renderToStaticMarkup(
      React.createElement(
        ServiceContainerProvider,
        {
          readerService: backend,
          libraryService: backend,
          highlightService: backend,
          presenceService: backend,
          syncService: new NoopSyncService(),
        },
        React.createElement(CloudSyncOverlay)
      )
    );

    expect(markup).toBe('');
  });
});
