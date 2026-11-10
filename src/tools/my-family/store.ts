/** The My Family store: the document with its history, the selection and the toast. Importable in plain Node (no DOM access at import beyond a guarded window check). */
import { useEffect, useState } from 'preact/hooks';
import { createDocStore } from '../../core/docStore.ts';
import { addFigure, deleteFigure, duplicateFigure, neighbour, newDoc, reorder, updateFigure, type FigureKind, type MyFamilyDoc } from './model.ts';
import { clearAuto, loadAuto, saveAuto } from './persist.ts';
import { pickOrientation, type Orientation } from './sheet.ts';

const SAVE_DELAY_MS = 400;
const TOAST_MS = 2800;

const hasWindow = (): boolean => typeof window !== 'undefined';

function currentOrientation(): Orientation {
  return hasWindow() ? pickOrientation(window.innerWidth, window.innerHeight) : 'portrait';
}

// ---------- document ----------

let saveTimer: ReturnType<typeof setTimeout> | undefined;
// While true, document changes do not schedule an autosave (erasing data must not write anything back).
let quiet = false;

function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    const doc = store.get().doc;
    // An empty drawing is never stored: it would only replace a real one with nothing.
    if (doc.figures.length > 0) saveAuto(doc);
    else clearAuto();
  }, SAVE_DELAY_MS);
}

export const store = createDocStore<MyFamilyDoc>({
  initial: (hasWindow() ? loadAuto() : null) ?? newDoc(currentOrientation()),
  onChange: () => {
    if (!quiet) scheduleSave();
  },
});

// ---------- selection and toast ----------

export interface Ui {
  selected: string | null;
  toast: string | null;
}

let ui: Ui = { selected: null, toast: null };
const listeners = new Set<() => void>();

export const getUi = (): Ui => ui;

function setUi(patch: Partial<Ui>): void {
  ui = { ...ui, ...patch };
  listeners.forEach((l) => l());
}

/** `select` must not close over changing values: it is captured when the component mounts. */
export function useUi<T>(select: (u: Ui) => T): T {
  const [value, setValue] = useState(() => select(ui));
  useEffect(() => {
    const check = () => setValue(() => select(ui));
    listeners.add(check);
    check();
    return () => {
      listeners.delete(check);
    };
  }, []);
  return value;
}

// A removed figure (delete, undo of an add, a new drawing) cannot stay selected.
store.subscribe(() => {
  const id = ui.selected;
  if (id !== null && !store.get().doc.figures.some((f) => f.id === id)) setUi({ selected: null });
});

export const select = (id: string | null): void => setUi({ selected: id });

let toastSeq = 0;
export function toast(message: string): void {
  const mine = ++toastSeq;
  setUi({ toast: message });
  setTimeout(() => {
    if (toastSeq === mine) setUi({ toast: null });
  }, TOAST_MS);
}

// ---------- actions ----------

export function add(kind: FigureKind): void {
  let id = '';
  store.commit((doc) => {
    const r = addFigure(doc, kind);
    id = r.id;
    return r.doc;
  });
  if (id) select(id);
}

export function patch(id: string, p: Parameters<typeof updateFigure>[2], key?: string): void {
  store.commit((doc) => updateFigure(doc, id, p), key);
}

export function remove(id: string): void {
  store.commit((doc) => deleteFigure(doc, id));
}

export function duplicate(id: string): void {
  let copy = '';
  store.commit((doc) => {
    const r = duplicateFigure(doc, id);
    copy = r.id;
    return r.doc;
  });
  if (copy) select(copy);
}

export function move(id: string, dir: 'up' | 'down' | 'top' | 'bottom'): void {
  store.commit((doc) => reorder(doc, id, dir));
}

/** Selects the next (1) or previous (-1) figure in layer order. */
export function step(dir: 1 | -1): void {
  const id = neighbour(store.get().doc, ui.selected, dir);
  if (id !== null) select(id);
}

export const undo = (): void => store.undo();
export const redo = (): void => store.redo();

/** An empty sheet in the orientation that suits the screen now; the history starts over. */
export function newDrawing(): void {
  store.replace(newDoc(currentOrientation()));
  setUi({ selected: null });
}

/** Erases the stored drawing and starts an empty one without writing anything back. */
export function clearData(): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  clearAuto();
  quiet = true;
  try {
    store.replace(newDoc(currentOrientation()));
  } finally {
    quiet = false;
  }
  setUi({ selected: null });
}
