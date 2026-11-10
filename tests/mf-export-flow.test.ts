import { describe, expect, it, vi } from 'vitest';
import { addFigure, newDoc, type MyFamilyDoc } from '../src/tools/my-family/model.ts';
import { runExport } from '../src/tools/my-family/exportFlow.ts';

const withFigure = (): MyFamilyDoc => addFigure(newDoc('portrait'), 'circle').doc;
const empty = (): MyFamilyDoc => newDoc('portrait');
const blob = new Blob(['x']);

function setup(over: Partial<Parameters<typeof runExport>[0]> = {}) {
  const save = vi.fn();
  const render = vi.fn(async () => blob);
  const opts = { format: 'png' as const, getDoc: withFigure, alive: () => true, render, save, ...over };
  return { opts, save, render };
}

describe('runExport', () => {
  it('renders the current document and saves the result', async () => {
    const { opts, save, render } = setup();
    expect(await runExport(opts)).toBe('done');
    expect(render).toHaveBeenCalledWith('png', expect.objectContaining({ figures: expect.any(Array) }));
    expect(save).toHaveBeenCalledWith(blob, 'png');
  });

  it('reads the document at the moment of the call, and does nothing when it is empty by then', async () => {
    const { opts, save, render } = setup({ getDoc: empty });
    expect(await runExport(opts)).toBe('empty');
    expect(render).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not save when the dialog was closed while the file was being made', async () => {
    let open = true;
    const { opts, save } = setup({
      render: async () => {
        open = false; // the user closes the dialog during the render
        return blob;
      },
      alive: () => open,
    });
    expect(await runExport(opts)).toBe('cancelled');
    expect(save).not.toHaveBeenCalled();
  });

  it('lets a render failure through to the caller', async () => {
    const { opts, save } = setup({
      render: async () => {
        throw new Error('boom');
      },
    });
    await expect(runExport(opts)).rejects.toThrow('boom');
    expect(save).not.toHaveBeenCalled();
  });
});
