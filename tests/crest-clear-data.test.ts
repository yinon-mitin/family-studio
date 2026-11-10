import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commit, getState } from '../src/model/store.ts';
import { TOOLS } from '../src/shell/tools.ts';

const KEY = 'family-crest:autosave:v1';
const crest = TOOLS.find((tool) => tool.id === 'crest')!;

describe('crest clearData', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not let a pending debounced autosave re-create the key after the wipe', () => {
    commit((doc) => ({ ...doc, family: 'Ивановы' }), 'family');
    crest.clearData();
    vi.advanceTimersByTime(1000);
    expect(storage.get(KEY)).toBeUndefined();
  });

  it('leaves an empty document on the start screen with no undo history', () => {
    commit((doc) => ({ ...doc, family: 'Ивановы' }), 'family');
    crest.clearData();
    const s = getState();
    expect(s.screen).toBe('start');
    expect(s.doc.family).toBe('');
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
  });
});
