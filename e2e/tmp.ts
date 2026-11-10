import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const made: string[] = [];

/** A temp directory for files a test downloads; `cleanTmp` removes it (call it from `test.afterEach`). */
export function makeTmp(prefix = 'semya-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

export function cleanTmp(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}
