import { useEffect } from 'preact/hooks';
import { t, useLang } from '../i18n/index.ts';
import { useTool } from './nav.ts';
import { resolveRoute } from './route.ts';
import { ToolBar } from './ToolBar.tsx';
import { TOOLS } from './tools.ts';

export function Shell() {
  const tool = useTool();
  const lang = useLang();
  const def = TOOLS.find((d) => d.id === tool) ?? TOOLS[0];
  const { showTabs } = resolveRoute(location.search, TOOLS.map((d) => d.id));
  // Runs after setLang's own applyDocumentLang, so this title wins.
  useEffect(() => {
    document.title = `${def.title()} — ${t('shell.title')}`;
  }, [lang, def]);
  const Tool = def.Component;
  return (
    <div class="shell">
      <ToolBar tool={def.id} showTabs={showTabs} />
      <div class="shell-body">
        <Tool />
      </div>
    </div>
  );
}
