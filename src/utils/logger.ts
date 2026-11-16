import type { ILogService, LogLevel } from '@ports/ILogService';

const NOOP_LOGGER: ILogService = {
  log: () => {},
  error: () => {},
  warn: () => {},
  status: () => {},
};

let activeLogger: ILogService = NOOP_LOGGER;

/**
 * Registers the active application logger (typically wired once by ServiceContainerProvider).
 */
export function setAppLogger(logger: ILogService): void {
  activeLogger = logger;
}

/**
 * Resets the application logger back to the silent no-op implementation (useful in tests).
 */
export function resetAppLogger(): void {
  activeLogger = NOOP_LOGGER;
}

/**
 * Global application logging facade for UI hooks, stores, and adapters without prop-drilling.
 */
export const appLogger: ILogService = {
  log(level: LogLevel, message: string, source?: string): void {
    activeLogger.log(level, message, source);
  },
  error(message: string, source?: string): void {
    activeLogger.error(message, source);
  },
  warn(message: string, source?: string): void {
    activeLogger.warn(message, source);
  },
  status(message: string, source?: string): void {
    activeLogger.status(message, source);
  },
};
