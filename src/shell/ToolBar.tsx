import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/index.ts';
import { LangSwitch } from '../ui/LangSwitch.tsx';
import { Modal } from '../ui/Modal.tsx';
import { useMenuDismiss } from '../ui/useMenuDismiss.ts';
import { setTool } from './nav.ts';
import { TOOLS } from './tools.ts';
import type { ToolId } from './types.ts';
import { wipeAll } from './wipeAll.ts';
import { WIPE_TARGETS, wipeTargetName } from './wipeTargets.ts';

/** What the last erase came to: nothing yet, done, or the ids that could not be erased. */
type WipeResult = null | { failed: string[] };

const DONE_MS = 4000;

const closeMenu = (e: Event) => ((e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');

export function ToolBar({ tool, showTabs }: { tool: ToolId; showTabs: boolean }) {
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<WipeResult>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  useMenuDismiss(menu);

  // Success fades away by itself; a failure stays until it is closed, since it asks the person to do something.
  useEffect(() => {
    if (!result || result.failed.length > 0) return;
    const timer = setTimeout(() => setResult(null), DONE_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const erase = () => {
    setAsking(false);
    setResult({ failed: wipeAll(WIPE_TARGETS).failures.map((f) => f.id) });
  };

  return (
    <div class="shell-bar">
      <span class="shell-brand">{t('shell.title')}</span>
      {showTabs && (
        <nav class="shell-tabs" aria-label={t('shell.tools')}>
          {TOOLS.map((def) => (
            <button key={def.id} type="button" class={def.id === tool ? 'on' : ''} aria-current={def.id === tool ? 'page' : undefined} onClick={() => setTool(def.id)}>
              {def.title()}
            </button>
          ))}
        </nav>
      )}
      <details class="menu" ref={menu}>
        <summary>{t('shell.data')}</summary>
        <div class="menu-list" onClick={closeMenu}>
          <button type="button" class="danger" onClick={() => setAsking(true)}>{t('shell.wipeAll')}</button>
        </div>
      </details>
      <LangSwitch />
      {asking && (
        <Modal title={t('shell.wipeAll')} onClose={() => setAsking(false)}>
          <p>{t('shell.wipeAllAsk')}</p>
          <div class="row end">
            <button type="button" class="btn" onClick={() => setAsking(false)}>{t('shell.wipeCancel')}</button>
            <button type="button" class="btn danger" onClick={erase}>{t('shell.wipeDo')}</button>
          </div>
        </Modal>
      )}
      {result && (
        <div class={`toast shell-toast${result.failed.length > 0 ? ' fail' : ''}`} role="status">
          <span>{result.failed.length > 0 ? t('shell.wipeFailed', { names: result.failed.map(wipeTargetName).join(', ') }) : t('shell.wipeDone')}</span>
          {result.failed.length > 0 && (
            <button type="button" class="mini" aria-label={t('modal.close')} onClick={() => setResult(null)}>✕</button>
          )}
        </div>
      )}
    </div>
  );
}
