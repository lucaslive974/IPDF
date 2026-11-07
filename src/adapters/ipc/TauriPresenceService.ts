import type {
  IPresenceService,
  PresenceHealthStatus,
  ReadingPresenceInput,
} from '@ports/IPresenceService';
import { invoke } from '@tauri-apps/api/core';

export class TauriPresenceService implements IPresenceService {
  public async setDiscordPresenceEnabled(enabled: boolean): Promise<void> {
    await invoke<void>('set_discord_presence_enabled', { enabled });
  }

  public async clearRichPresence(): Promise<void> {
    await invoke<void>('clear_rich_presence');
  }

  public async updateLibraryPresence(totalBooks: number): Promise<void> {
    await invoke<void>('update_library_presence', { totalBooks });
  }

  public async updateAnnotationsPresence(totalAnnotations: number): Promise<void> {
    await invoke<void>('update_annotations_presence', { totalAnnotations });
  }

  public async updateReadingPresence(input: ReadingPresenceInput): Promise<void> {
    await invoke<void>('update_reading_presence', { payload: input });
  }

  public async getDiscordPresenceHealth(): Promise<PresenceHealthStatus> {
    return await invoke<PresenceHealthStatus>('get_discord_presence_health');
  }
}
