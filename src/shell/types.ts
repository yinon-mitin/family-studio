import type { FunctionComponent } from 'preact';

export type ToolId = 'genogram' | 'my-family' | 'crest';
export const TOOL_IDS: readonly ToolId[] = ['genogram', 'my-family', 'crest'];

export interface ToolDef {
  id: ToolId;
  /** Tab title in the current language. */
  title(): string;
  Component: FunctionComponent;
  /** Erases everything the tool stores on the device. */
  clearData(): void;
}
