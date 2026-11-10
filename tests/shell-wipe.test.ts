import { describe, expect, it, vi } from 'vitest';
import { wipeAll } from '../src/shell/wipeAll';

describe('wipeAll', () => {
  it('clears every tool even when one of them throws, and keeps who failed and why', () => {
    const first = vi.fn();
    const error = new Error('storage blocked');
    const broken = vi.fn(() => {
      throw error;
    });
    const last = vi.fn();

    const result = wipeAll([
      { id: 'my-family', clearData: first },
      { id: 'crest', clearData: broken },
      { id: 'lang', clearData: last },
    ]);

    expect(first).toHaveBeenCalledTimes(1);
    expect(broken).toHaveBeenCalledTimes(1);
    expect(last).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ failed: 1, failures: [{ id: 'crest', error }] });
  });

  it('reports no failures for an empty list', () => {
    expect(wipeAll([])).toEqual({ failed: 0, failures: [] });
  });

  it('reports every failing target', () => {
    const boom = () => {
      throw new Error('x');
    };
    const result = wipeAll([
      { id: 'a', clearData: boom },
      { id: 'b', clearData: boom },
    ]);
    expect(result.failed).toBe(2);
    expect(result.failures.map((f) => f.id)).toEqual(['a', 'b']);
  });
});
