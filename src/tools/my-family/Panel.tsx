import { useId } from 'preact/hooks';
import { contrast } from '../../model/colors.ts';
import { patternGeometry } from '../../render/patterns.ts';
import { useDocStore } from '../../core/useDocStore.ts';
import { t } from '../../i18n/index.ts';
import type { Key } from '../../i18n/ru.ts';
import { COLORS, SIZE_MAX, SIZE_MIN, TEXTURES, type Figure, type FigureKind, type TextureId } from './model.ts';
import { add, duplicate, move, patch, remove, step, store, useUi } from './store.ts';

const SHAPES: { kind: FigureKind; label: Key; icon: string }[] = [
  { kind: 'circle', label: 'mf.shape.circle', icon: '<circle cx="20" cy="20" r="14"/>' },
  { kind: 'square', label: 'mf.shape.square', icon: '<rect x="7" y="7" width="26" height="26"/>' },
  { kind: 'rect', label: 'mf.shape.rect', icon: '<rect x="4" y="11" width="32" height="18"/>' },
  { kind: 'triangle', label: 'mf.shape.triangle', icon: '<path d="M20 6 35 33H5z" stroke-linejoin="round"/>' },
];

const ORDER: { dir: 'up' | 'down' | 'top' | 'bottom'; label: Key }[] = [
  { dir: 'up', label: 'mf.up' },
  { dir: 'down', label: 'mf.down' },
  { dir: 'top', label: 'mf.front' },
  { dir: 'bottom', label: 'mf.back' },
];

const colorName = (hex: string): string => t(`mf.color.${hex.slice(1)}` as Key);
const textureName = (id: TextureId | null): string => t(`mf.texture.${id ?? 'none'}` as Key);

function Range(props: { label: string; value: number; min: number; max: number; step: number; unit?: string; onInput(v: number): void }) {
  const id = useId();
  return (
    <div class="field">
      <label class="field-label" for={id}>
        {props.label}: <span class="value">{Math.round(props.value)}{props.unit ?? ''}</span>
      </label>
      <input id={id} type="range" min={props.min} max={props.max} step={props.step} value={props.value} onInput={(e) => props.onInput(Number((e.target as HTMLInputElement).value))} />
    </div>
  );
}

/** A small tile in the figure's own colour with the texture on it. */
function TexturePreview({ texture, color }: { texture: TextureId | null; color: string }) {
  const g = texture ? patternGeometry(texture) : null;
  const ink = contrast(color);
  return (
    <svg class="mf-texture-preview" viewBox="-110 -110 220 220" aria-hidden="true">
      <rect x="-110" y="-110" width="220" height="220" fill={color} />
      {g && (g.stroke ? <path d={g.d} fill="none" stroke={ink} stroke-width={g.stroke} stroke-linecap="round" /> : <path d={g.d} fill={ink} />)}
    </svg>
  );
}

function Properties({ fig }: { fig: Figure }) {
  const id = fig.id; // taken from the current selection at every render, never kept from an earlier one
  return (
    <section class="mf-props" role="group" aria-label={t('mf.panel')}>
      <h2 class="mf-panel-title">{t('mf.panel')}</h2>

      <div class="field">
        <span class="field-label" id="mf-color-label">{t('mf.color')}</span>
        <div class="mf-swatches" role="group" aria-labelledby="mf-color-label">
          {COLORS.map((c) => (
            <button key={c} type="button" class="mf-swatch" style={`background:${c}`} aria-label={colorName(c)} title={colorName(c)} aria-pressed={fig.color === c} onClick={() => patch(id, { color: c })}>
              {fig.color === c && (
                <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke={contrast(c)} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 10.5l3.5 3.5L15 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      <Range label={t('mf.size')} value={fig.size} min={SIZE_MIN} max={SIZE_MAX} step={1} onInput={(v) => patch(id, { size: v }, 'size:' + id)} />
      <Range label={t('mf.rotation')} value={fig.rotation} min={0} max={345} step={15} unit="°" onInput={(v) => patch(id, { rotation: v }, 'rot:' + id)} />

      <div class="field">
        <span class="field-label" id="mf-texture-label">{t('mf.texture')}</span>
        <div class="mf-textures" role="group" aria-labelledby="mf-texture-label">
          {[null, ...TEXTURES].map((tx) => (
            <button key={tx ?? 'none'} type="button" class="mf-texture" aria-pressed={fig.texture === tx} onClick={() => patch(id, { texture: tx })}>
              <TexturePreview texture={tx} color={fig.color} />
              <span>{textureName(tx)}</span>
            </button>
          ))}
        </div>
      </div>

      <div class="mf-order">
        {ORDER.map((o) => (
          <button key={o.dir} type="button" class="btn" onClick={() => move(id, o.dir)}>{t(o.label)}</button>
        ))}
      </div>
      <div class="row mf-actions">
        <button type="button" class="btn grow" onClick={() => duplicate(id)}>{t('mf.duplicate')}</button>
        <button type="button" class="btn danger grow" onClick={() => remove(id)}>{t('mf.delete')}</button>
      </div>
    </section>
  );
}

export function Panel() {
  const doc = useDocStore(store, (s) => s.doc);
  const selected = useUi((u) => u.selected);
  const fig = selected === null ? undefined : doc.figures.find((f) => f.id === selected);
  const count = doc.figures.length;
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
      {fig && <Properties fig={fig} />}
    </aside>
  );
}
