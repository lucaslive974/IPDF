export interface PresenceHealthStatus {
  readonly ok: boolean;
  readonly message: string;
}

export interface ReadingPresenceInput {
  readonly bookHash: string;
  readonly bookTitle: string;
  readonly bookAuthor: string;
  readonly chapterTitle?: string;
  readonly currentPage: number;
  readonly totalPages: number;
}

export interface IPresenceService {
  setDiscordPresenceEnabled(enabled: boolean): Promise<void>;
  clearRichPresence(): Promise<void>;
  updateLibraryPresence(totalBooks: number): Promise<void>;
  updateAnnotationsPresence(totalAnnotations: number): Promise<void>;
  updateReadingPresence(input: ReadingPresenceInput): Promise<void>;
  getDiscordPresenceHealth(): Promise<PresenceHealthStatus>;
}
