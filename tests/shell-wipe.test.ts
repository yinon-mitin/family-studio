import { describe, expect, it, vi } from 'vitest';
import { wipeAll } from '../src/shell/wipeAll';

describe('wipeAll', () => {
  it('clears every tool even when one of them throws', () => {
    const first = vi.fn();
    const broken = vi.fn(() => {
      throw new Error('storage blocked');
    });
    const last = vi.fn();

    const result = wipeAll([{ clearData: first }, { clearData: broken }, { clearData: last }]);

    expect(first).toHaveBeenCalledTimes(1);
    expect(broken).toHaveBeenCalledTimes(1);
    expect(last).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ failed: 1 });
  });

  it('reports no failures for an empty list', () => {
    expect(wipeAll([])).toEqual({ failed: 0 });
  });
});
