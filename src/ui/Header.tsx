import { goStart, redo, setDoc, setState, undo, useStore } from '../model/store.ts';
import { t } from '../i18n/index.ts';
import { pickFile, saveFile, wipe } from './files.ts';

export function Header() {
  const family = useStore((s) => s.doc.family);
  const close = (e: Event) => ((e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
  return (
    <header class="topbar">
      <button type="button" class="brand" onClick={goStart} title={t('header.brandTitle')}>
        <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 8h44v26c0 12-10 19-22 24C20 53 10 46 10 34z" fill="currentColor" /><path d="M32 14v38M14 28h36" stroke="#e0b44c" stroke-width="4" /></svg>
        <span>{t('app.title')}</span>
      </button>
      <label class="family">
        <span class="sr">{t('header.familyLabel')}</span>
        <input type="text" maxLength={60} placeholder={t('header.familyPlaceholder')} value={family} onInput={(e) => setDoc({ family: (e.target as HTMLInputElement).value }, 'family')} />
      </label>
      <details class="menu">
        <summary class="btn">{t('header.file')}</summary>
        <div class="menu-list" onClick={close}>
          <button type="button" onClick={goStart}>{t('header.new')}</button>
          <button type="button" onClick={saveFile}>{t('header.save')}</button>
          <button type="button" onClick={pickFile}>{t('header.open')}</button>
          <button type="button" onClick={() => setState({ dialog: 'about' })}>{t('header.about')}</button>
          <button type="button" class="danger" onClick={() => void wipe()}>{t('header.wipe')}</button>
        </div>
      </details>
      <button type="button" class="btn primary" onClick={() => setState({ dialog: 'export' })}>{t('header.download')}</button>
    </header>
  );
}

export function StageBar() {
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  return (
    <div class="stagebar">
      <button type="button" class="btn" onClick={undo} disabled={!past} title={t('header.undoTitle')}>{t('header.undo')}</button>
      <button type="button" class="btn" onClick={redo} disabled={!future} title={t('header.redoTitle')}>{t('header.redo')}</button>
    </div>
  );
}
