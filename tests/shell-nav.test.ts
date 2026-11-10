import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Nav = typeof import('../src/shell/nav.ts');

let nav: Nav;
const replaceState = vi.fn();

beforeEach(async () => {
  replaceState.mockReset();
  vi.resetModules();
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('history', { replaceState });
  nav = await import('../src/shell/nav.ts');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shell nav: setTool', () => {
  it('switches to a registered tool and writes it to the address', () => {
    expect(nav.getTool()).toBe('my-family');
    nav.setTool('crest');
    expect(nav.getTool()).toBe('crest');
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState.mock.calls[0][2]).toBe('?tool=crest');
  });

  it('ignores a tool id that is not registered: the tool and the address stay as they were', () => {
    // 'genogram' is a valid ToolId but has no tab yet
    nav.setTool('genogram');
    expect(nav.getTool()).toBe('my-family');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('ignores a made-up id without throwing', () => {
    expect(() => nav.setTool('nope' as never)).not.toThrow();
    expect(nav.getTool()).toBe('my-family');
    expect(replaceState).not.toHaveBeenCalled();
  });
});
