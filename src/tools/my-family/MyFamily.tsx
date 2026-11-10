import { useEffect } from 'preact/hooks';
import { useDocStore } from '../../core/useDocStore.ts';
import { t, useLang } from '../../i18n/index.ts';
import { FileMenu } from './FileMenu.tsx';
import { Panel } from './Panel.tsx';
import { Sheet } from './Sheet.tsx';
import { shortcutOf } from './shortcuts.ts';
import { getUi, patch, redo, remove, select, store, undo, useUi } from './store.ts';

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Text fields keep their keys. A slider is not a text field: it only keeps the arrows.
      const field = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]');
      const slider = field instanceof HTMLInputElement && field.type === 'range';
      if (field && !slider) return;
      const mod = e.ctrlKey || e.metaKey;
      const action = shortcutOf(e);
      if (action) {
        e.preventDefault();
        if (action === 'undo') undo();
        else redo();
        return;
      }
      if (mod || e.altKey) return;
      const id = getUi().selected;
      if (e.key === 'Escape') {
        select(null);
        return;
      }
      const fig = id === null ? undefined : store.get().doc.figures.find((f) => f.id === id);
      if (!fig) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove(fig.id);
      } else if (e.key in ARROWS && !slider) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const [dx, dy] = ARROWS[e.key];
        patch(fig.id, { x: fig.x + dx * step, y: fig.y + dy * step }, 'nudge:' + fig.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function MyFamily() {
  useLang(); // texts are taken again when the language changes
  useShortcuts();
  const empty = useDocStore(store, (s) => s.doc.figures.length === 0);
  const canUndo = useDocStore(store, (s) => s.past.length > 0);
  const canRedo = useDocStore(store, (s) => s.future.length > 0);
  const toast = useUi((u) => u.toast);
  return (
    <div class="mf">
      <div class="mf-bar">
        <button type="button" class="btn" onClick={undo} disabled={!canUndo} title={t('header.undoTitle')}>{t('header.undo')}</button>
        <button type="button" class="btn" onClick={redo} disabled={!canRedo} title={t('header.redoTitle')}>{t('header.redo')}</button>
        <div class="mf-file">
          <FileMenu />
        </div>
      </div>
      <main class="mf-stage">
        <Sheet />
        {empty && <p class="mf-hint">{t('mf.hint')}</p>}
      </main>
      <Panel />
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}
