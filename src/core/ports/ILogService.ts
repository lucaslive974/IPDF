export type LogLevel = 'error' | 'warn' | 'status';

export interface ILogService {
  log(level: LogLevel, message: string, source?: string): void;
  error(message: string, source?: string): void;
  warn(message: string, source?: string): void;
  status(message: string, source?: string): void;
}
