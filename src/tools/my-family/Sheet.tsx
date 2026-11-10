import { useMemo, useRef } from 'preact/hooks';
import { useDocStore } from '../../core/useDocStore.ts';
import { t } from '../../i18n/index.ts';
import { renderSheet } from './render.ts';
import { sheetSize } from './sheet.ts';
import { patch, select, store, useUi } from './store.ts';

const OUTER_SVG = /^<svg[^>]*>([\s\S]*)<\/svg>$/;

interface Drag {
  id: string;
  pointerId: number;
  /** Merge key of this gesture: a new gesture never joins the undo step of an earlier one. */
  key: string;
  /** Figure centre minus the grabbed point, in sheet units: the figure does not jump under the finger. */
  dx: number;
  dy: number;
}

function toSheet(svg: SVGSVGElement, e: PointerEvent): { x: number; y: number } | null {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
}

let gestures = 0;

export function Sheet() {
  const doc = useDocStore(store, (s) => s.doc);
  const selected = useUi((u) => u.selected);
  const drag = useRef<Drag | null>(null);
  const { w, h } = sheetSize(doc.orientation);
  // The render output is a whole <svg>; the sheet element owns the viewBox, so only its content is used.
  const inner = useMemo(() => OUTER_SVG.exec(renderSheet(doc, { frame: true, selected, prefix: 'ed-' }))?.[1] ?? '', [doc, selected]);

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (drag.current && drag.current.pointerId !== e.pointerId) {
      if (!e.isPrimary) return; // a second finger during a drag does nothing
      drag.current = null; // a new primary pointer: the earlier gesture lost its end event
    }
    const svg = e.currentTarget as SVGSVGElement;
    const id = (e.target as Element).closest('[data-fig]')?.getAttribute('data-fig');
    const fig = id ? store.get().doc.figures.find((f) => f.id === id) : undefined;
    if (!fig) {
      drag.current = null;
      select(null);
      return;
    }
    select(fig.id);
    const p = toSheet(svg, e);
    if (!p) return;
    drag.current = { id: fig.id, pointerId: e.pointerId, key: `drag:${fig.id}:${++gestures}`, dx: fig.x - p.x, dy: fig.y - p.y };
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* the gesture still works while the pointer stays over the sheet */
    }
  };

  const onMove = (e: PointerEvent) => {
    const g = drag.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const p = toSheet(e.currentTarget as SVGSVGElement, e);
    if (p) patch(g.id, { x: p.x + g.dx, y: p.y + g.dy }, g.key);
  };

  const onEnd = (e: PointerEvent) => {
    const g = drag.current;
    if (!g || g.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <svg
      class="mf-sheet"
      role="group"
      aria-label={t('mf.sheet')}
      viewBox={`0 0 ${w} ${h}`}
      style={`aspect-ratio: ${w} / ${h}; width: min(100cqw, calc(100cqh * ${w / h}))`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onLostPointerCapture={onEnd}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
