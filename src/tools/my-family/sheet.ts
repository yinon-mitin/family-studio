export type Orientation = 'portrait' | 'landscape';

export const SHEET_SHORT = 1000;
export const SHEET_LONG = 1414;

export function sheetSize(o: Orientation): { w: number; h: number } {
  return o === 'landscape' ? { w: SHEET_LONG, h: SHEET_SHORT } : { w: SHEET_SHORT, h: SHEET_LONG };
}

// A square or an unusable viewport (zero, NaN) counts as portrait.
export function pickOrientation(viewW: number, viewH: number): Orientation {
  return viewW > viewH ? 'landscape' : 'portrait';
}
