import {
  COLORS,
  MAX_FIGURES,
  SIZE_DEFAULT,
  SIZE_MAX,
  SIZE_MIN,
  TEXTURES,
  clampToSheet,
  figureBounds,
  type Figure,
  type FigureKind,
  type MyFamilyDoc,
  type TextureId,
} from './model.ts';
import { sheetSize, type Orientation } from './sheet.ts';

export const STORAGE_KEY = 'family-studio:my-family:autosave:v1';
export const FILE_APP = 'family-studio-my-family';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KINDS: readonly string[] = ['circle', 'square', 'rect', 'triangle'];
const DEFAULT_COLOR = '#42a5f5';
const MAX_ID_LENGTH = 64;
const INSIDE_TOLERANCE = 1e-6;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown, def: number, min: number, max: number): number =>
  finite(v) ? Math.min(max, Math.max(min, v)) : def;
const oneOf = <T extends string>(v: unknown, allowed: readonly string[], def: T): T =>
  typeof v === 'string' && allowed.includes(v) ? (v as T) : def;
const round2 = (n: number): number => Math.round(n * 100) / 100;

function freshId(taken: Set<string>): string {
  for (;;) {
    let id = '';
    while (id.length < 8) id += Math.floor(Math.random() * 36).toString(36);
    if (!taken.has(id)) return id;
  }
}

// Rounding can push a figure out of the sheet by up to 0.005; nudge it back by 0.01.
function placeOnSheet(f: Figure, o: Orientation): Figure {
  const placed = clampToSheet(f, o);
  const out: Figure = { ...placed, x: round2(placed.x), y: round2(placed.y) };
  const { w, h } = sheetSize(o);
  const b = figureBounds(out);
  if (b.minX < -INSIDE_TOLERANCE) out.x = round2(out.x + 0.01);
  else if (b.maxX > w + INSIDE_TOLERANCE) out.x = round2(out.x - 0.01);
  if (b.minY < -INSIDE_TOLERANCE) out.y = round2(out.y + 0.01);
  else if (b.maxY > h + INSIDE_TOLERANCE) out.y = round2(out.y - 0.01);
  return out;
}

function figure(v: unknown, o: Orientation): { fig: Figure; rawId: string | null } | null {
  if (!isObj(v) || typeof v.kind !== 'string' || !KINDS.includes(v.kind)) return null;
  const { w, h } = sheetSize(o);
  const color = typeof v.color === 'string' && COLORS.includes(v.color.toLowerCase()) ? v.color.toLowerCase() : DEFAULT_COLOR;
  const rotation = finite(v.rotation) ? round2(((v.rotation % 360) + 360) % 360) % 360 : 0;
  const fig = placeOnSheet(
    {
      id: '',
      kind: v.kind as FigureKind,
      // pre-clamp so clampToSheet never adds offsets to huge magnitudes (precision loss)
      x: num(v.x, w / 2, 0, w),
      y: num(v.y, h / 2, 0, h),
      size: round2(num(v.size, SIZE_DEFAULT, SIZE_MIN, SIZE_MAX)),
      rotation,
      color,
      texture: typeof v.texture === 'string' && TEXTURES.includes(v.texture as TextureId) ? (v.texture as TextureId) : null,
    },
    o,
  );
  const rawId = typeof v.id === 'string' && v.id.length > 0 && v.id.length <= MAX_ID_LENGTH ? v.id : null;
  return { fig, rawId };
}

/** Coerces arbitrary data to a valid document, or returns null if it is not a document at all. Never throws. */
export function sanitizeDoc(raw: unknown): MyFamilyDoc | null {
  try {
    if (!isObj(raw) || !Array.isArray(raw.figures)) return null;
    const orientation = oneOf<Orientation>(raw.orientation, ['portrait', 'landscape'], 'portrait');
    const kept: Figure[] = [];
    const taken = new Set<string>();
    const needId: number[] = [];
    for (const item of raw.figures) {
      if (kept.length >= MAX_FIGURES) break;
      const parsed = figure(item, orientation);
      if (!parsed) continue;
      if (parsed.rawId !== null && !taken.has(parsed.rawId)) {
        taken.add(parsed.rawId);
        parsed.fig.id = parsed.rawId;
      } else {
        needId.push(kept.length);
      }
      kept.push(parsed.fig);
    }
    for (const i of needId) {
      const id = freshId(taken);
      taken.add(id);
      kept[i].id = id;
    }
    return { version: 1, orientation, figures: kept };
  } catch {
    return null;
  }
}

// ---------- project file ----------

export const toFile = (doc: MyFamilyDoc): string => JSON.stringify({ app: FILE_APP, version: 1, doc }, null, 1);

export function fromFile(text: string): MyFamilyDoc | null {
  try {
    const data: unknown = JSON.parse(text);
    if (!isObj(data) || data.app !== FILE_APP || data.version !== 1) return null;
    return sanitizeDoc(data.doc);
  } catch {
    return null;
  }
}

// ---------- autosave ----------

// Resolved on every call: the storage may be missing (Node) or throw on access (private mode).
function defaultStore(): Store | null {
  try {
    return (globalThis as { localStorage?: Store }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveAuto(doc: MyFamilyDoc, store?: Store): void {
  try {
    (store ?? defaultStore())?.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* storage may be closed: the app works without it */
  }
}

export function loadAuto(store?: Store): MyFamilyDoc | null {
  try {
    const raw = (store ?? defaultStore())?.getItem(STORAGE_KEY);
    return raw ? sanitizeDoc(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearAuto(store?: Store): void {
  try {
    (store ?? defaultStore())?.removeItem(STORAGE_KEY);
  } catch {
    /* see above */
  }
}
