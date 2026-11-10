import { contrast } from '../../model/colors.ts';
import { circle, n, poly } from '../../render/geometry.ts';
import { patternGeometry } from '../../render/patterns.ts';
import { figureOutline, type Figure, type MyFamilyDoc } from './model.ts';
import { sheetSize } from './sheet.ts';

export interface RenderOpts {
  /** Width in pixels for the width attribute; the height follows the sheet proportion. */
  width?: number;
  /** Prefix for clipPath ids, so several sheets on one page do not collide. */
  prefix?: string;
  /** Thin frame around the sheet (screen only; exports leave it out). */
  frame?: boolean;
  /** Draws a dashed ring around this figure and marks its group with data-selected (screen only). */
  selected?: string | null;
}

const OUTLINE = '#1c1c24';
const OUTLINE_WIDTH = 3;
const PATTERN_BASE = 360; // a texture is scaled by size / PATTERN_BASE
const RING_GAP = 10;

// Characters XML 1.0 forbids are dropped (an id from a code path other than the file reader must not break the export either).
// eslint-disable-next-line no-control-regex
const ILLEGAL_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;

const esc = (s: string): string =>
  s.replace(ILLEGAL_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Outline of the figure around its own centre, before rotation.
function shapePath(f: Figure): string {
  if (f.kind === 'circle') return circle(0, 0, f.size / 2);
  return poly(figureOutline({ ...f, x: 0, y: 0, rotation: 0 }));
}

function ringRadius(f: Figure): number {
  if (f.kind === 'circle') return f.size / 2 + RING_GAP;
  const reach = Math.max(...figureOutline({ ...f, x: 0, y: 0, rotation: 0 }).map(([x, y]) => Math.hypot(x, y)));
  return reach + RING_GAP;
}

function renderFigure(f: Figure, index: number, prefix: string, selected: boolean): string {
  const d = shapePath(f);
  let body = `<path d="${d}" fill="${f.color}"/>`;
  if (f.texture) {
    const cid = `${prefix}c${index}`;
    const g = patternGeometry(f.texture);
    const col = contrast(f.color);
    const scale = `scale(${+(f.size / PATTERN_BASE).toFixed(4)})`;
    const pat = g.stroke
      ? `<path d="${g.d}" fill="none" stroke="${col}" stroke-width="${g.stroke}" stroke-linecap="round"/>`
      : `<path d="${g.d}" fill="${col}"/>`;
    body =
      `<clipPath id="${cid}"><path d="${d}"/></clipPath>` +
      body +
      `<g clip-path="url(#${cid})"><g transform="${scale}">${pat}</g></g>`;
  }
  body += `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${OUTLINE_WIDTH}" stroke-linejoin="round"/>`;
  let mark = '';
  if (selected) {
    mark =
      `<path d="${circle(0, 0, ringRadius(f))}" fill="none" stroke="${OUTLINE}" stroke-width="2" ` +
      `stroke-dasharray="8 6"/>`;
  }
  const sel = selected ? ' data-selected="true"' : '';
  return `<g data-fig="${esc(f.id)}" transform="translate(${n(f.x)} ${n(f.y)}) rotate(${n(f.rotation)})"${sel}>${body}${mark}</g>`;
}

export function renderSheet(doc: MyFamilyDoc, opts: RenderOpts = {}): string {
  const { w, h } = sheetSize(doc.orientation);
  const prefix = esc(opts.prefix ?? '');
  const size =
    opts.width !== undefined && Number.isFinite(opts.width) && opts.width > 0
      ? ` width="${n(opts.width)}" height="${n((opts.width * h) / w)}"`
      : '';
  const frame = opts.frame
    ? `<rect data-frame="true" x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#c9c9d1" stroke-width="2"/>`
    : '';
  const figures = doc.figures
    .map((f, i) => renderFigure(f, i, prefix, opts.selected != null && f.id === opts.selected))
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${size}>` +
    `<rect width="${w}" height="${h}" fill="#ffffff"/>${frame}${figures}</svg>`
  );
}
