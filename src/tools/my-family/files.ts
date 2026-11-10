/** Reading a project file. Pure logic, importable in plain Node. */
import { MAX_FILE_BYTES } from '../../core/fileLimit.ts';
import type { MyFamilyDoc } from './model.ts';
import { fromFile } from './persist.ts';

export { MAX_FILE_BYTES };

export type ReadResult = { doc: MyFamilyDoc } | { error: 'tooLarge' | 'notProject' };

/** A file over the limit is not read at all; anything that is not a My Family project (a crest file, junk, a failing read) is `notProject`. */
export async function readDrawingFile(file: { size: number; text(): Promise<string> }): Promise<ReadResult> {
  if (file.size > MAX_FILE_BYTES) return { error: 'tooLarge' };
  try {
    const doc = fromFile(await file.text());
    return doc ? { doc } : { error: 'notProject' };
  } catch {
    return { error: 'notProject' };
  }
}
