import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n/index.ts';
import { exportSvg, fileName } from '../src/tools/my-family/exports.ts';
import type { MyFamilyDoc } from '../src/tools/my-family/model.ts';

const doc = (orientation: 'portrait' | 'landscape'): MyFamilyDoc => ({
  version: 1,
  orientation,
  figures: [
    { id: 'aaa', kind: 'circle', x: 300, y: 400, size: 100, rotation: 0, color: '#e53935', texture: 'stripes' },
    { id: 'bbb', kind: 'triangle', x: 500, y: 600, size: 120, rotation: 30, color: '#1c1c24', texture: 'dots' },
  ],
});

afterEach(() => setLang('ru'));

describe('fileName', () => {
  it('uses the Russian base name by default', () => {
    expect(fileName('png')).toBe('moya-semya.png');
    expect(fileName('png', '-2')).toBe('moya-semya-2.png');
  });

  it('uses the English base name in English', () => {
    setLang('en');
    expect(fileName('pdf')).toBe('my-family.pdf');
    expect(fileName('svg', '-2')).toBe('my-family-2.svg');
  });
});

describe('exportSvg', () => {
  it('returns an svg blob with an XML header', async () => {
    const blob = exportSvg(doc('portrait'));
    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(await blob.text()).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<svg /);
  });

  it('uses the sheet viewBox of each orientation', async () => {
    expect(await exportSvg(doc('portrait')).text()).toContain('viewBox="0 0 1000 1414"');
    expect(await exportSvg(doc('landscape')).text()).toContain('viewBox="0 0 1414 1000"');
  });

  it('keeps only paths, no patterns, text, selection or frame', async () => {
    const text = await exportSvg(doc('portrait')).text();
    expect(text).toContain('data-fig="aaa"');
    expect(text).not.toContain('<pattern');
    expect(text).not.toContain('<text');
    expect(text).not.toContain('data-selected');
    expect(text).not.toContain('data-frame');
  });
});
