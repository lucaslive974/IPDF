export type CloudAuthKind = 'oAuthPkce' | 'credentials' | 'nativeSystem';

export type BookAvailability = 'local' | 'remoteOnly';

export interface CloudProviderDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly authKind: CloudAuthKind;
}

export type CloudSyncState = 'idle' | 'syncing' | 'synced' | 'error';

export interface CloudSyncStatus {
  readonly state: CloudSyncState;
  readonly connected: boolean;
  readonly providerId: string | null;
  readonly accountLabel: string | null;
  readonly intervalSecs: number;
  readonly lastSyncedAtMs: number | null;
  readonly lastRevision: number;
  readonly lastPulledBooks: number;
  readonly lastPushedBooks: number;
  readonly lastError: string | null;
  readonly availableProviders: readonly CloudProviderDescriptor[];
}

export interface OAuthStartResult {
  readonly authUrl: string;
  readonly state: string;
  readonly redirectUri: string;
}

export interface SyncReport {
  readonly revision: number;
  readonly pulledBooks: number;
  readonly pushedBooks: number;
  readonly uploadedBlobs: number;
  readonly downloadedCovers: number;
  readonly deletedBooks: number;
  readonly retries: number;
  readonly syncedAtMs: number;
}

export interface ISyncService {
  listCloudProviders(): Promise<CloudProviderDescriptor[]>;
  getCloudSyncStatus(): Promise<CloudSyncStatus>;
  beginGoogleOAuth(clientIdOverride?: string, redirectUri?: string): Promise<OAuthStartResult>;
  completeGoogleOAuth(code: string, accountLabel?: string): Promise<CloudSyncStatus>;
  connectGoogleDrive(): Promise<CloudSyncStatus>;
  disconnectCloudProvider(): Promise<CloudSyncStatus>;
  triggerCloudSync(): Promise<SyncReport>;
  notifyAppResumed(): Promise<SyncReport | null>;
  setCloudSyncInterval(intervalSecs: number): Promise<CloudSyncStatus>;
  listBookAvailabilities(): Promise<Record<string, BookAvailability>>;
  downloadRemoteBook(bookHash: string): Promise<boolean>;
  evictLocalBook(bookHash: string): Promise<boolean>;
  clearCloudSyncData(): Promise<number>;
  subscribeStatus(listener: (status: CloudSyncStatus) => void): Promise<() => void>;
}
