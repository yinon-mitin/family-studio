import { eraseLang, t } from '../i18n/index.ts';
import { TOOLS } from './tools.ts';
import type { WipeTarget } from './wipeAll.ts';

/** Everything "Erase all my data" removes: each tool's drawing and the remembered language. */
export const WIPE_TARGETS: WipeTarget[] = [...TOOLS.map((def) => ({ id: def.id, clearData: def.clearData })), { id: 'lang', clearData: eraseLang }];

/** Name of a target in the current language, for the message about what could not be erased. */
export function wipeTargetName(id: string): string {
  return TOOLS.find((def) => def.id === id)?.title() ?? (id === 'lang' ? t('shell.wipeLang') : id);
}
