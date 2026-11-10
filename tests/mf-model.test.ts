import { describe, expect, it } from 'vitest';
import {
  COLORS,
  MAX_FIGURES,
  SIZE_DEFAULT,
  SIZE_MAX,
  SIZE_MIN,
  TEXTURES,
  addFigure,
  clampToSheet,
  deleteFigure,
  duplicateFigure,
  figureBounds,
  figureOutline,
  neighbour,
  newDoc,
  reorder,
  updateFigure,
  type Figure,
  type FigureKind,
  type MyFamilyDoc,
} from '../src/tools/my-family/model.ts';

function fig(kind: FigureKind, over: Partial<Figure> = {}): Figure {
  return { id: 'f', kind, x: 500, y: 500, size: 100, rotation: 0, color: '#42a5f5', texture: null, ...over };
}

function docOf(ids: string[]): MyFamilyDoc {
  return { version: 1, orientation: 'portrait', figures: ids.map((id) => fig('circle', { id })) };
}

const order = (d: MyFamilyDoc) => d.figures.map((f) => f.id);

describe('constants', () => {
  it('exposes the agreed limits, palette and textures', () => {
    expect([SIZE_MIN, SIZE_MAX, SIZE_DEFAULT, MAX_FIGURES]).toEqual([30, 260, 100, 200]);
    expect(COLORS).toEqual([
      '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00897b', '#42a5f5', '#1e53a4',
      '#8e24aa', '#ec407a', '#6d4c41', '#9e9e9e', '#1c1c24', '#ffffff',
    ]);
    expect(TEXTURES).toEqual(['stripes', 'checks', 'dots', 'waves', 'lozenges']);
  });
});

describe('newDoc', () => {
  it('is empty and keeps the orientation', () => {
    expect(newDoc('landscape')).toEqual({ version: 1, orientation: 'landscape', figures: [] });
  });
});

describe('figureOutline', () => {
  it('circle has 32 points on the radius', () => {
    const pts = figureOutline(fig('circle'));
    expect(pts).toHaveLength(32);
    for (const [x, y] of pts) expect(Math.hypot(x - 500, y - 500)).toBeCloseTo(50, 6);
  });

  it('square has side 0.9 * size', () => {
    const xs = figureOutline(fig('square')).map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(455, 6);
    expect(Math.max(...xs)).toBeCloseTo(545, 6);
  });

  it('triangle has apex at -0.435 size and base at +0.435 size', () => {
    const pts = figureOutline(fig('triangle'));
    expect(pts).toHaveLength(3);
    expect(pts[0][0]).toBeCloseTo(500, 6);
    expect(pts[0][1]).toBeCloseTo(456.5, 6);
    expect(pts[1][1]).toBeCloseTo(543.5, 6);
    expect(pts[2][1]).toBeCloseTo(543.5, 6);
  });

  it('applies rotation and translation', () => {
    const pts = figureOutline(fig('rect', { rotation: 90 }));
    const ys = pts.map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(450, 6);
    expect(Math.max(...ys)).toBeCloseTo(550, 6);
  });
});

describe('figureBounds', () => {
  it('circle is exact', () => {
    expect(figureBounds(fig('circle'))).toEqual({ minX: 450, minY: 450, maxX: 550, maxY: 550 });
  });

  it('rect at rotation 0', () => {
    const b = figureBounds(fig('rect'));
    expect(b.minX).toBeCloseTo(450, 6);
    expect(b.maxX).toBeCloseTo(550, 6);
    expect(b.minY).toBeCloseTo(472.5, 6);
    expect(b.maxY).toBeCloseTo(527.5, 6);
  });

  it('rect at rotation 90', () => {
    const b = figureBounds(fig('rect', { rotation: 90 }));
    expect(b.minX).toBeCloseTo(472.5, 6);
    expect(b.maxX).toBeCloseTo(527.5, 6);
    expect(b.minY).toBeCloseTo(450, 6);
    expect(b.maxY).toBeCloseTo(550, 6);
  });

  it('triangle', () => {
    const b = figureBounds(fig('triangle'));
    expect(b.minY).toBeCloseTo(456.5, 6);
    expect(b.maxY).toBeCloseTo(543.5, 6);
    expect(b.minX).toBeCloseTo(450, 6);
    expect(b.maxX).toBeCloseTo(550, 6);
  });
});

describe('clampToSheet', () => {
  it('pulls a circle off the sheet back inside', () => {
    const c = clampToSheet(fig('circle', { x: -50, y: 2000 }), 'portrait');
    expect(c.x).toBeCloseTo(50, 6);
    expect(c.y).toBeCloseTo(1364, 6);
  });

  it('leaves an inside figure equal by value', () => {
    const f = fig('circle');
    expect(clampToSheet(f, 'portrait')).toEqual(f);
  });

  it('uses the landscape sheet', () => {
    const c = clampToSheet(fig('circle', { x: 5000, y: 5000 }), 'landscape');
    expect(c.x).toBeCloseTo(1364, 6);
    expect(c.y).toBeCloseTo(950, 6);
  });
});

describe('addFigure', () => {
  it('first figure goes to the sheet centre with defaults', () => {
    const { doc, id } = addFigure(newDoc('portrait'), 'circle');
    expect(doc.figures[0]).toEqual({
      id, kind: 'circle', x: 500, y: 707, size: 100, rotation: 0, color: '#42a5f5', texture: null,
    });
  });

  it('staggers following figures and cycles after five', () => {
    let doc = newDoc('portrait');
    const pos: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      doc = addFigure(doc, 'square').doc;
      const f = doc.figures[i];
      pos.push([f.x, f.y]);
    }
    expect(pos).toEqual([[500, 707], [540, 747], [460, 667], [580, 787], [420, 627], [500, 707]]);
  });

  it('takes options', () => {
    const { doc } = addFigure(newDoc('portrait'), 'rect', { color: '#e53935', size: 150, texture: 'dots' });
    expect(doc.figures[0]).toMatchObject({ kind: 'rect', color: '#e53935', size: 150, texture: 'dots' });
  });

  it('gives every figure a distinct 8-char base36 id', () => {
    let doc = newDoc('portrait');
    for (let i = 0; i < 50; i++) doc = addFigure(doc, 'circle').doc;
    const ids = doc.figures.map((f) => f.id);
    expect(new Set(ids).size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]{8}$/);
  });

  it('does nothing at the figure limit', () => {
    let doc = newDoc('portrait');
    for (let i = 0; i < MAX_FIGURES; i++) doc = addFigure(doc, 'circle').doc;
    expect(doc.figures).toHaveLength(MAX_FIGURES);
    const r = addFigure(doc, 'circle');
    expect(r.doc).toBe(doc);
    expect(r.id).toBe('');
  });

  it('does not mutate the input', () => {
    const d = newDoc('portrait');
    addFigure(d, 'circle');
    expect(d.figures).toHaveLength(0);
  });
});

describe('updateFigure', () => {
  const base = addFigure(newDoc('portrait'), 'circle');
  const get = (d: MyFamilyDoc) => d.figures[0];

  it('clamps size', () => {
    expect(get(updateFigure(base.doc, base.id, { size: 9999 })).size).toBe(260);
    expect(get(updateFigure(base.doc, base.id, { size: 1 })).size).toBe(30);
  });

  it('normalises rotation into [0, 360)', () => {
    expect(get(updateFigure(base.doc, base.id, { rotation: -90 })).rotation).toBe(270);
    expect(get(updateFigure(base.doc, base.id, { rotation: 450 })).rotation).toBe(90);
  });

  it('keeps the figure on the sheet', () => {
    const f = get(updateFigure(base.doc, base.id, { x: -999 }));
    expect(f.x).toBeCloseTo(50, 6);
  });

  it('keeps the figure on the sheet when it grows', () => {
    const d = updateFigure(base.doc, base.id, { x: 60 });
    const f = get(updateFigure(d, base.id, { size: 260 }));
    expect(f.x).toBeCloseTo(130, 6);
  });

  it('unknown id returns the same document', () => {
    expect(updateFigure(base.doc, 'nope', { size: 50 })).toBe(base.doc);
  });

  it('rejects a colour outside the palette', () => {
    expect(updateFigure(base.doc, base.id, { color: 'red' })).toBe(base.doc);
  });

  it('accepts a palette colour case-insensitively and stores lowercase', () => {
    expect(get(updateFigure(base.doc, base.id, { color: '#E53935' })).color).toBe('#e53935');
  });

  it('accepts a texture or null and rejects unknown textures', () => {
    const d = updateFigure(base.doc, base.id, { texture: 'waves' });
    expect(get(d).texture).toBe('waves');
    expect(get(updateFigure(d, base.id, { texture: null })).texture).toBeNull();
    expect(updateFigure(base.doc, base.id, { texture: 'plaid' as never })).toBe(base.doc);
  });

  it('does not mutate the input', () => {
    const before = JSON.stringify(base.doc);
    updateFigure(base.doc, base.id, { size: 200, color: '#e53935' });
    expect(JSON.stringify(base.doc)).toBe(before);
  });
});

describe('reorder', () => {
  const d = docOf(['a', 'b', 'c']);

  it('moves up, to top, down, to bottom', () => {
    expect(order(reorder(d, 'a', 'up'))).toEqual(['b', 'a', 'c']);
    expect(order(reorder(d, 'a', 'top'))).toEqual(['b', 'c', 'a']);
    expect(order(reorder(d, 'c', 'down'))).toEqual(['a', 'c', 'b']);
    expect(order(reorder(d, 'c', 'bottom'))).toEqual(['c', 'a', 'b']);
  });

  it('returns the same document when nothing moves', () => {
    expect(reorder(d, 'c', 'up')).toBe(d);
    expect(reorder(d, 'c', 'top')).toBe(d);
    expect(reorder(d, 'a', 'down')).toBe(d);
    expect(reorder(d, 'a', 'bottom')).toBe(d);
    expect(reorder(d, 'zzz', 'up')).toBe(d);
  });

  it('does not mutate the input', () => {
    reorder(d, 'a', 'top');
    expect(order(d)).toEqual(['a', 'b', 'c']);
  });
});

describe('neighbour', () => {
  const d = docOf(['a', 'b', 'c']);

  it('cycles through figures', () => {
    expect(neighbour(d, 'c', 1)).toBe('a');
    expect(neighbour(d, 'a', -1)).toBe('c');
    expect(neighbour(d, 'a', 1)).toBe('b');
    expect(neighbour(d, 'c', -1)).toBe('b');
  });

  it('starts from the ends when nothing is selected', () => {
    expect(neighbour(d, null, 1)).toBe('a');
    expect(neighbour(d, null, -1)).toBe('c');
    expect(neighbour(d, 'zzz', 1)).toBe('a');
    expect(neighbour(d, 'zzz', -1)).toBe('c');
  });

  it('empty document gives null', () => {
    expect(neighbour(newDoc('portrait'), null, 1)).toBeNull();
    expect(neighbour(newDoc('portrait'), 'a', -1)).toBeNull();
  });
});

describe('duplicateFigure', () => {
  it('puts the copy right above the original, shifted by 30, with a new id', () => {
    let doc = docOf(['a', 'b', 'c']);
    doc = updateFigure(doc, 'a', { color: '#e53935', texture: 'dots', size: 80, rotation: 45 });
    const r = duplicateFigure(doc, 'a');
    expect(order(r.doc)).toEqual(['a', r.id, 'b', 'c']);
    expect(r.id).not.toBe('a');
    const [orig, copy] = r.doc.figures;
    expect(copy.x).toBeCloseTo(orig.x + 30, 6);
    expect(copy.y).toBeCloseTo(orig.y + 30, 6);
    expect({ ...copy, id: '', x: 0, y: 0 }).toEqual({ ...orig, id: '', x: 0, y: 0 });
  });

  it('keeps the copy inside the sheet near an edge', () => {
    let doc = docOf(['a']);
    doc = updateFigure(doc, 'a', { x: 5000, y: 5000 });
    const { doc: out, id } = duplicateFigure(doc, 'a');
    const copy = out.figures.find((f) => f.id === id)!;
    const b = figureBounds(copy);
    expect(b.maxX).toBeLessThanOrEqual(1000 + 1e-9);
    expect(b.maxY).toBeLessThanOrEqual(1414 + 1e-9);
  });

  it('unknown id returns the same document and an empty id', () => {
    const doc = docOf(['a']);
    const r = duplicateFigure(doc, 'zzz');
    expect(r.doc).toBe(doc);
    expect(r.id).toBe('');
  });

  it('does nothing at the figure limit', () => {
    let doc = newDoc('portrait');
    for (let i = 0; i < MAX_FIGURES; i++) doc = addFigure(doc, 'circle').doc;
    const r = duplicateFigure(doc, doc.figures[0].id);
    expect(r.doc).toBe(doc);
    expect(r.id).toBe('');
  });
});

describe('deleteFigure', () => {
  it('removes the figure', () => {
    expect(order(deleteFigure(docOf(['a', 'b', 'c']), 'b'))).toEqual(['a', 'c']);
  });

  it('unknown id returns the same document', () => {
    const d = docOf(['a']);
    expect(deleteFigure(d, 'zzz')).toBe(d);
  });
});
