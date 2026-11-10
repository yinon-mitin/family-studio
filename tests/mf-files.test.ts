import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, readDrawingFile } from '../src/tools/my-family/files.ts';
import { addFigure, newDoc } from '../src/tools/my-family/model.ts';
import { toFile } from '../src/tools/my-family/persist.ts';

const fileOf = (text: string, size = text.length) => ({ size, text: async () => text });

describe('readDrawingFile', () => {
  it('limits files to 5 MB', () => {
    expect(MAX_FILE_BYTES).toBe(5_000_000);
  });

  it('returns the drawing of a valid project file, orientation included', async () => {
    const doc = addFigure(newDoc('landscape'), 'circle').doc;
    const r = await readDrawingFile(fileOf(toFile(doc)));
    expect(r).toEqual({ doc });
  });

  it('rejects a file over the limit without reading it', async () => {
    let read = false;
    const r = await readDrawingFile({ size: MAX_FILE_BYTES + 1, text: async () => ((read = true), '') });
    expect(r).toEqual({ error: 'tooLarge' });
    expect(read).toBe(false);
  });

  it('accepts a file of exactly the limit size to the parser', async () => {
    const r = await readDrawingFile(fileOf('{}', MAX_FILE_BYTES));
    expect(r).toEqual({ error: 'notProject' });
  });

  it.each([
    ['a crest file', JSON.stringify({ app: 'family-crest', version: 1, doc: {} })],
    ['not JSON', '{ nope'],
    ['an empty file', ''],
    ['an array', '[]'],
  ])('rejects %s as not a project', async (_n, text) => {
    expect(await readDrawingFile(fileOf(text))).toEqual({ error: 'notProject' });
  });

  it('treats a failing read as not a project', async () => {
    const r = await readDrawingFile({
      size: 3,
      text: async () => {
        throw new Error('read failed');
      },
    });
    expect(r).toEqual({ error: 'notProject' });
  });
});
