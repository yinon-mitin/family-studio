import { describe, expect, it } from 'vitest';
import { contrast } from '../src/model/colors.ts';
import { figureBounds, type Figure, type MyFamilyDoc } from '../src/tools/my-family/model.ts';
import { renderSheet } from '../src/tools/my-family/render.ts';

const fig = (over: Partial<Figure> & { id: string }): Figure => ({
  kind: 'square',
  x: 300,
  y: 400,
  size: 100,
  rotation: 0,
  color: '#e53935',
  texture: null,
  ...over,
});

const doc = (orientation: 'portrait' | 'landscape' = 'portrait'): MyFamilyDoc => ({
  version: 1,
  orientation,
  figures: [
    fig({ id: 'aaa', kind: 'circle', texture: 'stripes' }),
    fig({ id: 'bbb', kind: 'rect', x: 500, y: 600, rotation: 30 }),
    fig({ id: 'ccc', kind: 'triangle', x: 700, y: 800, color: '#1c1c24' }),
  ],
});

const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('renderSheet', () => {
  it('uses the sheet size as viewBox for both orientations', () => {
    expect(renderSheet(doc('portrait'))).toContain('viewBox="0 0 1000 1414"');
    expect(renderSheet(doc('landscape'))).toContain('viewBox="0 0 1414 1000"');
    expect(renderSheet(doc())).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('draws one group per figure, in layer order', () => {
    const svg = renderSheet(doc());
    expect(count(svg, 'data-fig=')).toBe(3);
    const order = ['aaa', 'bbb', 'ccc'].map((id) => svg.indexOf(`data-fig="${id}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('adds one clipPath per textured figure only', () => {
    expect(count(renderSheet(doc()), '<clipPath')).toBe(1);
    const all: MyFamilyDoc = { ...doc(), figures: doc().figures.map((f) => ({ ...f, texture: 'dots' as const })) };
    expect(count(renderSheet(all), '<clipPath')).toBe(3);
  });

  it('draws a stroked texture as a line and a filled texture as a fill', () => {
    const a = renderSheet({ ...doc(), figures: [fig({ id: 'w', texture: 'waves' })] });
    expect(a).toMatch(/fill="none"[^>]*stroke="#[0-9a-f]{6}"[^>]*stroke-width="\d/);
    const b = renderSheet({ ...doc(), figures: [fig({ id: 's', texture: 'stripes' })] });
    expect(b).toMatch(new RegExp(`<path d="[^"]*" fill="${contrast('#e53935')}"`));
    expect(b).toContain('scale(0.2778)'); // size / 360
  });

  it('contains no forbidden elements', () => {
    const svg = renderSheet(doc(), { selected: 'aaa', frame: true });
    for (const bad of ['<pattern', '<text', '<filter', '<mask', 'Gradient']) expect(svg).not.toContain(bad);
  });

  it('has a white sheet background', () => {
    expect(renderSheet(doc())).toContain('fill="#ffffff"');
  });

  it('keeps clip ids apart for different prefixes', () => {
    const ids = (s: string) => [...s.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(renderSheet(doc(), { prefix: 'a-' }));
    const b = ids(renderSheet(doc(), { prefix: 'b-' }));
    expect(a.length).toBe(1);
    expect(a.every((id) => id.startsWith('a-'))).toBe(true);
    expect(a.some((id) => b.includes(id))).toBe(false);
    const svg = renderSheet(doc(), { prefix: 'a-' });
    expect(svg).toContain(`clip-path="url(#${a[0]})"`);
  });

  it('marks the selected figure exactly once, and only when asked', () => {
    expect(count(renderSheet(doc(), { selected: 'bbb' }), 'data-selected="true"')).toBe(1);
    expect(count(renderSheet(doc()), 'data-selected')).toBe(0);
    expect(count(renderSheet(doc(), { selected: null }), 'data-selected')).toBe(0);
    expect(count(renderSheet(doc(), { selected: 'nope' }), 'data-selected')).toBe(0);
  });

  it('draws the selection ring last, above every figure, and lets pointers through it', () => {
    const svg = renderSheet(doc(), { selected: 'aaa' }); // the first figure: others are drawn after it
    expect(count(svg, 'data-selected-ring')).toBe(1);
    expect(svg.indexOf('data-selected-ring')).toBeGreaterThan(svg.lastIndexOf('data-fig='));
    const ring = svg.slice(svg.lastIndexOf('<path'));
    expect(ring).toMatch(/^<path [^>]*data-selected-ring[^>]*pointer-events="none"[^>]*\/><\/svg>$/);
    // the ring is not inside any figure group
    const group = new RegExp('<g data-fig="aaa"[\\s\\S]*?</g>').exec(svg)![0];
    expect(group).not.toContain('data-selected-ring');
    expect(group).toContain('data-selected="true"');
  });

  it('centres the ring on the selected figure', () => {
    const svg = renderSheet({ ...doc(), figures: [fig({ id: 'q', x: 250, y: 330 })] }, { selected: 'q' });
    expect(svg).toMatch(/<path [^>]*data-selected-ring[^>]*transform="translate\(250 330\)"/);
  });

  it('has no ring without a selection (exports)', () => {
    expect(renderSheet(doc())).not.toContain('data-selected-ring');
    expect(renderSheet(doc(), { selected: 'nope' })).not.toContain('data-selected-ring');
  });

  it('adds a frame only on request', () => {
    expect(renderSheet(doc(), { frame: false })).not.toContain('data-frame');
    expect(renderSheet(doc())).not.toContain('data-frame');
    expect(renderSheet(doc(), { frame: true })).toContain('data-frame');
  });

  it('renders an empty document as a valid sheet without figures', () => {
    const svg = renderSheet({ version: 1, orientation: 'landscape', figures: [] });
    expect(svg).toContain('viewBox="0 0 1414 1000"');
    expect(count(svg, 'data-fig=')).toBe(0);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('sets width and height by proportion', () => {
    const svg = renderSheet(doc(), { width: 500 });
    expect(svg).toContain('width="500"');
    expect(svg).toContain('height="707"');
  });

  it('draws a circle with two arcs and an outline of #1c1c24, width 3', () => {
    const svg = renderSheet({ ...doc(), figures: [fig({ id: 'c', kind: 'circle', color: '#43a047' })] });
    const d = svg.match(/<path d="([^"]*)" fill="#43a047"/)![1];
    expect(d.match(/[Aa]/g)!.length).toBe(2);
    expect(svg).toContain('stroke="#1c1c24"');
    expect(svg).toContain('stroke-width="3"');
  });

  it('places a figure with translate then rotate, matching figureBounds', () => {
    const f = fig({ id: 'tri', kind: 'triangle', x: 400, y: 500, size: 100, rotation: 90 });
    const svg = renderSheet({ ...doc(), figures: [f] });
    expect(svg).toContain('data-fig="tri" transform="translate(400 500) rotate(90)"');
    // the apex (local 0,-0.435*size) points toward +x at rotation 90
    expect(figureBounds(f).maxX).toBeCloseTo(400 + 0.435 * 100, 6);
  });

  it('escapes figure ids in attributes', () => {
    const svg = renderSheet({ ...doc(), figures: [fig({ id: 'a"<b' })] });
    expect(svg).toContain('data-fig="a&quot;&lt;b"');
    expect(svg).not.toContain('a"<b');
  });

  it('lets no character that is illegal in XML reach the SVG, whatever the id', () => {
    for (const id of ['a\u0000b', 'a\u0001b', 'a\u001fb', 'a\ufffeb']) {
      const svg = renderSheet({ ...doc(), figures: [fig({ id })] }, { selected: id, prefix: id });
      // eslint-disable-next-line no-control-regex
      expect(svg, JSON.stringify(id)).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/);
    }
  });
});
