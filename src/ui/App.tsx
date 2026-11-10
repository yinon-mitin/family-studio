import { Fragment } from 'preact';
import { useLang } from '../i18n/index.ts';
import { useStore } from '../model/store.ts';
import { Editor } from './Editor.tsx';
import { Start } from './Start.tsx';

export function App() {
  const screen = useStore((s) => s.screen);
  const toast = useStore((s) => s.toast);
  const resetSeq = useStore((s) => s.resetSeq);
  // При смене языка экран собирается заново: тексты, подписи шаблонов и подсказки берутся уже на новом языке.
  const lang = useLang();
  return (
    <Fragment key={lang}>
      {screen === 'start' ? <Start key={resetSeq} /> : <Editor />}
      {screen === 'start' && toast && <div class="toast" role="status">{toast}</div>}
    </Fragment>
  );
}
