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

  it('bumps resetSeq so an already shown start screen reads the storage again', () => {
    const before = getState().resetSeq;
    crest.clearData();
    expect(getState().resetSeq).toBe(before + 1);
  });

  it('erases the legacy key too', () => {
    storage.set('family-tree:autosave:v1', '{}');
    crest.clearData();
    expect(storage.has('family-tree:autosave:v1')).toBe(false);
  });

  it('throws when the storage keeps the stored crest, and still resets the screen', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{}', setItem: () => {}, removeItem: () => {} });
    const before = getState().resetSeq;
    expect(() => crest.clearData()).toThrow();
    expect(getState().resetSeq).toBe(before + 1);
  });
});
