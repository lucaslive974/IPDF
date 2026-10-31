export interface ReadingActivity {
  bookHash: string;
  bookTitle: string;
  bookAuthor: string;
  chapterTitle?: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  state: 'reading' | 'listening_tts' | 'annotating' | 'paused';
  sessionStartedAt: Date;
  coverImageBuffer?: Uint8Array; // Imagem da capa ou customizada pelo usuário
  coverMimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
  coverImageUrl?: string; // URL HTTPS pública para compatibilidade com Discord IPC
}

export interface IPresenceProvider {
  readonly id: string;
  readonly name: string;
  isEnabled: boolean;
  connect(): Promise<void>;
  publishActivity(activity: ReadingActivity): Promise<void>;
  clearActivity(): Promise<void>;
  disconnect(): Promise<void>;
}
