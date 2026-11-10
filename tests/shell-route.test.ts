import { describe, expect, it } from 'vitest';
import { resolveRoute, toolUrl } from '../src/shell/route';
import type { ToolId } from '../src/shell/types';

const two: ToolId[] = ['my-family', 'crest'];

describe('resolveRoute', () => {
  it('picks the first available tool by default', () => {
    expect(resolveRoute('', two)).toEqual({ tool: 'my-family', showTabs: true });
  });
  it('honours ?tool=', () => {
    expect(resolveRoute('?tool=crest', two)).toEqual({ tool: 'crest', showTabs: true });
  });
  it('falls back to the first tool on unknown ?tool=', () => {
    expect(resolveRoute('?tool=nope', two)).toEqual({ tool: 'my-family', showTabs: true });
  });
  it('falls back when the tool is valid but not registered', () => {
    expect(resolveRoute('?tool=genogram', two)).toEqual({ tool: 'my-family', showTabs: true });
  });
  it('?only= selects the tool and hides tabs', () => {
    expect(resolveRoute('?only=crest', two)).toEqual({ tool: 'crest', showTabs: false });
  });
  it('?only= wins over ?tool=', () => {
    expect(resolveRoute('?only=crest&tool=my-family', two)).toEqual({ tool: 'crest', showTabs: false });
  });
  it('ignores unknown ?only=', () => {
    expect(resolveRoute('?only=nope', two)).toEqual({ tool: 'my-family', showTabs: true });
  });
  it('hides tabs when only one tool is available', () => {
    expect(resolveRoute('', ['crest'])).toEqual({ tool: 'crest', showTabs: false });
  });
  it('takes the first value of a repeated ?tool=', () => {
    expect(resolveRoute('?tool=crest&tool=my-family', two)).toEqual({ tool: 'crest', showTabs: true });
  });
  it('throws on an empty available list', () => {
    expect(() => resolveRoute('', [])).toThrow(Error);
  });
});

describe('toolUrl', () => {
  it('appends tool to existing params', () => {
    expect(toolUrl('?lang=en', 'crest')).toBe('?lang=en&tool=crest');
  });
  it('removes only', () => {
    expect(toolUrl('?lang=en&only=crest', 'my-family')).toBe('?lang=en&tool=my-family');
  });
  it('works from an empty search', () => {
    expect(toolUrl('', 'crest')).toBe('?tool=crest');
  });
});
