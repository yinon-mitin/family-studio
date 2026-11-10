import { sheetSize, type Orientation } from './sheet.ts';

export type FigureKind = 'circle' | 'square' | 'rect' | 'triangle';
export type TextureId = 'stripes' | 'checks' | 'dots' | 'waves' | 'lozenges';

export interface Figure {
  id: string;
  kind: FigureKind;
  x: number; // centre, in sheet units
  y: number;
  size: number;
  rotation: number; // degrees, [0, 360)
  color: string;
  texture: TextureId | null;
}

// Array order is layer order: the last figure is on top.
export interface MyFamilyDoc {
  version: 1;
  orientation: Orientation;
  figures: Figure[];
}

export const SIZE_MIN = 30;
export const SIZE_MAX = 260;
export const SIZE_DEFAULT = 100;
export const MAX_FIGURES = 200;

export const COLORS: readonly string[] = [
  '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00897b', '#42a5f5', '#1e53a4',
  '#8e24aa', '#ec407a', '#6d4c41', '#9e9e9e', '#1c1c24', '#ffffff',
];
export const TEXTURES: readonly TextureId[] = ['stripes', 'checks', 'dots', 'waves', 'lozenges'];

const DEFAULT_COLOR = '#42a5f5';
const SPAWN_OFFSETS = [0, 40, -40, 80, -80];
const DUPLICATE_SHIFT = 30;
const CIRCLE_POINTS = 32;

type Point = [number, number];
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function localShape(f: Figure): Point[] {
  const s = f.size;
  switch (f.kind) {
    case 'circle': {
      const pts: Point[] = [];
      for (let i = 0; i < CIRCLE_POINTS; i++) {
        const a = (2 * Math.PI * i) / CIRCLE_POINTS;
        pts.push([(s / 2) * Math.cos(a), (s / 2) * Math.sin(a)]);
      }
      return pts;
    }
    case 'square': {
      const h = 0.45 * s;
      return [[-h, -h], [h, -h], [h, h], [-h, h]];
    }
    case 'rect': {
      const hw = 0.5 * s;
      const hh = 0.275 * s;
      return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    }
    case 'triangle':
      return [[0, -0.435 * s], [0.5 * s, 0.435 * s], [-0.5 * s, 0.435 * s]];
  }
}

export function figureOutline(f: Figure): [number, number][] {
  const r = (f.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return localShape(f).map(([px, py]): Point => [f.x + px * cos - py * sin, f.y + px * sin + py * cos]);
}

export function figureBounds(f: Figure): Bounds {
  if (f.kind === 'circle') {
    const r = f.size / 2;
    return { minX: f.x - r, minY: f.y - r, maxX: f.x + r, maxY: f.y + r };
  }
  const pts = figureOutline(f);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// Moves the centre so that the bounding box lies on the sheet.
export function clampToSheet(f: Figure, o: Orientation): Figure {
  const { w, h } = sheetSize(o);
  const b = figureBounds(f);
  const dx = b.minX < 0 ? -b.minX : b.maxX > w ? w - b.maxX : 0;
  const dy = b.minY < 0 ? -b.minY : b.maxY > h ? h - b.maxY : 0;
  return dx === 0 && dy === 0 ? f : { ...f, x: f.x + dx, y: f.y + dy };
}

function newId(doc: MyFamilyDoc): string {
  const taken = new Set(doc.figures.map((f) => f.id));
  for (;;) {
    let id = '';
    while (id.length < 8) id += Math.floor(Math.random() * 36).toString(36);
    if (!taken.has(id)) return id;
  }
}

const clampSize = (n: number) => Math.min(SIZE_MAX, Math.max(SIZE_MIN, n));
const normRotation = (n: number) => ((n % 360) + 360) % 360;

export function newDoc(o: Orientation): MyFamilyDoc {
  return { version: 1, orientation: o, figures: [] };
}

export function addFigure(
  doc: MyFamilyDoc,
  kind: FigureKind,
  opts: { color?: string; size?: number; texture?: TextureId | null } = {},
): { doc: MyFamilyDoc; id: string } {
  if (doc.figures.length >= MAX_FIGURES) return { doc, id: '' };
  const { w, h } = sheetSize(doc.orientation);
  const off = SPAWN_OFFSETS[doc.figures.length % SPAWN_OFFSETS.length];
  const id = newId(doc);
  const color = opts.color !== undefined && COLORS.includes(opts.color.toLowerCase()) ? opts.color.toLowerCase() : DEFAULT_COLOR;
  const texture = opts.texture !== undefined && (opts.texture === null || TEXTURES.includes(opts.texture)) ? opts.texture : null;
  const figure = clampToSheet(
    {
      id,
      kind,
      x: w / 2 + off,
      y: h / 2 + off,
      size: clampSize(Number.isFinite(opts.size) ? (opts.size as number) : SIZE_DEFAULT),
      rotation: 0,
      color,
      texture,
    },
    doc.orientation,
  );
  return { doc: { ...doc, figures: [...doc.figures, figure] }, id };
}

export function updateFigure(doc: MyFamilyDoc, id: string, patch: Partial<Omit<Figure, 'id' | 'kind'>>): MyFamilyDoc {
  const idx = doc.figures.findIndex((f) => f.id === id);
  if (idx < 0) return doc;
  const next: Figure = { ...doc.figures[idx] };
  for (const key of ['x', 'y', 'size', 'rotation'] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (!Number.isFinite(v)) return doc;
    next[key] = key === 'size' ? clampSize(v) : key === 'rotation' ? normRotation(v) : v;
  }
  if (patch.color !== undefined) {
    const c = String(patch.color).toLowerCase();
    if (!COLORS.includes(c)) return doc;
    next.color = c;
  }
  if (patch.texture !== undefined) {
    if (patch.texture !== null && !TEXTURES.includes(patch.texture)) return doc;
    next.texture = patch.texture;
  }
  const figures = doc.figures.slice();
  figures[idx] = clampToSheet(next, doc.orientation);
  return { ...doc, figures };
}

export function deleteFigure(doc: MyFamilyDoc, id: string): MyFamilyDoc {
  if (!doc.figures.some((f) => f.id === id)) return doc;
  return { ...doc, figures: doc.figures.filter((f) => f.id !== id) };
}

export function duplicateFigure(doc: MyFamilyDoc, id: string): { doc: MyFamilyDoc; id: string } {
  const idx = doc.figures.findIndex((f) => f.id === id);
  if (idx < 0 || doc.figures.length >= MAX_FIGURES) return { doc, id: '' };
  const src = doc.figures[idx];
  const copyId = newId(doc);
  const copy = clampToSheet({ ...src, id: copyId, x: src.x + DUPLICATE_SHIFT, y: src.y + DUPLICATE_SHIFT }, doc.orientation);
  const figures = doc.figures.slice();
  figures.splice(idx + 1, 0, copy);
  return { doc: { ...doc, figures }, id: copyId };
}

export function reorder(doc: MyFamilyDoc, id: string, dir: 'up' | 'down' | 'top' | 'bottom'): MyFamilyDoc {
  const from = doc.figures.findIndex((f) => f.id === id);
  if (from < 0) return doc;
  const last = doc.figures.length - 1;
  const to = dir === 'up' ? Math.min(from + 1, last) : dir === 'down' ? Math.max(from - 1, 0) : dir === 'top' ? last : 0;
  if (to === from) return doc;
  const figures = doc.figures.slice();
  const [moved] = figures.splice(from, 1);
  figures.splice(to, 0, moved);
  return { ...doc, figures };
}

// Next/previous figure in layer order, wrapping around; with no valid selection starts from the ends.
export function neighbour(doc: MyFamilyDoc, id: string | null, dir: 1 | -1): string | null {
  const n = doc.figures.length;
  if (n === 0) return null;
  const idx = id === null ? -1 : doc.figures.findIndex((f) => f.id === id);
  if (idx < 0) return doc.figures[dir === 1 ? 0 : n - 1].id;
  return doc.figures[(idx + dir + n) % n].id;
}
