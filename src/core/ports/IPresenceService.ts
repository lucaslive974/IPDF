export interface PresenceHealthStatus {
  readonly ok: boolean;
  readonly message: string;
}

export interface IPresenceService {
  setDiscordPresenceEnabled(enabled: boolean): Promise<void>;
  clearRichPresence(): Promise<void>;
  updateLibraryPresence(totalBooks: number): Promise<void>;
  updateAnnotationsPresence(totalAnnotations: number): Promise<void>;
  getDiscordPresenceHealth(): Promise<PresenceHealthStatus>;
}
