import type {
  BookAvailability,
  CloudProviderDescriptor,
  CloudSyncStatus,
  ISyncService,
  OAuthStartResult,
  SyncReport,
} from '@core/ports/ISyncService';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export class TauriSyncService implements ISyncService {
  async listCloudProviders(): Promise<CloudProviderDescriptor[]> {
    return invoke<CloudProviderDescriptor[]>('list_cloud_providers');
  }

  async getCloudSyncStatus(): Promise<CloudSyncStatus> {
    return invoke<CloudSyncStatus>('get_cloud_sync_status');
  }

  async beginGoogleOAuth(
    clientIdOverride?: string,
    redirectUri?: string
  ): Promise<OAuthStartResult> {
    return invoke<OAuthStartResult>('begin_google_oauth', {
      clientIdOverride: clientIdOverride ?? null,
      redirectUri: redirectUri ?? null,
    });
  }

  async completeGoogleOAuth(code: string, accountLabel?: string): Promise<CloudSyncStatus> {
    return invoke<CloudSyncStatus>('complete_google_oauth', {
      code,
      accountLabel: accountLabel ?? null,
    });
  }

  async connectGoogleDrive(): Promise<CloudSyncStatus> {
    return invoke<CloudSyncStatus>('connect_google_drive');
  }

  async disconnectCloudProvider(): Promise<CloudSyncStatus> {
    return invoke<CloudSyncStatus>('disconnect_cloud_provider');
  }

  async triggerCloudSync(): Promise<SyncReport> {
    return invoke<SyncReport>('trigger_cloud_sync');
  }

  async notifyAppResumed(): Promise<SyncReport | null> {
    return invoke<SyncReport | null>('notify_app_resumed');
  }

  async setCloudSyncInterval(intervalSecs: number): Promise<CloudSyncStatus> {
    return invoke<CloudSyncStatus>('set_cloud_sync_interval', { intervalSecs });
  }

  async listBookAvailabilities(): Promise<Record<string, BookAvailability>> {
    return invoke<Record<string, BookAvailability>>('list_book_availabilities');
  }

  async downloadRemoteBook(bookHash: string): Promise<boolean> {
    return invoke<boolean>('download_remote_book', { bookHash });
  }

  async evictLocalBook(bookHash: string): Promise<boolean> {
    return invoke<boolean>('evict_local_book', { bookHash });
  }

  async clearCloudSyncData(): Promise<number> {
    return invoke<number>('clear_cloud_sync_data');
  }

  async subscribeStatus(listener: (status: CloudSyncStatus) => void): Promise<() => void> {
    try {
      const unlisten = await listen<CloudSyncStatus>('sync:status', (event) => {
        listener(event.payload);
      });
      return unlisten;
    } catch {
      return () => {};
    }
  }
}
