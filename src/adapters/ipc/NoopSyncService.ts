import type {
  BookAvailability,
  CloudProviderDescriptor,
  CloudSyncStatus,
  ISyncService,
  OAuthStartResult,
  SyncReport,
} from '@ports/ISyncService';

const DISABLED_STATUS: CloudSyncStatus = {
  state: 'idle',
  connected: false,
  providerId: null,
  accountLabel: null,
  intervalSecs: 0,
  lastSyncedAtMs: null,
  lastRevision: 0,
  lastPulledBooks: 0,
  lastPushedBooks: 0,
  lastError: null,
  availableProviders: [],
};

const EMPTY_REPORT: SyncReport = {
  revision: 0,
  pulledBooks: 0,
  pushedBooks: 0,
  uploadedBlobs: 0,
  downloadedCovers: 0,
  deletedBooks: 0,
  retries: 0,
  syncedAtMs: 0,
};

/**
 * Compile-time no-op sync adapter used when cloud sync is disabled via `SCHOLARIUM_CLOUD_SYNC=false`.
 */
export class NoopSyncService implements ISyncService {
  public async listCloudProviders(): Promise<CloudProviderDescriptor[]> {
    return [];
  }

  public async getCloudSyncStatus(): Promise<CloudSyncStatus> {
    return DISABLED_STATUS;
  }

  public async beginGoogleOAuth(
    _clientIdOverride?: string,
    _redirectUri?: string
  ): Promise<OAuthStartResult> {
    throw new Error('Cloud sync is disabled in this build.');
  }

  public async completeGoogleOAuth(
    _code: string,
    _accountLabel?: string
  ): Promise<CloudSyncStatus> {
    throw new Error('Cloud sync is disabled in this build.');
  }

  public async connectGoogleDrive(): Promise<CloudSyncStatus> {
    throw new Error('Cloud sync is disabled in this build.');
  }

  public async disconnectCloudProvider(): Promise<CloudSyncStatus> {
    return DISABLED_STATUS;
  }

  public async triggerCloudSync(): Promise<SyncReport> {
    return EMPTY_REPORT;
  }

  public async notifyAppResumed(): Promise<SyncReport | null> {
    return null;
  }

  public async setCloudSyncInterval(_intervalSecs: number): Promise<CloudSyncStatus> {
    return DISABLED_STATUS;
  }

  public async listBookAvailabilities(): Promise<Record<string, BookAvailability>> {
    return {};
  }

  public async downloadRemoteBook(_bookHash: string): Promise<boolean> {
    return false;
  }

  public async evictLocalBook(_bookHash: string): Promise<boolean> {
    return false;
  }

  public async clearCloudSyncData(): Promise<number> {
    return 0;
  }

  public async subscribeStatus(_listener: (status: CloudSyncStatus) => void): Promise<() => void> {
    return () => {};
  }
}
