import type { ToolDef } from './types';

/** Erases every tool's data; one failing tool must not stop the rest. */
export function wipeAll(tools: Pick<ToolDef, 'clearData'>[]): { failed: number } {
  let failed = 0;
  for (const tool of tools) {
    try {
      tool.clearData();
    } catch {
      failed += 1;
    }
  }
  return { failed };
}
