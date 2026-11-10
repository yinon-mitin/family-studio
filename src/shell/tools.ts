import { t } from '../i18n/index.ts';
import { emptyDoc } from '../model/doc.ts';
import { clearAuto } from '../model/serialize.ts';
import { setState } from '../model/store.ts';
import { App } from '../ui/App.tsx';
import type { ToolDef } from './types.ts';

/** Registered tools, in the order of TOOL_IDS. */
export const TOOLS: ToolDef[] = [
  {
    id: 'crest',
    title: () => t('tool.crest'),
    Component: App,
    clearData() {
      clearAuto();
      // Not openDoc(): it schedules an autosave that would write an empty document back into the key just cleared.
      setState({ doc: emptyDoc(), past: [], future: [], selected: null, screen: 'start', dialog: null });
    },
  },
];
