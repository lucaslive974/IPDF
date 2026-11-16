import type { ILogService, LogLevel } from '@ports/ILogService';
import { invoke } from '@tauri-apps/api/core';

/**
 * Fire-and-forget IPC logger that dispatches frontend log entries to the Rust background logger
 * without blocking UI execution or awaiting disk I/O.
 */
export class TauriLogService implements ILogService {
  public log(level: LogLevel, message: string, source?: string): void {
    void invoke<void>('write_log', { level, message, source }).catch(() => {
      // Never throw or block UI if IPC logging is unavailable (e.g. non-Tauri preview)
    });
  }

  public error(message: string, source?: string): void {
    this.log('error', message, source);
  }

  public warn(message: string, source?: string): void {
    this.log('warn', message, source);
  }

  public status(message: string, source?: string): void {
    this.log('status', message, source);
  }
}
