import type {
  CrestDoc,
  DivisionId,
  FieldStyle,
  FontId,
  Layer,
  OrnamentId,
  PatternId,
  ShapeId,
  TextForm,
} from './types.ts';
import { isHex } from './colors.ts';
import { hasSymbol } from '../data/symbols.ts';
import { ORNAMENTS } from '../render/ornaments.ts';
import { PATTERNS } from '../render/patterns.ts';
import { DIVISIONS, SHAPES } from '../render/shields.ts';
import { newId } from './doc.ts';
import { eraseKeys } from '../core/storage.ts';

const STORAGE_KEY = 'family-crest:autosave:v1';
const LEGACY_STORAGE_KEY = 'family-tree:autosave:v1';
const FILE_APP = 'family-crest';
const LEGACY_FILE_APP = 'family-tree';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, def: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const str = (v: unknown, def: string, max: number): string => (typeof v === 'string' ? v.slice(0, max) : def);
const bool = (v: unknown, def = false): boolean => (typeof v === 'boolean' ? v : def);
const hex = (v: unknown, def: string): string => (isHex(v) ? v.toLowerCase() : def);
const oneOf = <T extends string>(v: unknown, allowed: readonly string[], def: T): T =>
  typeof v === 'string' && allowed.includes(v) ? (v as T) : def;

const SHAPE_IDS = Object.keys(SHAPES);
const DIVISION_IDS = Object.keys(DIVISIONS);
const PATTERN_IDS = Object.keys(PATTERNS);
const ORNAMENT_IDS = Object.keys(ORNAMENTS);

function field(v: unknown): FieldStyle {
  const o = isObj(v) ? v : {};
  return {
    color: hex(o.color, '#2c5aa0'),
    pattern: o.pattern == null ? null : oneOf<PatternId>(o.pattern, PATTERN_IDS, 'stripes'),
    patternColor: hex(o.patternColor, '#ffffff'),
  };
}

/** Проверяет и приводит слой к допустимому виду; неизвестное отбрасывает. */
function layer(v: unknown, ids: Set<string>): Layer | null {
  if (!isObj(v)) return null;
  let id = str(v.id, '', 24);
  if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) id = newId();
  ids.add(id);
  const common = {
    id,
    x: num(v.x, 500, -2000, 3000),
    y: num(v.y, 600, -2000, 3000),
    scale: num(v.scale, 1, 0.05, 20),
    rotation: num(v.rotation, 0, -3600, 3600),
    flipX: bool(v.flipX),
    hidden: bool(v.hidden),
    locked: bool(v.locked),
    note: str(v.note, '', 1000),
  };
  switch (v.kind) {
    case 'shield': {
      const division = oneOf<DivisionId>(v.division, DIVISION_IDS, 'whole');
      const count = DIVISIONS[division].count;
      const raw = Array.isArray(v.fields) ? v.fields.slice(0, 6).map(field) : [];
      const fields = Array.from({ length: count }, (_, i) => raw[i] ?? raw[raw.length - 1] ?? field(null));
      return {
        ...common,
        kind: 'shield',
        shape: oneOf<ShapeId>(v.shape, SHAPE_IDS, 'heater'),
        division,
        fields,
        outline: hex(v.outline, '#1c1c24'),
        outlineWidth: num(v.outlineWidth, 8, 0, 40),
      };
    }
    case 'symbol': {
      const symbol = str(v.symbol, '', 64);
      if (!hasSymbol(symbol)) return null;
      const slot =
        isObj(v.slot) && typeof v.slot.shield === 'string'
          ? { shield: v.slot.shield, field: Math.round(num(v.slot.field, 0, 0, 5)) }
          : undefined;
      return { ...common, kind: 'symbol', symbol, color: hex(v.color, '#e0b44c'), halo: v.halo == null ? null : hex(v.halo, '#1c1c24'), slot };
    }
    case 'ornament': {
      const ornament = oneOf<OrnamentId>(v.ornament, ORNAMENT_IDS, 'laurel');
      const d = ORNAMENTS[ornament];
      return { ...common, kind: 'ornament', ornament, color: hex(v.color, d.color), color2: hex(v.color2, d.color2) };
    }
    case 'text':
      return {
        ...common,
        kind: 'text',
        text: str(v.text, '', 120),
        font: oneOf<FontId>(v.font, ['serif', 'display'], 'display'),
        bold: bool(v.bold, true),
        form: oneOf<TextForm>(v.form, ['line', 'arcUp', 'arcDown', 'banner'], 'line'),
        color: hex(v.color, '#fbf6e8'),
        bannerColor: hex(v.bannerColor, '#b3282d'),
        radius: num(v.radius, 380, 80, 2000),
      };
    default:
      return null;
  }
}

/** Приводит произвольные данные к безопасному документу или возвращает null. */
export function parseDoc(v: unknown): CrestDoc | null {
  if (!isObj(v) || !Array.isArray(v.layers)) return null;
  const ids = new Set<string>();
  const layers = v.layers.slice(0, 200).map((l) => layer(l, ids)).filter((l): l is Layer => l !== null);
  // привязка к щиту, которого нет, превращается в обычное положение, чтобы символ не пропал
  const shields = new Set(layers.filter((l) => l.kind === 'shield').map((l) => l.id));
  for (const l of layers) if (l.kind === 'symbol' && l.slot && !shields.has(l.slot.shield)) l.slot = undefined;
  return {
    version: 1,
    family: str(v.family, '', 80),
    background: v.background == null ? null : hex(v.background, '#ffffff'),
    snap: bool(v.snap),
    layers,
  };
}

// ---------- файл проекта ----------

export const toFile = (doc: CrestDoc): string => JSON.stringify({ app: FILE_APP, version: 1, doc }, null, 1);

export function fromFile(text: string): CrestDoc | null {
  try {
    const data: unknown = JSON.parse(text);
    if (!isObj(data) || (data.app !== FILE_APP && data.app !== LEGACY_FILE_APP)) return null;
    return parseDoc(data.doc);
  } catch {
    return null;
  }
}

// ---------- автосохранение ----------

export function saveAuto(doc: CrestDoc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* хранилище может быть закрыто: сайт работает и без него */
  }
}

export function loadAuto(): CrestDoc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? parseDoc(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Like `clearAuto`, but throws when the stored crest could not be erased. */
export function eraseAuto(): void {
  eraseKeys([STORAGE_KEY, LEGACY_STORAGE_KEY]);
}

export function clearAuto(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* см. выше */
  }
}
