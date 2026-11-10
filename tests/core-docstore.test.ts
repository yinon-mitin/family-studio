import { describe, expect, it, vi } from 'vitest';
import { createDocStore } from '../src/core/docStore.ts';

describe('createDocStore', () => {
  it('commit changes the document and records the previous one', () => {
    const s = createDocStore({ initial: 0 });
    s.commit((d) => d + 1);
    expect(s.get().doc).toBe(1);
    expect(s.get().past).toEqual([0]);
  });

  it('commit returning the same document is a no-op and does not notify', () => {
    const s = createDocStore({ initial: 0 });
    const listener = vi.fn();
    s.subscribe(listener);
    s.commit((d) => d);
    expect(s.get().past).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('undo and redo move through history', () => {
    const s = createDocStore({ initial: 0 });
    s.commit((d) => d + 1);
    s.undo();
    expect(s.get().doc).toBe(0);
    expect(s.get().future).toEqual([1]);
    s.redo();
    expect(s.get().doc).toBe(1);
    expect(s.get().future).toEqual([]);
  });

  it('a new commit after undo clears the future', () => {
    const s = createDocStore({ initial: 0 });
    s.commit((d) => d + 1);
    s.undo();
    s.commit((d) => d + 5);
    expect(s.get().future).toEqual([]);
    expect(s.get().doc).toBe(5);
  });

  it('merges commits with the same key within mergeMs', () => {
    let t = 0;
    const s = createDocStore({ initial: 0, now: () => t });
    s.commit((d) => d + 1, 'k');
    t = 500;
    s.commit((d) => d + 1, 'k');
    expect(s.get().past).toEqual([0]);
    s.undo();
    expect(s.get().doc).toBe(0);
  });

  it('does not merge same-key commits further apart than mergeMs', () => {
    let t = 0;
    const s = createDocStore({ initial: 0, now: () => t });
    s.commit((d) => d + 1, 'k');
    t = 1500;
    s.commit((d) => d + 1, 'k');
    expect(s.get().past).toEqual([0, 1]);
  });

  it('does not merge commits with different or empty keys', () => {
    let t = 0;
    const s = createDocStore({ initial: 0, now: () => t });
    s.commit((d) => d + 1, 'a');
    s.commit((d) => d + 1, 'b');
    s.commit((d) => d + 1);
    s.commit((d) => d + 1);
    expect(s.get().past).toHaveLength(4);
  });

  it('undo breaks key merging', () => {
    let t = 0;
    const s = createDocStore({ initial: 0, now: () => t });
    s.commit((d) => d + 1, 'k');
    s.undo();
    s.commit((d) => d + 1, 'k');
    expect(s.get().past).toEqual([0]);
    s.commit((d) => d + 1, 'k');
    expect(s.get().past).toEqual([0]);
  });

  it('keeps at most `limit` undo steps', () => {
    const s = createDocStore({ initial: 0, limit: 3 });
    for (let i = 0; i < 5; i++) s.commit((d) => d + 1);
    expect(s.get().past.length).toBe(3);
    expect(s.get().past).toEqual([2, 3, 4]);
  });

  it('defaults the limit to 100 steps', () => {
    const s = createDocStore({ initial: 0 });
    for (let i = 0; i < 150; i++) s.commit((d) => d + 1);
    expect(s.get().past.length).toBe(100);
  });

  it('replace sets a new document and clears both histories', () => {
    const s = createDocStore({ initial: 0 });
    s.commit((d) => d + 1);
    s.commit((d) => d + 1);
    s.undo();
    s.replace(7);
    expect(s.get()).toEqual({ doc: 7, past: [], future: [] });
  });

  it('onChange is called with the new document after commit, undo, redo and replace', () => {
    const onChange = vi.fn();
    const s = createDocStore({ initial: 0, onChange });
    s.commit((d) => d + 1);
    expect(onChange).toHaveBeenLastCalledWith(1);
    s.undo();
    expect(onChange).toHaveBeenLastCalledWith(0);
    s.redo();
    expect(onChange).toHaveBeenLastCalledWith(1);
    s.replace(7);
    expect(onChange).toHaveBeenLastCalledWith(7);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('undo and redo on empty history do nothing', () => {
    const onChange = vi.fn();
    const listener = vi.fn();
    const s = createDocStore({ initial: 0, onChange });
    s.subscribe(listener);
    s.undo();
    s.redo();
    expect(s.get()).toEqual({ doc: 0, past: [], future: [] });
    expect(listener).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('unsubscribing stops notifications', () => {
    const s = createDocStore({ initial: 0 });
    const listener = vi.fn();
    const off = s.subscribe(listener);
    s.commit((d) => d + 1);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    s.commit((d) => d + 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
