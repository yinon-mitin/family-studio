/** Generic document store with undo/redo history. No DOM or UI imports: usable in plain Node. */

export interface DocSnapshot<D> {
  doc: D;
  past: D[];
  future: D[];
}

export interface DocStore<D> {
  get(): DocSnapshot<D>;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** If `fn` returns the same object, nothing changes. The same non-empty `key` within `mergeMs` merges into one undo step. */
  commit(fn: (doc: D) => D, key?: string): void;
  undo(): void;
  redo(): void;
  /** New document: both histories are cleared. */
  replace(doc: D): void;
}

export function createDocStore<D>(opts: {
  initial: D;
  limit?: number;
  mergeMs?: number;
  now?: () => number;
  onChange?: (doc: D) => void;
}): DocStore<D> {
  const limit = opts.limit ?? 100;
  const mergeMs = opts.mergeMs ?? 1000;
  const now = opts.now ?? Date.now;
  let snap: DocSnapshot<D> = { doc: opts.initial, past: [], future: [] };
  let lastKey = '';
  let lastTime = 0;
  const listeners = new Set<() => void>();

  function set(next: DocSnapshot<D>): void {
    snap = next;
    listeners.forEach((l) => l());
    opts.onChange?.(snap.doc);
  }

  return {
    get: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    commit(fn, key = '') {
      const next = fn(snap.doc);
      if (next === snap.doc) return;
      const t = now();
      const merge = key !== '' && key === lastKey && t - lastTime < mergeMs;
      lastKey = key;
      lastTime = t;
      set({ doc: next, past: merge ? snap.past : [...snap.past, snap.doc].slice(-limit), future: [] });
    },
    undo() {
      if (snap.past.length === 0) return;
      lastKey = '';
      set({ doc: snap.past[snap.past.length - 1], past: snap.past.slice(0, -1), future: [snap.doc, ...snap.future] });
    },
    redo() {
      if (snap.future.length === 0) return;
      lastKey = '';
      set({ doc: snap.future[0], past: [...snap.past, snap.doc], future: snap.future.slice(1) });
    },
    replace(doc) {
      lastKey = '';
      set({ doc, past: [], future: [] });
    },
  };
}
