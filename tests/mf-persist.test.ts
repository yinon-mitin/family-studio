import { describe, expect, it } from 'vitest';
import {
  FILE_APP,
  STORAGE_KEY,
  clearAuto,
  fromFile,
  loadAuto,
  sanitizeDoc,
  saveAuto,
  toFile,
} from '../src/tools/my-family/persist.ts';
import { MAX_FIGURES, figureBounds, type Figure, type MyFamilyDoc } from '../src/tools/my-family/model.ts';
import { sheetSize } from '../src/tools/my-family/sheet.ts';

const fig = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'a1',
  kind: 'circle',
  x: 500,
  y: 600,
  size: 100,
  rotation: 0,
  color: '#e53935',
  texture: null,
  ...over,
});

const docOf = (figures: unknown, over: Record<string, unknown> = {}) => ({
  version: 1,
  orientation: 'portrait',
  figures,
  ...over,
});

const sample: MyFamilyDoc = {
  version: 1,
  orientation: 'landscape',
  figures: [
    { id: 'a', kind: 'circle', x: 300, y: 400, size: 120, rotation: 0, color: '#e53935', texture: 'stripes' },
    { id: 'b', kind: 'triangle', x: 600.25, y: 500, size: 80, rotation: 45.5, color: '#1c1c24', texture: 'dots' },
    { id: 'c', kind: 'rect', x: 900, y: 450, size: 200, rotation: 90, color: '#ffffff', texture: null },
  ],
};

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const throwingStore = {
  getItem: (): string | null => {
    throw new Error('denied');
  },
  setItem: (): void => {
    throw new Error('denied');
  },
  removeItem: (): void => {
    throw new Error('denied');
  },
};

function insideSheet(f: Figure, o: 'portrait' | 'landscape'): boolean {
  const { w, h } = sheetSize(o);
  const b = figureBounds(f);
  const eps = 0.01;
  return b.minX >= -eps && b.minY >= -eps && b.maxX <= w + eps && b.maxY <= h + eps;
}

describe('constants', () => {
  it('uses the agreed key and marker', () => {
    expect(STORAGE_KEY).toBe('family-studio:my-family:autosave:v1');
    expect(FILE_APP).toBe('family-studio-my-family');
  });
});

describe('file round trip', () => {
  it('fromFile(toFile(doc)) equals doc', () => {
    expect(fromFile(toFile(sample))).toEqual(sample);
  });

  it('writes the marker and version', () => {
    const parsed = JSON.parse(toFile(sample));
    expect(parsed.app).toBe('family-studio-my-family');
    expect(parsed.version).toBe(1);
    expect(parsed.doc).toEqual(sample);
  });

  it('rejects a wrong marker, a crest file, bad JSON, empty text and null', () => {
    expect(fromFile(JSON.stringify({ app: 'family-crest', version: 1, doc: sample }))).toBeNull();
    expect(fromFile(JSON.stringify({ app: 'family-tree', version: 1, doc: sample }))).toBeNull();
    expect(fromFile(JSON.stringify({ version: 1, doc: sample }))).toBeNull();
    expect(fromFile('{not json')).toBeNull();
    expect(fromFile('')).toBeNull();
    expect(fromFile('null')).toBeNull();
    expect(fromFile('[]')).toBeNull();
    expect(fromFile('"x"')).toBeNull();
  });

  it('rejects a version other than 1 and a missing doc', () => {
    expect(fromFile(JSON.stringify({ app: FILE_APP, version: 2, doc: sample }))).toBeNull();
    expect(fromFile(JSON.stringify({ app: FILE_APP, doc: sample }))).toBeNull();
    expect(fromFile(JSON.stringify({ app: FILE_APP, version: 1 }))).toBeNull();
    expect(fromFile(JSON.stringify({ app: FILE_APP, version: 1, doc: 'x' }))).toBeNull();
  });
});

describe('sanitizeDoc', () => {
  it('returns null for things that are not documents', () => {
    for (const v of [null, undefined, 5, 'x', true, [], [1, 2], {}, { figures: 'no' }]) {
      expect(sanitizeDoc(v)).toBeNull();
    }
  });

  it('never throws on garbage', () => {
    const junk: unknown[] = [
      docOf([null, undefined, 1, 'x', [], [[]], { id: null }, fig({ x: {} }), fig({ size: [] })]),
      docOf(null),
      docOf([[null]], { orientation: {} }),
      { figures: [{ figures: [{}] }] },
    ];
    for (const j of junk) expect(() => sanitizeDoc(j)).not.toThrow();
  });

  it('does not mutate its input', () => {
    const raw = docOf([fig({ size: 5, color: 'red', x: 1e9, id: 7 }), fig({ id: 'a1' }), fig({ id: 'a1' })]);
    const copy = JSON.parse(JSON.stringify(raw));
    sanitizeDoc(raw);
    expect(raw).toEqual(copy);
  });

  it('drops figures with an unknown kind', () => {
    const d = sanitizeDoc(docOf([fig({ id: 'x', kind: 'star' }), fig({ id: 'y', kind: 'square' }), fig({ id: 'z', kind: 5 })]));
    expect(d?.figures.map((f) => f.id)).toEqual(['y']);
  });

  it('replaces NaN-like and infinite sizes with 100 and clamps range', () => {
    // NaN and Infinity do not survive JSON, so pass them as real numbers
    const d = sanitizeDoc(docOf([fig({ id: 'a', size: NaN }), fig({ id: 'b', size: Infinity }), fig({ id: 'c', size: 5 }), fig({ id: 'd', size: 9999 }), fig({ id: 'e', size: 'big' })]));
    expect(d?.figures.map((f) => f.size)).toEqual([100, 100, 30, 260, 100]);
  });

  it('falls back to the default colour unless it is in the palette; stores lowercase', () => {
    const d = sanitizeDoc(
      docOf([
        fig({ id: 'a', color: 'red' }),
        fig({ id: 'b', color: '#123456' }),
        fig({ id: 'c', color: '#E53935' }),
        fig({ id: 'd', color: 42 }),
        fig({ id: 'e', color: '#FFFFFF' }),
      ]),
    );
    expect(d?.figures.map((f) => f.color)).toEqual(['#42a5f5', '#42a5f5', '#e53935', '#42a5f5', '#ffffff']);
  });

  it('turns an unknown texture into null and keeps known ones', () => {
    const d = sanitizeDoc(docOf([fig({ id: 'a', texture: 'ermine' }), fig({ id: 'b', texture: 'waves' }), fig({ id: 'c', texture: 3 }), fig({ id: 'd', texture: undefined })]));
    expect(d?.figures.map((f) => f.texture)).toEqual([null, 'waves', null, null]);
  });

  it('normalizes rotation to [0, 360)', () => {
    const d = sanitizeDoc(docOf([fig({ id: 'a', rotation: 725 }), fig({ id: 'b', rotation: -90 }), fig({ id: 'c', rotation: NaN }), fig({ id: 'd', rotation: 360 }), fig({ id: 'e', rotation: Infinity })]));
    expect(d?.figures.map((f) => f.rotation)).toEqual([5, 270, 0, 0, 0]);
  });

  it('puts far-off coordinates back on the sheet', () => {
    const raw = docOf([
      fig({ id: 'a', x: 1e9, y: -1e9 }),
      fig({ id: 'b', kind: 'triangle', x: -500, y: 99999, rotation: 33, size: 260 }),
      fig({ id: 'c', x: NaN, y: Infinity }),
      fig({ id: 'd', kind: 'rect', x: 'left', y: null, rotation: 17, size: 250 }),
    ]);
    for (const o of ['portrait', 'landscape'] as const) {
      const d = sanitizeDoc({ ...raw, orientation: o });
      expect(d?.figures).toHaveLength(4);
      for (const f of d!.figures) {
        expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
        expect(insideSheet(f, o)).toBe(true);
      }
    }
  });

  it('rounds x, y and size to 2 decimals', () => {
    const d = sanitizeDoc(docOf([fig({ x: 300.1234567, y: 400.0000001 + 0.1 + 0.2, size: 100.456789 })]));
    expect(d?.figures[0]).toMatchObject({ x: 300.12, y: 400.3, size: 100.46 });
  });

  it('replaces duplicate and non-string ids with unique ones', () => {
    const d = sanitizeDoc(docOf([fig({ id: 'same' }), fig({ id: 'same' }), fig({ id: 7 }), fig({ id: '' }), fig({ id: null }), fig({ id: undefined })]));
    const ids = d!.figures.map((f) => f.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(ids[0]).toBe('same');
    for (const id of ids) expect(typeof id === 'string' && id.length > 0).toBe(true);
  });

  it('does not let a generated id collide with a later real id', () => {
    const d = sanitizeDoc(docOf([fig({ id: 5 }), fig({ id: 'b' }), fig({ id: 'b' })]));
    expect(new Set(d!.figures.map((f) => f.id)).size).toBe(3);
  });

  it('truncates 10 000 figures to the maximum', () => {
    const many = Array.from({ length: 10000 }, (_, i) => fig({ id: `f${i}` }));
    const d = sanitizeDoc(docOf(many));
    expect(d?.figures).toHaveLength(MAX_FIGURES);
    expect(MAX_FIGURES).toBe(200);
  });

  it('counts the limit after dropping invalid entries', () => {
    const items = [...Array.from({ length: 300 }, () => null), ...Array.from({ length: 250 }, (_, i) => fig({ id: `f${i}` }))];
    expect(sanitizeDoc(docOf(items))?.figures).toHaveLength(MAX_FIGURES);
  });

  it('maps an unknown orientation to portrait and keeps landscape', () => {
    expect(sanitizeDoc(docOf([], { orientation: 'diagonal' }))?.orientation).toBe('portrait');
    expect(sanitizeDoc(docOf([], { orientation: 5 }))?.orientation).toBe('portrait');
    expect(sanitizeDoc(docOf([], { orientation: 'landscape' }))?.orientation).toBe('landscape');
  });

  it('always yields version 1 and keeps layer order', () => {
    const d = sanitizeDoc(docOf([fig({ id: 'a' }), fig({ id: 'b' }), fig({ id: 'c' })], { version: 99 }));
    expect(d?.version).toBe(1);
    expect(d?.figures.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('is idempotent', () => {
    const once = sanitizeDoc(docOf([fig({ x: 1e9, size: 5, color: 'red', rotation: 725.123456 }), fig({ kind: 'triangle', x: -40, y: 3 })]));
    expect(sanitizeDoc(once)).toEqual(once);
  });
});

describe('autosave', () => {
  it('saveAuto then loadAuto returns the same document', () => {
    const store = fakeStore();
    saveAuto(sample, store);
    expect(store.data.has(STORAGE_KEY)).toBe(true);
    expect(loadAuto(store)).toEqual(sample);
  });

  it('loadAuto returns null for an empty store', () => {
    expect(loadAuto(fakeStore())).toBeNull();
  });

  it('clearAuto removes the key', () => {
    const store = fakeStore();
    saveAuto(sample, store);
    clearAuto(store);
    expect(store.data.has(STORAGE_KEY)).toBe(false);
    expect(loadAuto(store)).toBeNull();
  });

  it('a corrupted entry gives null', () => {
    expect(loadAuto(fakeStore({ [STORAGE_KEY]: '{oops' }))).toBeNull();
    expect(loadAuto(fakeStore({ [STORAGE_KEY]: 'null' }))).toBeNull();
    expect(loadAuto(fakeStore({ [STORAGE_KEY]: '[1,2]' }))).toBeNull();
  });

  it('a hostile entry is sanitized on load', () => {
    const store = fakeStore({ [STORAGE_KEY]: JSON.stringify(docOf([fig({ size: 5, color: 'red' })])) });
    expect(loadAuto(store)?.figures[0]).toMatchObject({ size: 30, color: '#42a5f5' });
  });

  it('a store whose methods throw crashes none of the three functions', () => {
    expect(() => saveAuto(sample, throwingStore)).not.toThrow();
    expect(() => clearAuto(throwingStore)).not.toThrow();
    expect(loadAuto(throwingStore)).toBeNull();
  });

  it('with no localStorage in the environment all three are harmless', () => {
    expect((globalThis as { localStorage?: unknown }).localStorage).toBeUndefined();
    expect(loadAuto()).toBeNull();
    expect(() => saveAuto(sample)).not.toThrow();
    expect(() => clearAuto()).not.toThrow();
  });

  it('uses globalThis.localStorage lazily when it appears, and survives it throwing on access', () => {
    const g = globalThis as { localStorage?: unknown };
    try {
      const store = fakeStore();
      g.localStorage = store;
      saveAuto(sample);
      expect(loadAuto()).toEqual(sample);
      clearAuto();
      expect(store.data.size).toBe(0);

      delete g.localStorage;
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError');
        },
      });
      expect(loadAuto()).toBeNull();
      expect(() => saveAuto(sample)).not.toThrow();
      expect(() => clearAuto()).not.toThrow();
    } finally {
      delete g.localStorage;
    }
  });
});
