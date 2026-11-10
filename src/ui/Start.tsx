import { useMemo } from 'preact/hooks';
import { emptyDoc } from '../model/doc.ts';
import { loadAuto } from '../model/serialize.ts';
import { openDoc, setState } from '../model/store.ts';
import { TEMPLATES } from '../model/templates.ts';
import { pick, t } from '../i18n/index.ts';
import { renderCrest } from '../render/renderCrest.ts';
import { About } from './About.tsx';
import { pickFile, wipe } from './files.ts';
import { useStore } from '../model/store.ts';

export function Start() {
  const dialog = useStore((s) => s.dialog);
  const saved = useMemo(() => {
    const d = loadAuto();
    return d && d.layers.length ? d : null;
  }, []);
  const cards = useMemo(() => TEMPLATES.map((t) => ({ t, svg: renderCrest(t.make(), { prefix: `t-${t.id}-` }) })), []);
  const savedSvg = useMemo(() => (saved ? renderCrest(saved, { prefix: 'saved-' }) : ''), [saved]);

  return (
    <div class="start">
      <header class="hero">
        <svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 8h44v26c0 12-10 19-22 24C20 53 10 46 10 34z" fill="currentColor" /><path d="M32 14v38M14 28h36" stroke="#e0b44c" stroke-width="4" /></svg>
        <h1>{t('app.title')}</h1>
        <p>{t('start.lead')}</p>
      </header>

      <section aria-labelledby="start-h">
        <h2 id="start-h">{t('start.heading')}</h2>
        <div class="cards">
          {saved && (
            <button type="button" class="card-btn saved" onClick={() => openDoc(saved)}>
              <div class="thumb-box" dangerouslySetInnerHTML={{ __html: savedSvg }} />
              <b>{t('start.continue')}</b>
              <span>{t('start.continueNote')}</span>
            </button>
          )}
          <button type="button" class="card-btn blank" onClick={() => openDoc(emptyDoc())}>
            <div class="thumb-box blank-box" aria-hidden="true"><span>+</span></div>
            <b>{t('start.blank')}</b>
            <span>{t('start.blankNote')}</span>
          </button>
          {cards.map(({ t: tpl, svg }) => (
            <button key={tpl.id} type="button" class="card-btn" onClick={() => openDoc(tpl.make())}>
              <div class="thumb-box" dangerouslySetInnerHTML={{ __html: svg }} />
              <b>{pick(tpl.name)}</b>
              <span>{pick(tpl.description)}</span>
            </button>
          ))}
        </div>
        {saved && <p class="hint center">{t('start.replaceNote')}</p>}
      </section>

      <footer class="start-foot">
        <button type="button" class="btn" onClick={pickFile}>{t('start.openFile')}</button>
        <button type="button" class="btn" onClick={() => setState({ dialog: 'about' })}>{t('start.about')}</button>
        <button type="button" class="btn danger" onClick={() => void wipe()}>{t('start.wipe')}</button>
      </footer>
      {dialog === 'about' && <About onClose={() => setState({ dialog: null })} />}
    </div>
  );
}
