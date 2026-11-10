import { MAX_FILE_BYTES } from '../core/fileLimit.ts';
import { download, fileName } from '../export/download.ts';
import { clearAuto, fromFile, toFile } from '../model/serialize.ts';
import { emptyDoc } from '../model/doc.ts';
import { t } from '../i18n/index.ts';
import { getState, openDoc, toast } from '../model/store.ts';

export function saveFile(): void {
  const { doc } = getState();
  download(new Blob([toFile(doc)], { type: 'application/json' }), fileName(doc, 'json', t('file.projectSuffix')));
  toast(t('file.saved'));
}

export async function openFile(file: File): Promise<void> {
  if (file.size > MAX_FILE_BYTES) {
    toast(t('file.tooLarge'));
    return;
  }
  const doc = fromFile(await file.text());
  if (!doc) {
    toast(t('file.notProject'));
    return;
  }
  openDoc(doc);
}

export function pickFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => input.files?.[0] && void openFile(input.files[0]);
  input.click();
}

/** Полностью стирает данные участника с этого устройства. */
export function wipe(): boolean {
  if (!window.confirm(t('file.wipeConfirm'))) return false;
  clearAuto();
  openDoc(emptyDoc());
  return true;
}
