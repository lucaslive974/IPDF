import { invoke } from '@tauri-apps/api/core';
import type { IPresenceService } from '../../core/ports/IPresenceService';

export class TauriPresenceService implements IPresenceService {
  public async setDiscordPresenceEnabled(enabled: boolean): Promise<void> {
    await invoke<void>('set_discord_presence_enabled', { enabled });
  }

  public async clearRichPresence(): Promise<void> {
    await invoke<void>('clear_rich_presence');
  }
}
