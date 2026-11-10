(() => {
  'use strict';

  /* ===================================================================
   * Constants
   * =================================================================== */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'family-map:v1';
  const LANG_KEY = 'family-map:lang';
  const INK = '#263238';
  const PAPER = '#ffffff';
  const ACCENT = '#2962ff';
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'];
  const LINK_STYLES = ['solid', 'dashed', 'double', 'zigzag', 'arrow'];
  const PALETTE = ['#ef5350', '#ff9800', '#fdd835', '#66bb6a', '#26a69a', '#42a5f5',
    '#5c6bc0', '#ab47bc', '#ec407a', '#8d6e63', '#9e9e9e', '#ffffff', '#263238'];
  const SIZES = [{ key: 'size_s', v: 56 }, { key: 'size_m', v: 84 }, { key: 'size_l', v: 120 }];
  const MIN_SIZE = 30, MAX_SIZE = 220;
  const MIN_K = 0.2, MAX_K = 4;
  const HEX = /^#[0-9a-f]{6}$/i;

  const ICONS = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    link: '<circle cx="5.5" cy="12" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/><path d="M8 12h8"/>',
    pointer: '<path d="m5 3 14 8-6 2-2 6z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'
  };
  const icon = (name) =>
    `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ===================================================================
   * State
   * =================================================================== */
  const doc = { title: '', nodes: [], links: [], nextId: 1 };
  const view = { x: 0, y: 0, k: 1 };
  const ui = { tool: 'select', sel: null, linkFrom: null };
  const defaults = { color: PALETTE[5], size: 84, linkStyle: 'solid' };
  let lang = 'ru';
  let viewReady = false;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r2 = (n) => Math.round(n * 100) / 100;
  const getNode = (id) => doc.nodes.find((n) => n.id === id);
  const getLink = (id) => doc.links.find((l) => l.id === id);
  const selNode = () => (ui.sel && ui.sel.type === 'node' ? getNode(ui.sel.id) : null);
  const selLink = () => (ui.sel && ui.sel.type === 'link' ? getLink(ui.sel.id) : null);

  const svg = $('#canvas');
  const world = $('#world');
  const gridPattern = $('#grid');
  const stage = $('#stage');
  const inspector = $('#inspector');

  /* ===================================================================
   * i18n
   * =================================================================== */
  const t = (k) => (window.I18N[lang] && window.I18N[lang][k]) || window.I18N.en[k] || k;

  function applyI18n() {
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-title]').forEach((el) => {
      const v = t(el.dataset.i18nTitle);
      el.title = v;
      el.setAttribute('aria-label', v);
    });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $('#lang').value = lang;
    syncInspector();
    updateBanner();
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ru';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* storage unavailable */ }
    applyI18n();
  }

  /* ===================================================================
   * SVG helpers and geometry
   * =================================================================== */
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const ptsStr = (pts) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(' ');
  function regular(n, r, rot) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const th = rot + (i * 2 * Math.PI) / n;
      a.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    return a;
  }
  function starPts(r) {
    const a = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const th = -Math.PI / 2 + (i * Math.PI) / 5;
      a.push([rr * Math.cos(th), rr * Math.sin(th)]);
    }
    return a;
  }

  /** Returns [tagName, attributes] for a shape of radius r centred on 0,0. */
  function shapeGeom(shape, r) {
    switch (shape) {
      case 'square': return ['rect', { x: -r, y: -r, width: 2 * r, height: 2 * r }];
      case 'triangle': return ['polygon', { points: ptsStr([[0, -r], [r * 0.95, r * 0.75], [-r * 0.95, r * 0.75]]) }];
      case 'diamond': return ['polygon', { points: ptsStr([[0, -r], [r, 0], [0, r], [-r, 0]]) }];
      case 'pentagon': return ['polygon', { points: ptsStr(regular(5, r, -Math.PI / 2)) }];
      case 'hexagon': return ['polygon', { points: ptsStr(regular(6, r, 0)) }];
      case 'star': return ['polygon', { points: ptsStr(starPts(r)) }];
      default: return ['circle', { cx: 0, cy: 0, r }];
    }
  }

  const textLines = (s) => String(s || '').split('\n');
  const fontSizeOf = (n) => Math.round(n.size / 3.5);
  function textMetrics(n) {
    const fs = fontSizeOf(n);
    const lines = textLines(n.label);
    const w = Math.max(40, Math.max(...lines.map((l) => l.length)) * fs * 0.6 + 16);
    const h = Math.max(fs * 1.25, lines.length * fs * 1.25) + 8;
    return { fs, w, h, lines };
  }
  /** Approximate radius used for ring, arrow clipping and fitting. */
  function nodeRadius(n) {
    if (n.shape === 'text') { const m = textMetrics(n); return Math.max(m.w, m.h) / 2; }
    return n.size / 2;
  }

  function textBlock(parent, lines, x, top, fs, fill) {
    const lh = fs * 1.25;
    // White outline behind the glyphs keeps labels readable where lines cross them.
    const el = svgEl('text', {
      x, y: r2(top + fs * 0.9), 'font-size': fs, 'text-anchor': 'middle', fill, class: 'lbl',
      stroke: PAPER, 'stroke-width': 5, 'stroke-linejoin': 'round', 'paint-order': 'stroke'
    }, parent);
    lines.forEach((ln, i) => {
      const s = svgEl('tspan', { x, dy: i ? r2(lh) : 0 }, el);
      s.textContent = ln || ' ';
    });
    return el;
  }

  /* ===================================================================
   * Rendering
   * =================================================================== */
  function renderNode(n, opts) {
    const g = svgEl('g', { class: 'node', transform: `translate(${n.x} ${n.y})`, 'data-node': n.id });
    const isSel = !opts.export && ui.sel && ui.sel.type === 'node' && ui.sel.id === n.id;
    const isFrom = !opts.export && ui.linkFrom === n.id;

    if (n.shape === 'text') {
      const m = textMetrics(n);
      if (isSel || isFrom) {
        svgEl('rect', {
          x: -m.w / 2, y: -m.h / 2, width: m.w, height: m.h, rx: 6, class: 'ring', fill: isFrom ? 'rgba(41,98,255,.12)' : 'none',
          stroke: ACCENT, 'stroke-width': 2.5, 'stroke-dasharray': isFrom ? '' : '6 5'
        }, g);
      }
      if (!opts.export) svgEl('rect', { x: -m.w / 2, y: -m.h / 2, width: m.w, height: m.h, fill: 'transparent' }, g);
      textBlock(g, m.lines, 0, -m.lines.length * m.fs * 0.625, m.fs, n.color === PAPER ? INK : n.color);
      return g;
    }

    const r = n.size / 2;
    if (isSel || isFrom) {
      svgEl('circle', {
        r: r + 9, class: 'ring', fill: isFrom ? 'rgba(41,98,255,.12)' : 'none', stroke: ACCENT,
        'stroke-width': 2.5, 'stroke-dasharray': isFrom ? '' : '6 5'
      }, g);
    }
    const [tag, attrs] = shapeGeom(n.shape, r);
    Object.assign(attrs, n.filled
      ? { fill: n.color, stroke: INK, 'stroke-width': 2.5 }
      : { fill: PAPER, stroke: n.color === PAPER ? INK : n.color, 'stroke-width': 4 });
    attrs['stroke-linejoin'] = 'round';
    svgEl(tag, attrs, g);

    if (n.dead) {
      const d = r * 1.15;
      svgEl('path', { d: `M${-d} ${-d}L${d} ${d}M${d} ${-d}L${-d} ${d}`, stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, g);
    }
    if (n.label) textBlock(g, textLines(n.label), 0, r + 8, 16, INK);
    return g;
  }

  function renderLink(l, opts) {
    const a = getNode(l.from), b = getNode(l.to);
    if (!a || !b) return null;
    const g = svgEl('g', { class: 'link', 'data-link': l.id });
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const isSel = !opts.export && ui.sel && ui.sel.type === 'link' && ui.sel.id === l.id;
    const line = (x1, y1, x2, y2, extra) => svgEl('line', Object.assign({
      x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: l.color, 'stroke-width': 2.5, 'stroke-linecap': 'round'
    }, extra), g);

    if (!opts.export) {
      line(a.x, a.y, b.x, b.y, { class: 'hit', stroke: 'transparent', 'stroke-width': 24 });
    }
    if (isSel) line(a.x, a.y, b.x, b.y, { stroke: ACCENT, 'stroke-opacity': 0.28, 'stroke-width': 13, class: 'ring' });

    switch (l.style) {
      case 'dashed':
        line(a.x, a.y, b.x, b.y, { 'stroke-dasharray': '10 8' });
        break;
      case 'double': {
        const o = 3.6;
        line(a.x + nx * o, a.y + ny * o, b.x + nx * o, b.y + ny * o);
        line(a.x - nx * o, a.y - ny * o, b.x - nx * o, b.y - ny * o);
        break;
      }
      case 'zigzag': {
        const steps = Math.max(2, Math.round(len / 9));
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const tt = i / steps;
          const off = i === 0 || i === steps ? 0 : (i % 2 ? 1 : -1) * 7;
          pts.push([a.x + dx * tt + nx * off, a.y + dy * tt + ny * off]);
        }
        svgEl('polyline', {
          points: ptsStr(pts), fill: 'none', stroke: l.color, 'stroke-width': 2.5,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round'
        }, g);
        break;
      }
      case 'arrow': {
        const clip = nodeRadius(b) + 5;
        const ex = b.x - ux * clip, ey = b.y - uy * clip;
        if (len > clip) {
          line(a.x, a.y, ex, ey);
          const hs = 15, hw = 6.5;
          svgEl('polygon', {
            points: ptsStr([[ex, ey], [ex - ux * hs + nx * hw, ey - uy * hs + ny * hw], [ex - ux * hs - nx * hw, ey - uy * hs - ny * hw]]),
            fill: l.color, stroke: l.color, 'stroke-width': 1, 'stroke-linejoin': 'round'
          }, g);
        }
        break;
      }
      default:
        line(a.x, a.y, b.x, b.y);
    }
    return g;
  }

  function renderContent(g, opts) {
    for (const l of doc.links) { const el = renderLink(l, opts); if (el) g.appendChild(el); }
    for (const n of doc.nodes) g.appendChild(renderNode(n, opts));
  }

  function render() {
    world.textContent = '';
    renderContent(world, {});
    $('#empty-hint').hidden = doc.nodes.length > 0;
  }

  function applyView() {
    const tr = `translate(${r2(view.x)} ${r2(view.y)}) scale(${view.k})`;
    world.setAttribute('transform', tr);
    gridPattern.setAttribute('patternTransform', tr);
    scheduleSave();
  }

  /* ===================================================================
   * History and persistence
   * =================================================================== */
  const undoStack = [];
  const redoStack = [];
  let lastKey = null, lastTime = 0;

  const snapshot = () => JSON.stringify({ nodes: doc.nodes, links: doc.links, nextId: doc.nextId });

  function pushUndo(key) {
    const now = Date.now();
    if (key && key === lastKey && now - lastTime < 1200) { lastTime = now; return; }
    lastKey = key || null;
    lastTime = now;
    undoStack.push(snapshot());
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }

  function restore(json) {
    const s = JSON.parse(json);
    doc.nodes = s.nodes;
    doc.links = s.links;
    doc.nextId = s.nextId;
    if (ui.sel && !(ui.sel.type === 'node' ? getNode(ui.sel.id) : getLink(ui.sel.id))) ui.sel = null;
    if (ui.linkFrom && !getNode(ui.linkFrom)) ui.linkFrom = null;
    lastKey = null;
    changed();
    syncInspector();
    updateBanner();
    updateHistoryButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
  }
  function updateHistoryButtons() {
    $('#btn-undo').disabled = !undoStack.length;
    $('#btn-redo').disabled = !redoStack.length;
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  }
  function save() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        title: doc.title, nodes: doc.nodes, links: doc.links, view: viewReady ? view : undefined
      }));
    } catch (e) { /* storage unavailable or full */ }
  }
  function changed() {
    render();
    scheduleSave();
  }

  /** Validates and normalises untrusted project data (file or localStorage). */
  function sanitizeDoc(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw.doc && typeof raw.doc === 'object' ? raw.doc : raw;
    if (!Array.isArray(src.nodes)) return null;
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, -1e5, 1e5) : d);
    const color = (v, d) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d);
    const out = { title: typeof src.title === 'string' ? src.title.slice(0, 80) : '', nodes: [], links: [], nextId: 1 };
    const idMap = new Map();
    for (const n of src.nodes.slice(0, 2000)) {
      if (!n || typeof n !== 'object') continue;
      const id = out.nextId++;
      idMap.set(n.id, id);
      out.nodes.push({
        id,
        shape: SHAPES.includes(n.shape) || n.shape === 'text' ? n.shape : 'circle',
        x: r2(num(n.x, 0)), y: r2(num(n.y, 0)),
        size: clamp(num(n.size, 84), MIN_SIZE, MAX_SIZE),
        color: color(n.color, '#42a5f5'),
        filled: n.filled !== false,
        dead: n.dead === true,
        label: typeof n.label === 'string' ? n.label.slice(0, 200) : ''
      });
    }
    for (const l of (Array.isArray(src.links) ? src.links : []).slice(0, 5000)) {
      if (!l || typeof l !== 'object') continue;
      const from = idMap.get(l.from), to = idMap.get(l.to);
      if (!from || !to || from === to) continue;
      out.links.push({
        id: out.nextId++, from, to,
        style: LINK_STYLES.includes(l.style) ? l.style : 'solid',
        color: color(l.color, INK)
      });
    }
    const v = raw.view || src.view;
    if (v && typeof v === 'object' && [v.x, v.y, v.k].every((q) => typeof q === 'number' && Number.isFinite(q))) {
      out.view = { x: v.x, y: v.y, k: clamp(v.k, MIN_K, MAX_K) };
    }
    return out;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = sanitizeDoc(JSON.parse(raw));
      if (!d) return;
      doc.title = d.title; doc.nodes = d.nodes; doc.links = d.links; doc.nextId = d.nextId;
      if (d.view) { Object.assign(view, d.view); viewReady = true; }
    } catch (e) { /* ignore corrupted storage */ }
  }

  /* ===================================================================
   * Selection, tools, edit operations
   * =================================================================== */
  function select(sel) {
    const same = (!sel && !ui.sel) || (sel && ui.sel && sel.type === ui.sel.type && sel.id === ui.sel.id);
    if (same) return;
    ui.sel = sel;
    render();
    syncInspector();
    requestAnimationFrame(ensureVisible);
  }

  function setTool(tool, linkFrom) {
    ui.tool = tool;
    ui.linkFrom = linkFrom || null;
    if (tool === 'link') ui.sel = null;
    $$('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    svg.classList.toggle('tool-link', tool === 'link');
    render();
    syncInspector();
    updateBanner();
  }

  function updateBanner() {
    const on = ui.tool === 'link';
    $('#link-banner').hidden = !on;
    if (on) $('#link-banner-text').textContent = t(ui.linkFrom ? 'linkPickSecond' : 'linkPickFirst');
  }

  function viewCenterWorld() {
    const r = svg.getBoundingClientRect();
    return { x: (r.width / 2 - view.x) / view.k, y: (r.height / 2 - view.y) / view.k };
  }

  function addNode(shape) {
    pushUndo();
    const c = viewCenterWorld();
    let x = c.x, y = c.y;
    for (let i = 0; i < 60 && doc.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 30); i++) { x += 36; y += 36; }
    const isText = shape === 'text';
    const n = {
      id: doc.nextId++, shape, x: r2(x), y: r2(y),
      size: isText ? 70 : defaults.size,
      color: isText ? INK : defaults.color,
      filled: true, dead: false,
      label: isText ? t('textDefault') : ''
    };
    doc.nodes.push(n);
    if (ui.tool === 'link') setTool('select');
    ui.sel = { type: 'node', id: n.id };
    changed();
    syncInspector();
    requestAnimationFrame(ensureVisible);
  }

  function addLink(a, b) {
    if (a === b) return;
    pushUndo();
    const ex = doc.links.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
    if (ex) {
      ex.style = defaults.linkStyle;
      if (ex.style === 'arrow') { ex.from = a; ex.to = b; }
    } else {
      doc.links.push({ id: doc.nextId++, from: a, to: b, style: defaults.linkStyle, color: INK });
    }
    changed();
  }

  function deleteSelection() {
    const n = selNode(), l = selLink();
    if (!n && !l) return;
    pushUndo();
    if (n) {
      doc.nodes = doc.nodes.filter((x) => x.id !== n.id);
      doc.links = doc.links.filter((x) => x.from !== n.id && x.to !== n.id);
    } else {
      doc.links = doc.links.filter((x) => x.id !== l.id);
    }
    ui.sel = null;
    changed();
    syncInspector();
  }

  function duplicateSelection() {
    const n = selNode();
    if (!n) return;
    pushUndo();
    const c = Object.assign({}, n, { id: doc.nextId++, x: n.x + 32, y: n.y + 32 });
    doc.nodes.push(c);
    ui.sel = { type: 'node', id: c.id };
    changed();
    syncInspector();
  }

  function newDoc() {
    if (!doc.nodes.length && !doc.title) return;
    pushUndo();
    doc.nodes = []; doc.links = []; doc.title = '';
    $('#doc-title').value = '';
    ui.sel = null; ui.linkFrom = null;
    changed();
    syncInspector();
    updateBanner();
    toast(t('toastCleared'));
  }

  /* ===================================================================
   * Pan / zoom
   * =================================================================== */
  function zoomAt(cx, cy, factor) {
    const k = clamp(view.k * factor, MIN_K, MAX_K);
    const f = k / view.k;
    view.x = cx - (cx - view.x) * f;
    view.y = cy - (cy - view.y) * f;
    view.k = k;
    applyView();
  }

  function fit() {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (!doc.nodes.length) {
      Object.assign(view, { x: r.width / 2, y: r.height / 2, k: 1 });
    } else {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of doc.nodes) {
        const rr = nodeRadius(n);
        const below = n.shape === 'text' ? 0 : 8 + textLines(n.label).length * 20;
        x0 = Math.min(x0, n.x - rr - 60); x1 = Math.max(x1, n.x + rr + 60);
        y0 = Math.min(y0, n.y - rr - 20); y1 = Math.max(y1, n.y + rr + 20 + below);
      }
      const k = clamp(Math.min(r.width / (x1 - x0), r.height / (y1 - y0)), MIN_K, 1.5);
      view.k = k;
      view.x = r.width / 2 - ((x0 + x1) / 2) * k;
      view.y = r.height / 2 - ((y0 + y1) / 2) * k;
    }
    viewReady = true;
    applyView();
  }

  /** Keeps the selected shape on-screen when the inspector opens and shrinks the canvas. */
  function ensureVisible() {
    const n = selNode();
    if (!n || !viewReady) return;
    const r = svg.getBoundingClientRect();
    const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y;
    const m = Math.min(70, r.width / 4, r.height / 4);
    let dx = 0, dy = 0;
    if (sx < m) dx = m - sx; else if (sx > r.width - m) dx = r.width - m - sx;
    if (sy < m) dy = m - sy; else if (sy > r.height - m) dy = r.height - m - sy;
    if (dx || dy) { view.x += dx; view.y += dy; applyView(); }
  }

  /* ===================================================================
   * Pointer interaction (mouse, touch and pen via Pointer Events)
   * =================================================================== */
  const pointers = new Map();
  let gesture = null;

  function svgPoint(e) {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const toWorld = (p) => ({ x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k });

  function startPinch() {
    if (gesture && gesture.type === 'node' && gesture.moved) scheduleSave();
    const [a, b] = Array.from(pointers.values());
    gesture = {
      type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vx: view.x, vy: view.y
    };
  }
  function updatePinch() {
    const [a, b] = Array.from(pointers.values());
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const k = clamp((gesture.k * d) / gesture.d, MIN_K, MAX_K);
    const wx = (gesture.mid.x - gesture.vx) / gesture.k;
    const wy = (gesture.mid.y - gesture.vy) / gesture.k;
    view.k = k;
    view.x = mid.x - wx * k;
    view.y = mid.y - wy * k;
    applyView();
  }

  svg.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = svgPoint(e);
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2) { startPinch(); return; }

    const nodeEl = e.target.closest ? e.target.closest('[data-node]') : null;
    const linkEl = e.target.closest ? e.target.closest('[data-link]') : null;

    if (ui.tool === 'link') {
      if (nodeEl) {
        const id = Number(nodeEl.getAttribute('data-node'));
        if (ui.linkFrom == null) ui.linkFrom = id;
        else if (ui.linkFrom !== id) { addLink(ui.linkFrom, id); ui.linkFrom = null; }
        else ui.linkFrom = null;
        render();
        updateBanner();
        gesture = { type: 'none' };
      } else {
        gesture = { type: 'pan', lx: p.x, ly: p.y };
      }
      return;
    }

    if (nodeEl) {
      const id = Number(nodeEl.getAttribute('data-node'));
      select({ type: 'node', id });
      const n = getNode(id), w = toWorld(p);
      gesture = { type: 'node', id, dx: n.x - w.x, dy: n.y - w.y, sx: p.x, sy: p.y, moved: false };
    } else if (linkEl) {
      select({ type: 'link', id: Number(linkEl.getAttribute('data-link')) });
      gesture = { type: 'none' };
    } else {
      select(null);
      gesture = { type: 'pan', lx: p.x, ly: p.y };
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = svgPoint(e);
    pointers.set(e.pointerId, p);
    if (!gesture) return;
    if (gesture.type === 'pinch') { updatePinch(); return; }
    if (gesture.type === 'pan') {
      view.x += p.x - gesture.lx; view.y += p.y - gesture.ly;
      gesture.lx = p.x; gesture.ly = p.y;
      applyView();
    } else if (gesture.type === 'node') {
      if (!gesture.moved) {
        if (Math.hypot(p.x - gesture.sx, p.y - gesture.sy) < 4) return;
        gesture.moved = true;
        pushUndo();
      }
      const n = getNode(gesture.id), w = toWorld(p);
      if (!n) return;
      n.x = r2(w.x + gesture.dx);
      n.y = r2(w.y + gesture.dy);
      render();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (gesture && gesture.type === 'node' && gesture.moved) scheduleSave();
      gesture = null;
    } else if (pointers.size === 1 && gesture && gesture.type === 'pinch') {
      gesture = { type: 'none' };
    }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1;
    const p = svgPoint(e);
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * unit * 0.0015));
  }, { passive: false });

  svg.addEventListener('dblclick', (e) => {
    const el = e.target.closest ? e.target.closest('[data-node]') : null;
    if (!el || ui.tool !== 'select') return;
    select({ type: 'node', id: Number(el.getAttribute('data-node')) });
    const f = $('#f-label');
    f.focus();
    f.select();
  });

  /* ===================================================================
   * Palette and inspector widgets
   * =================================================================== */
  function shapeIcon(shape, size) {
    const s = svgEl('svg', { viewBox: '-14 -14 28 28', 'aria-hidden': 'true', class: 'ico' });
    s.style.width = s.style.height = size + 'px';
    const [tag, attrs] = shapeGeom(shape, 10.5);
    Object.assign(attrs, { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round' });
    svgEl(tag, attrs, s);
    return s;
  }

  const LINK_SAMPLES = {
    solid: '<line x1="2" y1="7" x2="38" y2="7"/>',
    dashed: '<line x1="2" y1="7" x2="38" y2="7" stroke-dasharray="6 4"/>',
    double: '<line x1="2" y1="4.5" x2="38" y2="4.5"/><line x1="2" y1="9.5" x2="38" y2="9.5"/>',
    zigzag: '<polyline fill="none" points="2,7 6,3 10,11 14,3 18,11 22,3 26,11 30,3 34,11 38,7"/>',
    arrow: '<line x1="2" y1="7" x2="32" y2="7"/><polygon points="38,7 30,3 30,11" fill="currentColor"/>'
  };
  const linkSample = (style) =>
    `<svg class="link-sample" viewBox="0 0 40 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINK_SAMPLES[style]}</svg>`;

  function labelled(btn, key) {
    btn.dataset.i18nTitle = key;
    const span = document.createElement('span');
    span.className = 'btn-label';
    span.dataset.i18n = key;
    btn.appendChild(span);
  }

  function buildShapeButtons(container, onPick, opts) {
    const btns = [];
    for (const s of opts.shapes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = opts.cls;
      b.dataset.shape = s;
      if (s === 'text') b.insertAdjacentHTML('afterbegin', icon('text'));
      else b.appendChild(shapeIcon(s, 26));
      if (opts.label) labelled(b, 'shape_' + s);
      else b.dataset.i18nTitle = 'shape_' + s;
      b.addEventListener('click', () => onPick(s));
      container.appendChild(b);
      btns.push(b);
    }
    return btns;
  }

  function buildLinkButtons(container, onPick, opts) {
    const btns = [];
    for (const s of LINK_STYLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = opts.cls;
      b.dataset.link = s;
      b.insertAdjacentHTML('afterbegin', linkSample(s));
      if (opts.label) labelled(b, 'link_' + s);
      else b.dataset.i18nTitle = 'link_' + s;
      b.addEventListener('click', () => onPick(s));
      container.appendChild(b);
      btns.push(b);
    }
    return btns;
  }

  function buildSwatches(container, onPick) {
    PALETTE.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = c;
      b.dataset.color = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', () => onPick(c));
      container.appendChild(b);
    });
    const lab = document.createElement('label');
    lab.className = 'swatch custom';
    lab.dataset.i18nTitle = 'customColor';
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = '#42a5f5';
    inp.addEventListener('input', () => onPick(inp.value));
    lab.appendChild(inp);
    container.appendChild(lab);
    return {
      setValue(c) {
        const v = String(c).toLowerCase();
        $$('.swatch[data-color]', container).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === v)));
        if (HEX.test(v)) inp.value = v;
      }
    };
  }

  // Palette: shapes that get added to the canvas
  buildShapeButtons($('#shape-list'), addNode, { shapes: SHAPES.concat('text'), cls: 'tile', label: false });

  const defColors = buildSwatches($('#def-colors'), (c) => { defaults.color = c; defColors.setValue(c); });
  defColors.setValue(defaults.color);

  const sizeBtns = SIZES.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.dataset.size = s.v;
    b.dataset.i18nTitle = s.key;
    b.appendChild(shapeIcon('circle', 14 + i * 6));
    b.addEventListener('click', () => { defaults.size = s.v; syncSizeButtons(); });
    $('#def-sizes').appendChild(b);
    return b;
  });
  const syncSizeButtons = () => sizeBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === defaults.size)));
  syncSizeButtons();

  const defLinkBtns = buildLinkButtons($('#link-styles'), (s) => { defaults.linkStyle = s; syncDefLinks(); }, { cls: 'tile', label: true });
  const syncDefLinks = () => defLinkBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.link === defaults.linkStyle)));
  syncDefLinks();

  $$('[data-tool]').forEach((b) => b.addEventListener('click', () => {
    setTool(b.dataset.tool === ui.tool ? 'select' : b.dataset.tool);
  }));
  $('#link-done').addEventListener('click', () => setTool('select'));

  // Inspector: node fields
  const fLabel = $('#f-label'), fSize = $('#f-size'), fFilled = $('#f-filled'), fDead = $('#f-dead');
  const nodeShapeBtns = buildShapeButtons($('#f-shapes'), (s) => {
    const n = selNode(); if (!n) return;
    pushUndo(); n.shape = s; changed(); syncInspector();
  }, { shapes: SHAPES, cls: 'chip', label: false });
  const nodeColors = buildSwatches($('#f-colors'), (c) => {
    const n = selNode(); if (!n) return;
    pushUndo('color:' + n.id); n.color = c.toLowerCase(); changed(); nodeColors.setValue(c);
  });

  fLabel.addEventListener('input', () => {
    const n = selNode(); if (!n) return;
    pushUndo('label:' + n.id); n.label = fLabel.value; changed();
  });
  fSize.addEventListener('input', () => {
    const n = selNode(); if (!n) return;
    pushUndo('size:' + n.id); n.size = Number(fSize.value); changed();
  });
  fFilled.addEventListener('change', () => {
    const n = selNode(); if (!n) return;
    pushUndo(); n.filled = fFilled.checked; changed();
  });
  fDead.addEventListener('change', () => {
    const n = selNode(); if (!n) return;
    pushUndo(); n.dead = fDead.checked; changed();
  });
  $('#b-del').addEventListener('click', deleteSelection);
  $('#b-dup').addEventListener('click', duplicateSelection);
  $('#b-link-from').addEventListener('click', () => {
    const n = selNode(); if (!n) return;
    setTool('link', n.id);
  });
  $('#insp-close').addEventListener('click', () => select(null));

  // Inspector: link fields
  const linkStyleBtns = buildLinkButtons($('#l-styles'), (s) => {
    const l = selLink(); if (!l) return;
    pushUndo(); l.style = s; changed(); syncInspector();
  }, { cls: 'chip wide', label: false });
  const linkColors = buildSwatches($('#l-colors'), (c) => {
    const l = selLink(); if (!l) return;
    pushUndo('lcolor:' + l.id); l.color = c.toLowerCase(); changed(); linkColors.setValue(c);
  });
  $('#l-del').addEventListener('click', deleteSelection);
  $('#l-reverse').addEventListener('click', () => {
    const l = selLink(); if (!l) return;
    pushUndo(); const tmp = l.from; l.from = l.to; l.to = tmp; changed();
  });

  function syncInspector() {
    const n = selNode(), l = selLink();
    const has = !!(n || l);
    inspector.classList.toggle('has-sel', has);
    $('#insp-empty').hidden = has;
    $('#insp-body').hidden = !has;
    $('#node-panel').hidden = !n;
    $('#link-panel').hidden = !l;
    if (n) {
      const isText = n.shape === 'text';
      $('#insp-title').textContent = t(isText ? 'selText' : 'selNode');
      fLabel.value = n.label;
      fSize.value = n.size;
      fFilled.checked = n.filled;
      fDead.checked = n.dead;
      $('#f-shape-field').hidden = isText;
      $('#f-checks').hidden = isText;
      nodeColors.setValue(n.color);
      nodeShapeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shape === n.shape)));
    }
    if (l) {
      $('#insp-title').textContent = t('selLink');
      linkColors.setValue(l.color);
      linkStyleBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.link === l.style)));
      $('#l-reverse').hidden = l.style !== 'arrow';
    }
  }

  /* ===================================================================
   * Top bar, keyboard, toast
   * =================================================================== */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#btn-new').addEventListener('click', newDoc);
  $('#lang').addEventListener('change', (e) => setLang(e.target.value));
  $('#doc-title').addEventListener('input', (e) => { doc.title = e.target.value; scheduleSave(); });
  $('#zoom-in').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); });
  $('#zoom-out').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 0.8); });
  $('#zoom-fit').addEventListener('click', fit);

  document.addEventListener('keydown', (e) => {
    if ($('#export-dialog').open) return;
    const el = e.target;
    const tag = (el.tagName || '').toLowerCase();
    const typing = tag === 'textarea' || tag === 'select' ||
      (tag === 'input' && ['text', 'range', 'number', 'search'].includes(el.type));
    if (typing) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); redo(); return; }
    if (mod && key === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (ui.sel) { e.preventDefault(); deleteSelection(); }
    } else if (e.key === 'Escape') {
      if (ui.tool === 'link') setTool('select'); else select(null);
    } else if (e.key.startsWith('Arrow')) {
      const n = selNode();
      if (!n) return;
      e.preventDefault();
      const step = e.shiftKey ? 20 : 4;
      pushUndo('nudge:' + n.id);
      if (e.key === 'ArrowLeft') n.x -= step;
      if (e.key === 'ArrowRight') n.x += step;
      if (e.key === 'ArrowUp') n.y -= step;
      if (e.key === 'ArrowDown') n.y += step;
      changed();
    }
  });

  /* ===================================================================
   * Export / import
   * =================================================================== */
  const fileBase = () => (doc.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 60) || 'family-map');

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /** Builds a standalone SVG (white background, optional title) of the whole diagram. */
  function buildExportSvg() {
    const tmp = svgEl('svg', { width: 10, height: 10, 'font-family': FONT });
    tmp.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
    document.body.appendChild(tmp);
    const g = svgEl('g', null, tmp);
    renderContent(g, { export: true });
    const b = g.getBBox();
    const title = doc.title.trim();
    let tw = 0;
    let titleEl = null;
    if (title) {
      titleEl = svgEl('text', { 'font-size': 26, 'font-weight': 700, fill: INK, 'text-anchor': 'middle' }, tmp);
      titleEl.textContent = title;
      tw = titleEl.getBBox().width;
    }
    const pad = 40, head = title ? 46 : 0;
    const W = Math.ceil(Math.max(b.width, tw) + pad * 2);
    const H = Math.ceil(b.height + pad * 2 + head);
    const cx = b.x + b.width / 2;
    const vx = cx - W / 2, vy = b.y - pad - head;
    const out = svgEl('svg', {
      xmlns: SVGNS, width: W, height: H, viewBox: `${r2(vx)} ${r2(vy)} ${W} ${H}`, 'font-family': FONT
    });
    svgEl('rect', { x: r2(vx), y: r2(vy), width: W, height: H, fill: PAPER }, out);
    if (titleEl) {
      tmp.removeChild(titleEl);
      titleEl.setAttribute('x', r2(cx));
      titleEl.setAttribute('y', r2(b.y - 18));
      out.appendChild(titleEl);
    }
    out.appendChild(g);
    document.body.removeChild(tmp);
    return { svg: new XMLSerializer().serializeToString(out), W, H };
  }

  function rasterize(svgStr, W, H, type, quality) {
    const scale = Math.min(2, 4096 / Math.max(W, H));
    const cw = Math.max(1, Math.round(W * scale)), ch = Math.max(1, Math.round(H * scale));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const ctx = c.getContext('2d');
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        c.toBlob((blob) => (blob ? resolve({ blob, w: cw, h: ch }) : reject(new Error('toBlob failed'))), type, quality);
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  }

  /** Minimal single-page PDF that embeds a JPEG scaled to fit an A4 page. */
  function buildPdf(jpeg, iw, ih) {
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [];
    let len = 0;
    const push = (d) => { const u = typeof d === 'string' ? enc.encode(d) : d; parts.push(u); len += u.length; };
    const f = (n) => n.toFixed(2);
    const landscape = iw >= ih;
    const pw = landscape ? 841.89 : 595.28, ph = landscape ? 595.28 : 841.89, m = 28;
    const s = Math.min((pw - 2 * m) / iw, (ph - 2 * m) / ih);
    const w = iw * s, h = ih * s, x = (pw - w) / 2, y = (ph - h) / 2;
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };

    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw)} ${f(ph)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4] = len;
    push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream\nendobj\n');
    const content = `q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(y)} cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    let table = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(table + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  async function doExport(kind) {
    if (kind !== 'json' && !doc.nodes.length) { toast(t('exportEmpty')); return; }
    try {
      if (kind === 'json') {
        const data = { app: 'family-map', version: 1, doc: { title: doc.title, nodes: doc.nodes, links: doc.links } };
        download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fileBase() + '.json');
        return;
      }
      const { svg: str, W, H } = buildExportSvg();
      if (kind === 'svg') {
        download(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + str], { type: 'image/svg+xml' }), fileBase() + '.svg');
      } else if (kind === 'png') {
        const { blob } = await rasterize(str, W, H, 'image/png');
        download(blob, fileBase() + '.png');
      } else if (kind === 'pdf') {
        const { blob, w, h } = await rasterize(str, W, H, 'image/jpeg', 0.93);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        download(buildPdf(bytes, w, h), fileBase() + '.pdf');
      }
    } catch (err) {
      console.error(err);
      toast(t('exportError'));
    }
  }

  const exportDialog = $('#export-dialog');
  $('#btn-export').addEventListener('click', () => exportDialog.showModal());
  $('#export-close').addEventListener('click', () => exportDialog.close());
  exportDialog.addEventListener('click', (e) => { if (e.target === exportDialog) exportDialog.close(); });
  $$('[data-export]').forEach((b) => b.addEventListener('click', () => {
    exportDialog.close();
    doExport(b.dataset.export);
  }));

  $('#btn-open').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const d = sanitizeDoc(JSON.parse(await file.text()));
      if (!d) throw new Error('invalid project');
      pushUndo();
      doc.title = d.title; doc.nodes = d.nodes; doc.links = d.links; doc.nextId = d.nextId;
      $('#doc-title').value = doc.title;
      ui.sel = null; ui.linkFrom = null;
      if (ui.tool === 'link') setTool('select');
      changed();
      syncInspector();
      fit();
      toast(t('toastImported'));
    } catch (err) {
      toast(t('toastImportError'));
    }
  });

  /* ===================================================================
   * Init
   * =================================================================== */
  loadFromStorage();
  try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ru'; } catch (e) { lang = 'ru'; }

  // Icons
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

  $('#doc-title').value = doc.title;
  applyI18n();
  render();
  updateHistoryButtons();

  function initView() {
    const r = svg.getBoundingClientRect();
    if (!r.width) { requestAnimationFrame(initView); return; }
    if (viewReady) applyView(); else fit();
  }
  requestAnimationFrame(initView);

  if (window.ResizeObserver) new ResizeObserver(() => { if (ui.sel) ensureVisible(); }).observe(svg);

  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
})();
