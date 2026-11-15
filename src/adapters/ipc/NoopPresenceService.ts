import type {
  IPresenceService,
  PresenceHealthStatus,
  ReadingPresenceInput,
} from '@ports/IPresenceService';

/**
 * Compile-time no-op presence adapter used on mobile targets (Android / iOS)
 * where desktop Discord Rich Presence is unavailable. Avoids unnecessary IPC calls.
 */
export class NoopPresenceService implements IPresenceService {
  public async setDiscordPresenceEnabled(_enabled: boolean): Promise<void> {}

  public async clearRichPresence(): Promise<void> {}

  public async updateLibraryPresence(_totalBooks: number): Promise<void> {}

  public async updateAnnotationsPresence(_totalAnnotations: number): Promise<void> {}

  public async updateReadingPresence(_input: ReadingPresenceInput): Promise<void> {}

  public async getDiscordPresenceHealth(): Promise<PresenceHealthStatus> {
    return {
      ok: false,
      message: 'Discord Rich Presence is not available on mobile.',
    };
  }
}
