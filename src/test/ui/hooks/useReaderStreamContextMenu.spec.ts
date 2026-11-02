import { resolveContextMenuPayload } from '@hooks/useReaderStreamContextMenu';
import { describe, expect, it } from 'vitest';

describe('useReaderStreamContextMenu logic', () => {
  it('returns null when text is empty or blank', () => {
    expect(resolveContextMenuPayload('', 2, 1)).toBeNull();
    expect(resolveContextMenuPayload('   ', 2, 1)).toBeNull();
  });

  it('uses target article page number when available', () => {
    const payload = resolveContextMenuPayload('Selected philosophy quote', 5, 2);
    expect(payload).toEqual({
      text: 'Selected philosophy quote',
      pageNumber: 5,
    });
  });

  it('falls back to currentPage when article page number is missing or 0', () => {
    const payload = resolveContextMenuPayload('Selected philosophy quote', null, 3);
    expect(payload).toEqual({
      text: 'Selected philosophy quote',
      pageNumber: 3,
    });

    const payloadZero = resolveContextMenuPayload('Selected philosophy quote', 0, 3);
    expect(payloadZero).toEqual({
      text: 'Selected philosophy quote',
      pageNumber: 3,
    });
  });
});
