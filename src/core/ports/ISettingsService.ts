export interface PlatformInfo {
  readonly platform: string;
  readonly configDir: string;
  readonly dataDir: string;
  readonly cacheDir: string;
  readonly databasePath: string;
  readonly supportsDiscordPresence: boolean;
}

export interface ISettingsService {
  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;
  syncBookWorkspace(bookHash: string): Promise<string>;
  getPlatformInfo(): Promise<PlatformInfo>;
}
