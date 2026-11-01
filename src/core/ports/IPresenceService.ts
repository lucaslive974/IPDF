export interface IPresenceService {
  setDiscordPresenceEnabled(enabled: boolean): Promise<void>;
  clearRichPresence(): Promise<void>;
}
