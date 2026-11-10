import { t } from '../i18n/index.ts';
import { eraseAuto } from '../model/serialize.ts';
import { resetDoc } from '../model/store.ts';
import { App } from '../ui/App.tsx';
import { MyFamily } from '../tools/my-family/MyFamily.tsx';
import { clearData as clearMyFamily } from '../tools/my-family/store.ts';
import type { ToolDef } from './types.ts';

/** Registered tools, in the order of TOOL_IDS. */
export const TOOLS: ToolDef[] = [
  { id: 'my-family', title: () => t('tool.my-family'), Component: MyFamily, clearData: clearMyFamily },
  {
    id: 'crest',
    title: () => t('tool.crest'),
    Component: App,
    clearData() {
      try {
        eraseAuto();
      } finally {
        resetDoc(); // also when erasing failed: no pending autosave may fire, the start screen reads the storage again
      }
    },
  },
];
