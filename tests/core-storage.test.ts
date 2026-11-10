import { describe, expect, it, vi } from 'vitest';
import { eraseKeys } from '../src/core/storage.ts';

function stub(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: vi.fn((k: string) => void data.delete(k)),
  };
}

describe('eraseKeys', () => {
  it('removes every listed key and returns', () => {
    const s = stub({ a: '1', b: '2', keep: '3' });
    eraseKeys(['a', 'b'], s);
    expect([...s.data.keys()]).toEqual(['keep']);
  });

  it('throws when a key is still there after removal', () => {
    const s = { getItem: () => '1', removeItem: () => {} };
    expect(() => eraseKeys(['a'], s)).toThrow(/a/);
  });

  it('throws when the storage throws, but still tries the other keys', () => {
    const s = stub({ a: '1', b: '2' });
    s.removeItem.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    expect(() => eraseKeys(['a', 'b'], s)).toThrow('blocked');
    expect(s.data.has('b')).toBe(false);
  });

  it('does nothing when there is no storage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    try {
      expect(() => eraseKeys(['a'])).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
