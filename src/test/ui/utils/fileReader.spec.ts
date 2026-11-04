import { readFileAsDataUrl } from '@utils/fileReader';
import { describe, expect, it, vi } from 'vitest';

describe('fileReader utility', () => {
  it('reads File binary into a data URL using FileReader', async () => {
    const file = new File(['test image data'], 'cover.png', { type: 'image/png' });
    const dataUrl = await readFileAsDataUrl(file);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('falls back to ArrayBuffer when FileReader is undefined', async () => {
    const originalFileReader = globalThis.FileReader;
    globalThis.FileReader = undefined as unknown as typeof FileReader;

    try {
      const file = new File(['mock binary content'], 'photo.jpg', { type: 'image/jpeg' });
      const dataUrl = await readFileAsDataUrl(file);
      expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });

  it('rejects when FileReader emits an error', async () => {
    const originalFileReader = globalThis.FileReader;
    class MockErrorFileReader {
      public onerror: (() => void) | null = null;
      public error = new Error('Disk read failure');
      public readAsDataURL() {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 0);
      }
    }
    // @ts-expect-error Mock FileReader
    globalThis.FileReader = MockErrorFileReader;

    try {
      const file = new File(['data'], 'corrupt.png', { type: 'image/png' });
      await expect(readFileAsDataUrl(file)).rejects.toThrow('Disk read failure');
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });

  it('rejects when FileReader result is not a string', async () => {
    const originalFileReader = globalThis.FileReader;
    class MockNonStringFileReader {
      public onload: (() => void) | null = null;
      public result: ArrayBuffer = new ArrayBuffer(8);
      public readAsDataURL() {
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    }
    // @ts-expect-error Mock FileReader
    globalThis.FileReader = MockNonStringFileReader;

    try {
      const file = new File(['data'], 'invalid.png', { type: 'image/png' });
      await expect(readFileAsDataUrl(file)).rejects.toThrow('Failed to read file as data URL');
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });
});
