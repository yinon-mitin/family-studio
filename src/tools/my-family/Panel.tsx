import { useDocStore } from '../../core/useDocStore.ts';
import { t } from '../../i18n/index.ts';
import type { Key } from '../../i18n/ru.ts';
import type { FigureKind } from './model.ts';
import { add, step, store } from './store.ts';

const SHAPES: { kind: FigureKind; label: Key; icon: string }[] = [
  { kind: 'circle', label: 'mf.shape.circle', icon: '<circle cx="20" cy="20" r="14"/>' },
  { kind: 'square', label: 'mf.shape.square', icon: '<rect x="7" y="7" width="26" height="26"/>' },
  { kind: 'rect', label: 'mf.shape.rect', icon: '<rect x="4" y="11" width="32" height="18"/>' },
  { kind: 'triangle', label: 'mf.shape.triangle', icon: '<path d="M20 6 35 33H5z" stroke-linejoin="round"/>' },
];

export function Panel() {
  const count = useDocStore(store, (s) => s.doc.figures.length);
  return (
    <aside class="mf-panel">
      <h2 class="mf-panel-title">{t('mf.add')}</h2>
      <div class="mf-shapes">
        {SHAPES.map((s) => (
          <button key={s.kind} type="button" class="mf-shape" onClick={() => add(s.kind)}>
            <svg viewBox="0 0 40 40" aria-hidden="true" fill="#42a5f5" stroke="#1c1c24" stroke-width="2.5" dangerouslySetInnerHTML={{ __html: s.icon }} />
            <span>{t(s.label)}</span>
          </button>
        ))}
      </div>
      <div class="row mf-step">
        <button type="button" class="btn grow" disabled={count === 0} onClick={() => step(-1)}>{t('mf.prev')}</button>
        <button type="button" class="btn grow" disabled={count === 0} onClick={() => step(1)}>{t('mf.next')}</button>
      </div>
    </aside>
  );
}
