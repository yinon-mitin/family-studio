import type { MyFamilyDoc } from './model.ts';

export type ExportFormat = 'png' | 'svg' | 'pdf';

export interface ExportRun {
  format: ExportFormat;
  /** The drawing as it is now: read when the download starts, not when the dialog opened. */
  getDoc(): MyFamilyDoc;
  /** False once the dialog is gone: nothing may be saved or shown for it. */
  alive(): boolean;
  render(format: ExportFormat, doc: MyFamilyDoc): Promise<Blob> | Blob;
  save(blob: Blob, format: ExportFormat): void;
}

/** Makes the file and hands it over unless there is nothing to export or the person has closed the dialog meanwhile. A render error is thrown to the caller. */
export async function runExport(run: ExportRun): Promise<'done' | 'empty' | 'cancelled'> {
  const doc = run.getDoc();
  if (doc.figures.length === 0) return 'empty';
  const blob = await run.render(run.format, doc);
  if (!run.alive()) return 'cancelled';
  run.save(blob, run.format);
  return 'done';
}
