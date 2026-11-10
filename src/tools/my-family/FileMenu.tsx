import { useEffect, useRef, useState } from 'preact/hooks';
import { download } from '../../export/download.ts';
import { t } from '../../i18n/index.ts';
import { Modal } from '../../ui/Modal.tsx';
import { exportPdf, exportPng, exportSvg, fileName } from './exports.ts';
import { readDrawingFile } from './files.ts';
import { toFile } from './persist.ts';
import { newDrawing, openDrawing, store, toast } from './store.ts';

type Format = 'png' | 'svg' | 'pdf';
const FORMATS: Format[] = ['png', 'svg', 'pdf'];

const hasFigures = (): boolean => store.get().doc.figures.length > 0;

function askNewDrawing(): void {
  if (!hasFigures() || window.confirm(t('mf.newAsk'))) newDrawing();
}

function saveDrawing(): void {
  download(new Blob([toFile(store.get().doc)], { type: 'application/json' }), fileName('json'));
  toast(t('mf.saved'));
}

/** The chosen file replaces the drawing. Nothing is asked about a file that cannot be opened. */
async function openFile(file: File): Promise<void> {
  const r = await readDrawingFile(file);
  if ('error' in r) {
    toast(t(r.error === 'tooLarge' ? 'mf.tooLarge' : 'mf.notProject'));
    return;
  }
  if (hasFigures() && !window.confirm(t('mf.openAsk'))) return;
  openDrawing(r.doc);
}

async function render(format: Format): Promise<void> {
  const doc = store.get().doc;
  if (format === 'svg') download(exportSvg(doc), fileName('svg'));
  else if (format === 'png') download(await exportPng(doc), fileName('png'));
  else download(await exportPdf(doc), fileName('pdf'));
}

function ExportDialog(props: { onClose(): void }) {
  const empty = store.get().doc.figures.length === 0;
  const [format, setFormat] = useState<Format>('png');
  const [busy, setBusy] = useState(false);
  const working = useRef(false); // set at once: a second click can arrive before the re-render

  const run = async () => {
    if (working.current || empty) return;
    working.current = true;
    setBusy(true);
    try {
      await render(format);
      toast(t('export.done'));
      props.onClose();
    } catch {
      toast(t('export.failed'));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal title={t('mf.exportTitle')} onClose={props.onClose}>
      {empty && <p class="warn">{t('mf.exportEmpty')}</p>}
      <div class="field">
        <div class="field-label">{t('export.format')}</div>
        <div class="segmented" role="radiogroup" aria-label={t('export.format')}>
          {FORMATS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={format === id} class={format === id ? 'on' : ''} disabled={busy} onClick={() => setFormat(id)}>
              {id.toUpperCase()}
              <small>{t(`export.${id}`)}</small>
            </button>
          ))}
        </div>
      </div>
      <div class="row end">
        <button type="button" class="btn" onClick={props.onClose}>{t('export.cancel')}</button>
        <button type="button" class="btn primary" disabled={busy || empty} onClick={() => void run()}>{busy ? t('export.busy') : t('export.run')}</button>
      </div>
    </Modal>
  );
}

/** The "File" menu (new, save, open), the download button with its dialog, and the hidden file input. */
export function FileMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  // A menu that stays open until its button is pressed again is a trap: Escape and a click elsewhere close it.
  useEffect(() => {
    const onDown = (e: Event) => {
      const el = menu.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = menu.current;
      if (e.key !== 'Escape' || !el?.open) return;
      el.open = false;
      el.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const pick = (action: () => void) => () => {
    if (menu.current) menu.current.open = false;
    action();
  };

  return (
    <>
      <details class="menu mf-menu" ref={menu}>
        <summary class="btn">{t('header.file')}</summary>
        <div class="menu-list">
          <button type="button" onClick={pick(askNewDrawing)}>{t('mf.new')}</button>
          <button type="button" onClick={pick(saveDrawing)}>{t('header.save')}</button>
          <button type="button" onClick={pick(() => input.current?.click())}>{t('header.open')}</button>
        </div>
      </details>
      <button type="button" class="btn primary" onClick={() => setExporting(true)}>{t('header.download')}</button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={(e) => {
          const el = e.currentTarget;
          const file = el.files?.[0];
          el.value = ''; // the same file can be opened again
          if (file) void openFile(file);
        }}
      />
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </>
  );
}
