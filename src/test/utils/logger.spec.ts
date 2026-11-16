import { appLogger, resetAppLogger, setAppLogger } from '@utils/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('appLogger facade', () => {
  afterEach(() => {
    resetAppLogger();
  });

  it('defaults to a silent no-op logger without throwing', () => {
    expect(() => {
      appLogger.status('ok', 'test');
      appLogger.warn('warn', 'test');
      appLogger.error('err', 'test');
      appLogger.log('status', 'msg', 'test');
    }).not.toThrow();
  });

  it('delegates all log calls to the registered logger and restores no-op on reset', () => {
    const customLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      status: vi.fn(),
    };

    setAppLogger(customLogger);
    appLogger.status('Ready', 'startup');
    appLogger.warn('Slow decode', 'reader');
    appLogger.error('Disk failure', 'storage');
    appLogger.log('warn', 'Direct call', 'core');

    expect(customLogger.status).toHaveBeenCalledWith('Ready', 'startup');
    expect(customLogger.warn).toHaveBeenCalledWith('Slow decode', 'reader');
    expect(customLogger.error).toHaveBeenCalledWith('Disk failure', 'storage');
    expect(customLogger.log).toHaveBeenCalledWith('warn', 'Direct call', 'core');

    resetAppLogger();
    appLogger.error('Ignored after reset', 'test');
    expect(customLogger.error).toHaveBeenCalledTimes(1);
  });
});
