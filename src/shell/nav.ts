import { useEffect, useState } from 'preact/hooks';
import { resolveRoute, toolUrl } from './route.ts';
import { TOOLS } from './tools.ts';
import type { ToolId } from './types.ts';

const ids = TOOLS.map((tool) => tool.id);
let current: ToolId = resolveRoute(typeof location === 'undefined' ? '' : location.search, ids).tool;
const listeners = new Set<() => void>();

export const getTool = (): ToolId => current;

/** Switches the current tool and records it in the address without adding a history entry. */
export function setTool(id: ToolId): void {
  if (id === current) return;
  current = id;
  try {
    history.replaceState(null, '', toolUrl(location.search, id));
  } catch {
    /* the address stays as it was; the tool still switches */
  }
  listeners.forEach((l) => l());
}

/** Current tool for a component: it re-renders when the tool changes. */
export function useTool(): ToolId {
  const [value, setValue] = useState(current);
  useEffect(() => {
    const on = () => setValue(current);
    listeners.add(on);
    on();
    return () => {
      listeners.delete(on);
    };
  }, []);
  return value;
}
