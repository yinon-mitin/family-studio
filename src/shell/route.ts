import { TOOL_IDS, type ToolId } from './types';

export interface Route {
  tool: ToolId;
  showTabs: boolean;
}

function pick(value: string | null, available: ToolId[]): ToolId | null {
  return available.find((id) => id === value) ?? null;
}

export function resolveRoute(search: string, available: ToolId[]): Route {
  if (available.length === 0) throw new Error('resolveRoute: no tools available');
  const params = new URLSearchParams(search);
  const only = pick(params.get('only'), available);
  if (only) return { tool: only, showTabs: false };
  const tool = pick(params.get('tool'), available) ?? available[0];
  return { tool, showTabs: available.length > 1 };
}

export function toolUrl(search: string, tool: ToolId): string {
  if (!TOOL_IDS.includes(tool)) throw new Error(`toolUrl: unknown tool ${tool}`);
  const params = new URLSearchParams(search);
  params.delete('only');
  params.set('tool', tool);
  return `?${params.toString()}`;
}
