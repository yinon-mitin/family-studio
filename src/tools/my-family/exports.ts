import { t } from '../../i18n/index.ts';
import { svgToPng } from '../../export/raster.ts';
import type { MyFamilyDoc } from './model.ts';
import { renderSheet } from './render.ts';
import { SHEET_LONG, SHEET_SHORT, sheetSize } from './sheet.ts';

const PNG_SHORT_SIDE = 1240; // A4 at 150 dpi
const PDF_MARGIN = 20; // pt

export const fileName = (ext: string, suffix?: string): string => `${t('mf.file')}${suffix ?? ''}.${ext}`;

export function exportSvg(doc: MyFamilyDoc): Blob {
  const svg = renderSheet(doc, { prefix: 'x-' });
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml;charset=utf-8' });
}

export async function exportPng(doc: MyFamilyDoc): Promise<Blob> {
  const { w, h } = sheetSize(doc.orientation);
  const long = Math.round((PNG_SHORT_SIDE * SHEET_LONG) / SHEET_SHORT);
  const width = w >= h ? long : PNG_SHORT_SIDE;
  const height = w >= h ? PNG_SHORT_SIDE : long;
  return svgToPng(renderSheet(doc, { width, prefix: 'x-' }), width, height);
}

export async function exportPdf(doc: MyFamilyDoc): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: doc.orientation, compress: true });
  pdf.setProperties({
    title: t('tool.my-family'),
    creator: `${t('shell.title')} (my-family)`,
  });
  const { w, h } = sheetSize(doc.orientation);
  const availW = pdf.internal.pageSize.getWidth() - 2 * PDF_MARGIN;
  const availH = pdf.internal.pageSize.getHeight() - 2 * PDF_MARGIN;
  const scale = Math.min(availW / w, availH / h);
  const width = w * scale;
  const height = h * scale;
  const x = (pdf.internal.pageSize.getWidth() - width) / 2;
  const y = (pdf.internal.pageSize.getHeight() - height) / 2;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden';
  document.body.appendChild(host);
  try {
    host.innerHTML = renderSheet(doc, { prefix: 'x-' });
    const el = host.firstElementChild as SVGElement;
    await svg2pdf(el, pdf, { x, y, width, height });
  } finally {
    host.remove();
  }
  return pdf.output('blob');
}
