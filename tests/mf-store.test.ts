import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../src/tools/my-family/persist.ts';

type Store = typeof import('../src/tools/my-family/store.ts');

let storage: Map<string, string>;
let s: Store;

// The module reads storage and the window at import time, so each test imports a fresh copy after stubbing.
async function load(win: { innerWidth: number; innerHeight: number } | null = { innerWidth: 1360, innerHeight: 860 }): Promise<Store> {
  vi.resetModules();
  if (win) vi.stubGlobal('window', win);
  return import('../src/tools/my-family/store.ts');
}

const ids = () => s.store.get().doc.figures.map((f) => f.id);

beforeEach(async () => {
  vi.useFakeTimers();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
  s = await load();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('my-family store: autosave', () => {
  it('writes the document 400 ms after the last change, debounced', () => {
    s.add('circle');
    vi.advanceTimersByTime(399);
    expect(storage.has(STORAGE_KEY)).toBe(false);
    s.add('square'); // restarts the timer
    vi.advanceTimersByTime(399);
    expect(storage.has(STORAGE_KEY)).toBe(false);
    vi.advanceTimersByTime(1);
    const saved = JSON.parse(storage.get(STORAGE_KEY)!);
    expect(saved.figures).toHaveLength(2);
  });

  it('removes the key instead of saving an empty document', () => {
    const id = (s.add('circle'), ids()[0]);
    vi.advanceTimersByTime(400);
    expect(storage.has(STORAGE_KEY)).toBe(true);
    s.remove(id);
    vi.advanceTimersByTime(400);
    expect(storage.has(STORAGE_KEY)).toBe(false);
  });

  it('clearData leaves no key even with a save pending, and after waiting', () => {
    s.add('circle');
    vi.advanceTimersByTime(400); // saved once
    s.add('square'); // a second save is pending
    const writes = vi.spyOn(localStorage, 'setItem');
    s.clearData();
    expect(storage.has(STORAGE_KEY)).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(storage.has(STORAGE_KEY)).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it('clearData resets the document, history and selection', () => {
    s.add('circle');
    s.add('square');
    s.clearData();
    const snap = s.store.get();
    expect(snap.doc.figures).toEqual([]);
    expect(snap.past).toEqual([]);
    expect(snap.future).toEqual([]);
    expect(s.getUi().selected).toBeNull();
  });

  it('restores the saved document when the module starts', async () => {
    s.add('triangle');
    vi.advanceTimersByTime(400);
    s = await load({ innerWidth: 400, innerHeight: 800 });
    expect(s.store.get().doc.figures.map((f) => f.kind)).toEqual(['triangle']);
    expect(s.store.get().doc.orientation).toBe('landscape'); // the saved sheet, not the window, decides
  });
});

describe('my-family store: environment', () => {
  it('picks the sheet orientation from the window', async () => {
    storage.clear();
    s = await load({ innerWidth: 1360, innerHeight: 860 });
    expect(s.store.get().doc.orientation).toBe('landscape');
    s = await load({ innerWidth: 412, innerHeight: 915 });
    expect(s.store.get().doc.orientation).toBe('portrait');
  });

  it('is importable without a window: falls back to portrait', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    s = await load(null);
    expect(s.store.get().doc.orientation).toBe('portrait');
    expect(() => s.newDrawing()).not.toThrow();
    expect(s.store.get().doc.orientation).toBe('portrait');
  });
});

describe('my-family store: selection and toast', () => {
  it('add selects the new figure', () => {
    s.add('circle');
    const first = ids()[0];
    expect(s.getUi().selected).toBe(first);
    s.add('rect');
    expect(ids()).toHaveLength(2);
    expect(s.getUi().selected).toBe(ids()[1]);
    expect(s.getUi().selected).not.toBe(first);
  });

  it('select sets and clears the selection', () => {
    s.add('circle');
    s.select(null);
    expect(s.getUi().selected).toBeNull();
    s.select(ids()[0]);
    expect(s.getUi().selected).toBe(ids()[0]);
  });

  it('removing the selected figure clears the selection', () => {
    s.add('circle');
    s.remove(ids()[0]);
    expect(s.getUi().selected).toBeNull();
  });

  it('undo of the add clears a selection that no longer exists', () => {
    s.add('circle');
    s.undo();
    expect(ids()).toEqual([]);
    expect(s.getUi().selected).toBeNull();
  });

  it('toast shows a message and clears it after 2800 ms', () => {
    s.toast('hello');
    expect(s.getUi().toast).toBe('hello');
    vi.advanceTimersByTime(2799);
    expect(s.getUi().toast).toBe('hello');
    vi.advanceTimersByTime(1);
    expect(s.getUi().toast).toBeNull();
  });

  it('a newer toast is not cleared by the timer of an older one', () => {
    s.toast('one');
    vi.advanceTimersByTime(2000);
    s.toast('two');
    vi.advanceTimersByTime(1000);
    expect(s.getUi().toast).toBe('two');
    vi.advanceTimersByTime(1800);
    expect(s.getUi().toast).toBeNull();
  });
});

describe('my-family store: step', () => {
  it('cycles through the z-order in both directions', () => {
    s.add('circle');
    s.add('square');
    s.add('rect');
    const [a, b, c] = ids();
    s.select(null);
    s.step(1);
    expect(s.getUi().selected).toBe(a);
    s.step(1);
    expect(s.getUi().selected).toBe(b);
    s.step(1);
    expect(s.getUi().selected).toBe(c);
    s.step(1);
    expect(s.getUi().selected).toBe(a);
    s.step(-1);
    expect(s.getUi().selected).toBe(c);
  });

  it('with nothing selected, previous starts from the top', () => {
    s.add('circle');
    s.add('square');
    s.select(null);
    s.step(-1);
    expect(s.getUi().selected).toBe(ids()[1]);
  });

  it('does nothing on an empty document', () => {
    expect(() => s.step(1)).not.toThrow();
    expect(() => s.step(-1)).not.toThrow();
    expect(s.getUi().selected).toBeNull();
  });
});

describe('my-family store: editing actions', () => {
  it('patch moves a figure; the same key merges into one undo step', () => {
    s.add('circle');
    const id = ids()[0];
    s.patch(id, { x: 300, y: 300 }, 'drag:' + id);
    s.patch(id, { x: 320, y: 310 }, 'drag:' + id);
    expect(s.store.get().doc.figures[0]).toMatchObject({ x: 320, y: 310 });
    expect(s.store.get().past).toHaveLength(2); // add + one merged drag
  });

  it('duplicate selects the copy; move reorders', () => {
    s.add('circle');
    s.add('square');
    const [a] = ids();
    s.duplicate(a);
    expect(ids()).toHaveLength(3);
    expect(s.getUi().selected).toBe(ids()[1]); // the copy sits right above the original
    s.move(a, 'top');
    expect(ids()[2]).toBe(a);
  });

  it('newDrawing clears history and selection and starts an empty sheet', () => {
    s.add('circle');
    s.add('square');
    s.newDrawing();
    const snap = s.store.get();
    expect(snap.doc.figures).toEqual([]);
    expect(snap.past).toEqual([]);
    expect(snap.future).toEqual([]);
    expect(s.getUi().selected).toBeNull();
  });
});

describe('my-family store: openDrawing', () => {
  it('replaces the drawing, clears history and selection, keeps the orientation of the file and autosaves', async () => {
    const { addFigure, newDoc } = await import('../src/tools/my-family/model.ts');
    s.add('circle');
    s.add('square');
    const incoming = addFigure(newDoc('portrait'), 'triangle').doc; // the test screen is landscape
    s.openDrawing(incoming);
    const snap = s.store.get();
    expect(snap.doc).toBe(incoming);
    expect(snap.doc.orientation).toBe('portrait');
    expect(snap.past).toEqual([]);
    expect(snap.future).toEqual([]);
    expect(s.getUi().selected).toBeNull();
    vi.advanceTimersByTime(400);
    expect(JSON.parse(storage.get(STORAGE_KEY)!).figures).toHaveLength(1);
  });
});

describe('my-family store: autosave flush', () => {
  it('flushAutosave writes a pending change at once and stops the timer', () => {
    s.add('circle');
    expect(storage.has(STORAGE_KEY)).toBe(false);
    s.flushAutosave();
    expect(JSON.parse(storage.get(STORAGE_KEY)!).figures).toHaveLength(1);
    const writes = vi.spyOn(localStorage, 'setItem');
    vi.advanceTimersByTime(5000);
    expect(writes).not.toHaveBeenCalled(); // the timer is gone, nothing is written twice
  });

  it('flushAutosave with nothing pending writes nothing', () => {
    s.add('circle');
    vi.advanceTimersByTime(400);
    const writes = vi.spyOn(localStorage, 'setItem');
    s.flushAutosave();
    expect(writes).not.toHaveBeenCalled();
  });

  it('flushAutosave of a pending empty drawing removes the key', () => {
    const id = (s.add('circle'), ids()[0]);
    vi.advanceTimersByTime(400);
    s.remove(id);
    s.flushAutosave();
    expect(storage.has(STORAGE_KEY)).toBe(false);
  });

  it('flushAutosave does not bring the key back after clearData', () => {
    s.add('circle');
    s.clearData();
    s.flushAutosave();
    expect(storage.has(STORAGE_KEY)).toBe(false);
  });

  it('pagehide and a page turning hidden flush the pending save', async () => {
    const handlers: Record<string, () => void> = {};
    const docHandlers: Record<string, () => void> = {};
    const doc = { visibilityState: 'visible', addEventListener: (type: string, fn: () => void) => void (docHandlers[type] = fn) };
    vi.stubGlobal('document', doc);
    s = await load({ innerWidth: 1360, innerHeight: 860, addEventListener: (type: string, fn: () => void) => void (handlers[type] = fn) } as never);
    s.add('circle');
    expect(storage.has(STORAGE_KEY)).toBe(false);
    handlers.pagehide();
    expect(JSON.parse(storage.get(STORAGE_KEY)!).figures).toHaveLength(1);

    storage.clear();
    s.add('square');
    docHandlers.visibilitychange(); // still visible: nothing yet
    expect(storage.has(STORAGE_KEY)).toBe(false);
    doc.visibilityState = 'hidden';
    docHandlers.visibilitychange();
    expect(JSON.parse(storage.get(STORAGE_KEY)!).figures).toHaveLength(2);
  });
});
