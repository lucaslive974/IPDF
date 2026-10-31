export interface SpeakOptions {
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

export interface TTSBoundaryEvent {
  charIndex: number;
  charLength: number;
  word: string;
}

export interface ITTSProvider {
  initialize(): Promise<void>;
  speak(text: string, options?: SpeakOptions): Promise<void>;
  prefetch?(text: string, options?: SpeakOptions): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;

  onWordBoundary(callback: (event: TTSBoundaryEvent) => void): void;
  onSentenceEnd(callback: () => void): void;
  onError(callback: (err: Error) => void): void;
}
