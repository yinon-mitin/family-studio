import type { CrestDoc } from '../model/types.ts';
import { CANVAS_H, CANVAS_W } from '../model/types.ts';
import { renderCrest } from '../render/renderCrest.ts';
import { svgToPng } from './raster.ts';
import { backgroundColor, type Background } from './svg.ts';

export async function exportPng(doc: CrestDoc, width: number, bg: Background): Promise<Blob> {
  const height = Math.round((width * CANVAS_H) / CANVAS_W);
  const svg = renderCrest(doc, { width, background: backgroundColor(doc, bg) });
  return svgToPng(svg, width, height);
}
