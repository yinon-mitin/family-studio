import { describe, expect, it } from 'vitest';
import { pickOrientation, sheetSize } from '../src/tools/my-family/sheet.ts';

describe('sheetSize', () => {
  it('portrait is 1000 x 1414', () => {
    expect(sheetSize('portrait')).toEqual({ w: 1000, h: 1414 });
  });
  it('landscape is 1414 x 1000', () => {
    expect(sheetSize('landscape')).toEqual({ w: 1414, h: 1000 });
  });
});

describe('pickOrientation', () => {
  it('wide screen gets landscape', () => {
    expect(pickOrientation(1280, 720)).toBe('landscape');
  });
  it('phone gets portrait', () => {
    expect(pickOrientation(390, 844)).toBe('portrait');
  });
  it('a square counts as portrait', () => {
    expect(pickOrientation(800, 800)).toBe('portrait');
  });
  it('zero size falls back to portrait', () => {
    expect(pickOrientation(0, 0)).toBe('portrait');
  });
  it('NaN falls back to portrait', () => {
    expect(pickOrientation(NaN, NaN)).toBe('portrait');
  });
});
