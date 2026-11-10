import { useEffect, useState } from 'preact/hooks';
import { loadSymbols, symbolsLoaded } from '../data/symbols.ts';
import { t, useLang } from '../i18n/index.ts';
import { fontsReady, loadFontsBrowser } from '../render/fonts.ts';
import { App } from './App.tsx';

type Status = 'loading' | 'ready' | 'failed';

const ready = (): boolean => symbolsLoaded() && fontsReady();

/** The crest tool: its symbols and text fonts are loaded when it is first shown, not when the site opens. */
export function CrestTool() {
  useLang();
  const [status, setStatus] = useState<Status>(ready() ? 'ready' : 'loading');
  useEffect(() => {
    if (status !== 'loading') return;
    let alive = true;
    Promise.all([loadFontsBrowser(), loadSymbols()]).then(
      () => alive && setStatus('ready'),
      (e) => {
        console.error(e);
        if (alive) setStatus('failed');
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  if (status === 'ready') return <App />;
  return <p class="tool-note" role={status === 'failed' ? 'alert' : 'status'}>{t(status === 'failed' ? 'app.loadFailed' : 'app.loading')}</p>;
}
