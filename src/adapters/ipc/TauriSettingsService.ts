import type { ISettingsService, PlatformInfo } from '@ports/ISettingsService';
import { invoke } from '@tauri-apps/api/core';

export class TauriSettingsService implements ISettingsService {
  public async healthcheck(): Promise<string> {
    return invoke<string>('healthcheck');
  }

  public async getAppSetting(key: string): Promise<string | null> {
    return invoke<string | null>('get_app_setting', { key });
  }

  public async setAppSetting(key: string, value: string): Promise<void> {
    await invoke<void>('set_app_setting', { key, value });
  }

  public async syncBookWorkspace(bookHash: string): Promise<string> {
    return invoke<string>('sync_book_workspace', { bookHash });
  }

  public async getPlatformInfo(): Promise<PlatformInfo> {
    return invoke<PlatformInfo>('get_platform_info');
  }
}
