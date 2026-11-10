import { useEffect, useState } from 'preact/hooks';
import type { CrestDoc, Layer, OrnamentId, ShieldLayer, SymbolLayer, TextLayer } from './types.ts';
import { detachSymbol, emptyDoc, findLayer, freeSlot, makeOrnament, makeShield, makeSymbol, makeText, newId } from './doc.ts';
import { loadAuto, saveAuto } from './serialize.ts';
import { ORNAMENTS } from '../render/ornaments.ts';
import { defaultFields } from '../render/shields.ts';
import { t } from '../i18n/index.ts';

export type Pane = 'add' | 'props' | 'layers';
export type TabId = 'shield' | 'work' | 'animal' | 'nature' | 'symbol' | 'ornament' | 'text';

export interface State {
  screen: 'start' | 'editor';
  doc: CrestDoc;
  selected: string | null;
  past: CrestDoc[];
  future: CrestDoc[];
  pane: Pane;
  tab: TabId;
  /** Нажатие на символ в каталоге заменяет выбранный символ, а не добавляет новый. */
  replace: boolean;
  toast: string | null;
  dialog: 'about' | 'export' | 'newdoc' | null;
}

let state: State = {
  screen: 'start',
  doc: emptyDoc(),
  selected: null,
  past: [],
  future: [],
  pane: 'add',
  tab: 'shield',
  replace: false,
  toast: null,
  dialog: null,
};

const listeners = new Set<() => void>();
export const getState = (): State => state;

export function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useStore<T>(select: (s: State) => T): T {
  const [value, setValue] = useState(() => select(state));
  useEffect(() => {
    const check = () => setValue(() => select(state));
    listeners.add(check);
    check();
    return () => {
      listeners.delete(check);
    };
  }, []);
  return value;
}

// ---------- история ----------

const HISTORY_LIMIT = 100;
let lastKey = '';
let lastTime = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveAuto(state.doc), 400);
}

/** Изменение документа. Одинаковый `key` в пределах секунды сливается в один шаг отмены. */
export function commit(fn: (doc: CrestDoc) => CrestDoc, key = ''): void {
  const next = fn(state.doc);
  if (next === state.doc) return;
  const now = Date.now();
  const merge = key !== '' && key === lastKey && now - lastTime < 1000;
  lastKey = key;
  lastTime = now;
  setState({
    doc: next,
    past: merge ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT),
    future: [],
  });
  scheduleSave();
}

export function undo(): void {
  const prev = state.past[state.past.length - 1];
  if (!prev) return;
  lastKey = '';
  setState({ doc: prev, past: state.past.slice(0, -1), future: [state.doc, ...state.future], selected: keepSelection(prev) });
  scheduleSave();
}

export function redo(): void {
  const next = state.future[0];
  if (!next) return;
  lastKey = '';
  setState({ doc: next, past: [...state.past, state.doc], future: state.future.slice(1), selected: keepSelection(next) });
  scheduleSave();
}

const keepSelection = (doc: CrestDoc): string | null => (findLayer(doc, state.selected) ? state.selected : null);

/** Новый документ (шаблон, файл, чистый лист): история начинается заново. */
export function openDoc(doc: CrestDoc): void {
  lastKey = '';
  setState({ doc, past: [], future: [], selected: null, screen: 'editor', pane: 'add', tab: doc.layers.length ? 'symbol' : 'shield', replace: false, dialog: null });
  scheduleSave();
}

/**
 * Back to an empty document on the start screen without scheduling an autosave,
 * and cancelling a pending one, so erased data is not written back.
 */
export function resetDoc(): void {
  clearTimeout(saveTimer);
  lastKey = '';
  setState({ doc: emptyDoc(), past: [], future: [], selected: null, pane: 'add', tab: 'shield', replace: false, screen: 'start', dialog: null });
}

export function goStart(): void {
  setState({ screen: 'start', selected: null, dialog: null });
}

export function restoreAuto(): CrestDoc | null {
  return loadAuto();
}

// ---------- слои ----------

export const select = (id: string | null): void => setState({ selected: id, replace: id ? state.replace && findLayer(state.doc, id)?.kind === 'symbol' : false });

export function updateLayer(id: string, patch: Partial<Layer>, key = ''): void {
  commit(
    (doc) => ({
      ...doc,
      layers: doc.layers.map((l) => {
        if (l.id !== id) return l;
        let next = { ...l, ...patch } as Layer;
        if (next.kind === 'shield') next = normalizeShield(next);
        return next;
      }),
    }),
    key,
  );
}

function normalizeShield(sh: ShieldLayer): ShieldLayer {
  const want = defaultFields(sh.division, sh.fields).length;
  return sh.fields.length === want ? sh : { ...sh, fields: defaultFields(sh.division, sh.fields) };
}

export function setDoc(patch: Partial<CrestDoc>, key = ''): void {
  commit((doc) => ({ ...doc, ...patch }), key);
}

export function deleteLayer(id: string): void {
  commit((doc) => {
    // символы, привязанные к удаляемому щиту, остаются на месте
    const layers = doc.layers
      .map((l) => (l.kind === 'symbol' && l.slot?.shield === id ? detachSymbol(l, doc) : l))
      .filter((l) => l.id !== id);
    return { ...doc, layers };
  });
  if (state.selected === id) setState({ selected: null, replace: false });
}

export function duplicateLayer(id: string): void {
  const l = findLayer(state.doc, id);
  if (!l) return;
  const copy: Layer = { ...l, id: newId(), x: l.x + 30, y: l.y + 30, locked: false };
  if (copy.kind === 'symbol') {
    const free = freeSlot(state.doc);
    if (copy.slot && free) copy.slot = { shield: free.shield.id, field: free.field };
    else if (copy.slot) Object.assign(copy, detachSymbol(copy, state.doc), { id: copy.id, x: copy.x + 30, y: copy.y + 30 });
  }
  commit((doc) => {
    const i = doc.layers.findIndex((x) => x.id === id);
    const layers = [...doc.layers];
    layers.splice(i + 1, 0, copy);
    return { ...doc, layers };
  });
  setState({ selected: copy.id });
}

export function moveLayer(id: string, dir: -1 | 1 | 'top' | 'bottom'): void {
  commit((doc) => {
    const i = doc.layers.findIndex((l) => l.id === id);
    if (i < 0) return doc;
    const j = dir === 'top' ? doc.layers.length - 1 : dir === 'bottom' ? 0 : i + dir;
    if (j < 0 || j >= doc.layers.length || j === i) return doc;
    const layers = [...doc.layers];
    const [l] = layers.splice(i, 1);
    layers.splice(j, 0, l);
    return { ...doc, layers };
  });
}

/** Добавление нового слоя и выбор его на холсте. */
function addLayer(layer: Layer, where: 'top' | 'bottom' = 'top'): void {
  commit((doc) => ({ ...doc, layers: where === 'top' ? [...doc.layers, layer] : [layer, ...doc.layers] }));
  setState({ selected: layer.id });
}

export function addShield(): void {
  const first = !state.doc.layers.some((l) => l.kind === 'shield');
  addLayer(makeShield('heater', 'whole'), 'bottom');
  // у первого щита символы удобнее сразу привязывать к полям
  if (first) setDoc({ snap: true });
}

export function addSymbol(icon: string): void {
  const doc = state.doc;
  const free = doc.snap ? freeSlot(doc) : null;
  if (free) {
    addLayer(makeSymbol(icon, 0, 0, { slot: { shield: free.shield.id, field: free.field } }));
    return;
  }
  const n = doc.layers.filter((l) => l.kind === 'symbol').length;
  const dx = ((n % 5) - 2) * 36;
  addLayer(makeSymbol(icon, 500 + dx, 560 + dx * 0.4));
}

export function replaceSymbol(id: string, icon: string): void {
  updateLayer(id, { symbol: icon } as Partial<SymbolLayer>);
}

export function addOrnament(id: OrnamentId): void {
  addLayer(makeOrnament(id), ORNAMENTS[id].behind ? 'bottom' : 'top');
}

export function addText(text = t('text.default')): void {
  addLayer(makeText(text));
}

export function updateText(id: string, patch: Partial<TextLayer>, key = ''): void {
  updateLayer(id, patch, key);
}

export function toast(message: string): void {
  setState({ toast: message });
  setTimeout(() => {
    if (state.toast === message) setState({ toast: null });
  }, 2800);
}
