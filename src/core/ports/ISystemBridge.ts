export type PlaybackState = 'playing' | 'paused' | 'none';

export interface INotificationService {
  requestPermission(): Promise<boolean>;
  notify(title: string, body: string, icon?: string): Promise<void>;
}

export interface IMediaControlService {
  setMetadata(bookTitle: string, author: string, chapter?: string, coverBuffer?: Uint8Array): void;
  setPlaybackState(state: PlaybackState): void;
  onPlay(callback: () => void): void;
  onPause(callback: () => void): void;
  onNextSentence(callback: () => void): void;
  onPrevSentence(callback: () => void): void;
}

export interface IPowerSaveBlocker {
  keepScreenAwake(enable: boolean): Promise<void>;
}

export interface IClipboardService {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}
