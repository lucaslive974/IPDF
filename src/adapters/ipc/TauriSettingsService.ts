import { invoke } from '@tauri-apps/api/core';
import type { ISettingsService } from '../../core/ports/ISettingsService';

export class TauriSettingsService implements ISettingsService {
  public async getAppSetting(key: string): Promise<string | null> {
    return invoke<string | null>('get_app_setting', { key });
  }

  public async setAppSetting(key: string, value: string): Promise<void> {
    await invoke<void>('set_app_setting', { key, value });
  }

  public async syncBookWorkspace(bookHash: string): Promise<string> {
    return invoke<string>('sync_book_workspace', { bookHash });
  }
}
