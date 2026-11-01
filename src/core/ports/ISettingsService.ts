export interface ISettingsService {
  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;
  syncBookWorkspace(bookHash: string): Promise<string>;
}
