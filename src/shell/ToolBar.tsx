import { t } from '../i18n/index.ts';
import { LangSwitch } from '../ui/LangSwitch.tsx';
import { setTool } from './nav.ts';
import { TOOLS } from './tools.ts';
import type { ToolId } from './types.ts';

export function ToolBar({ tool, showTabs }: { tool: ToolId; showTabs: boolean }) {
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
      <LangSwitch />
    </div>
  );
}
