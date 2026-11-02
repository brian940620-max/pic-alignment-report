// 共用 UI 工具：建 DOM、滑桿、分段按鈕、畫布尺寸、動畫迴圈、數字格式

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, x); else el.style[p] = x; }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 滑桿：回傳 {el, get(), set(v, silent)}。fmt 可自訂顯示。
export function slider({ label, min, max, step = 1, value, unit = '', digits = 1, fmt, onInput, hint }) {
  const input = h('input', { type: 'range', min, max, step, value });
  const val = h('span', { class: 'sl-val' });
  const show = (v) => { val.textContent = fmt ? fmt(v) : `${(+v).toFixed(digits)} ${unit}`.trim(); };
  show(value);
  input.addEventListener('input', () => { show(+input.value); onInput && onInput(+input.value); });
  const el = h('label', { class: 'slider' },
    h('span', { class: 'sl-top' }, h('span', { class: 'sl-label' }, label), val),
    input,
    hint ? h('span', { class: 'sl-hint' }, hint) : null);
  return {
    el,
    get: () => +input.value,
    set: (v, silent) => { input.value = v; show(+input.value); if (!silent && onInput) onInput(+input.value); },
  };
}

// 分段按鈕：items=[{id,label}]，回傳 {el, set(id)}
export function segmented(items, current, onChange) {
  const btns = {};
  const el = h('div', { class: 'seg' });
  const set = (id, silent) => {
    for (const [k, b] of Object.entries(btns)) b.classList.toggle('on', k === id);
    current = id;
    if (!silent && onChange) onChange(id);
  };
  for (const it of items) {
    btns[it.id] = h('button', { type: 'button', onclick: () => set(it.id) }, it.label);
    el.append(btns[it.id]);
  }
  set(current, true);
  return { el, set, get: () => current };
}

// 畫布：依容器大小與 devicePixelRatio 調整；回傳 {canvas, ctx, w, h, onResize}
// 舞台會等比縮放（window.__deckScale），所以用版面尺寸（clientWidth）作為繪圖座標，
// 並把緩衝區解析度乘上縮放倍率，投影到大螢幕時才不會糊。
export function fitCanvas(canvas, onResize) {
  const ctx = canvas.getContext('2d');
  const obj = { canvas, ctx, w: 0, h: 0 };
  const apply = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w < 2 || h < 2) { obj.w = 0; return; }
    const dpr = Math.min((window.devicePixelRatio || 1) * (window.__deckScale || 1), 3);
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    obj.w = w; obj.h = h;
    onResize && onResize(obj);
  };
  new ResizeObserver(apply).observe(canvas);
  window.addEventListener('deckscale', apply);
  apply();
  obj.apply = apply;
  return obj;
}

// 動畫迴圈：頁面隱藏時停止
export function loop(fn) {
  let id = 0, last = 0, on = false;
  const tick = (t) => {
    if (!on) return;
    const dt = Math.min(0.1, (t - last) / 1000 || 0);
    last = t;
    fn(dt, t / 1000);
    id = requestAnimationFrame(tick);
  };
  return {
    start() { if (on) return; on = true; last = performance.now(); id = requestAnimationFrame(tick); },
    stop() { on = false; cancelAnimationFrame(id); },
    get running() { return on; },
  };
}

// 數字格式
export function fmtLen(um) {              // µm → 自動 nm / µm / mm
  const a = Math.abs(um);
  if (a >= 1000) return `${(um / 1000).toFixed(a >= 10000 ? 1 : 2)} mm`;
  if (a >= 10) return `${um.toFixed(1)} µm`;
  if (a >= 1) return `${um.toFixed(2)} µm`;
  if (a >= 0.001) return `${(um * 1000).toFixed(a >= 0.1 ? 0 : 1)} nm`;
  return `${(um * 1000).toFixed(2)} nm`;
}
export const fmtDb = (db) => (db >= 100 ? '> 100 dB' : `${db.toFixed(db < 10 ? 2 : 1)} dB`);
export const fmtPct = (e) => (e >= 0.1 ? `${(e * 100).toFixed(1)}%` : e >= 1e-4 ? `${(e * 100).toFixed(3)}%` : '≈ 0%');
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
export const DEG = Math.PI / 180;

// 簡易折線圖（座標軸＋多條曲線＋垂直線＋標記點）。spec 見下。
// spec: {xlim:[a,b], ylim:[a,b], xlabel, ylabel, series:[{x,y,color,width,dash,label}],
//        vlines:[{x,color,label,dash}], hlines:[{y,color,label,dash}], points:[{x,y,color,r,label}], xticks, yticks}
export function drawPlot(g, spec) {
  const { ctx, w, h: H } = g;
  ctx.clearRect(0, 0, w, H);
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#1a2433';
  const muted = css.getPropertyValue('--muted').trim() || '#5b6678';
  const grid = css.getPropertyValue('--line').trim() || '#d9dee8';
  const m = { l: 56, r: 14, t: 12, b: 38, ...(spec.margin || {}) };
  const pw = w - m.l - m.r, ph = H - m.t - m.b;
  const [x0, x1] = spec.xlim, [y0, y1] = spec.ylim;
  const X = (x) => m.l + ((x - x0) / (x1 - x0)) * pw;
  const Y = (y) => m.t + (1 - (y - y0) / (y1 - y0)) * ph;
  ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif';
  ctx.lineWidth = 1;
  const ticks = (a, b, n) => {
    const raw = (b - a) / n, pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= raw) || raw;
    const out = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
    return out;
  };
  const xt = spec.xticks || ticks(x0, x1, Math.max(3, Math.floor(pw / 90)));
  const yt = spec.yticks || ticks(y0, y1, Math.max(3, Math.floor(ph / 50)));
  ctx.strokeStyle = grid; ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const v of xt) { ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke(); ctx.fillText(spec.xfmt ? spec.xfmt(v) : String(v), X(v), m.t + ph + 6); }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const v of yt) { ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(m.l + pw, Y(v)); ctx.stroke(); ctx.fillText(spec.yfmt ? spec.yfmt(v) : String(v), m.l - 6, Y(v)); }
  ctx.strokeStyle = ink; ctx.strokeRect(m.l, m.t, pw, ph);
  ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
  for (const hl of spec.hlines || []) {
    ctx.strokeStyle = hl.color || muted; ctx.setLineDash(hl.dash || [5, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(hl.y)); ctx.lineTo(m.l + pw, Y(hl.y)); ctx.stroke();
  }
  for (const vl of spec.vlines || []) {
    ctx.strokeStyle = vl.color || muted; ctx.setLineDash(vl.dash || [5, 4]); ctx.beginPath(); ctx.moveTo(X(vl.x), m.t); ctx.lineTo(X(vl.x), m.t + ph); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const s of spec.series || []) {
    ctx.strokeStyle = s.color || ink; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []);
    ctx.beginPath();
    s.x.forEach((xv, i) => { const px = X(xv), py = Y(s.y[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.lineWidth = 1;
  for (const p of spec.points || []) {
    ctx.fillStyle = p.color || ink; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r || 4, 0, 6.2832); ctx.fill();
    if (p.ring) { ctx.strokeStyle = p.color || ink; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), (p.r || 4) + 3, 0, 6.2832); ctx.stroke(); }
  }
  ctx.restore();
  // 標籤（在裁切外）
  ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif';
  for (const p of spec.points || []) if (p.label) { ctx.fillStyle = p.color || ink; ctx.textAlign = p.align || 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(p.label, X(p.x) + (p.dx ?? 7), Y(p.y) + (p.dy ?? -5)); }
  for (const vl of spec.vlines || []) if (vl.label) { ctx.fillStyle = vl.color || muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(vl.label, X(vl.x) + 4, m.t + 3); }
  for (const hl of spec.hlines || []) if (hl.label) { ctx.fillStyle = hl.color || muted; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(hl.label, m.l + pw - 4, Y(hl.y) - 2); }
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  if (spec.xlabel) ctx.fillText(spec.xlabel, m.l + pw / 2, H - 2);
  if (spec.ylabel) { ctx.save(); ctx.translate(13, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'top'; ctx.fillText(spec.ylabel, 0, -6); ctx.restore(); }
  // 圖例
  let ly = m.t + 6;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const s of spec.series || []) if (s.label) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []);
    ctx.beginPath(); ctx.moveTo(m.l + pw - 150, ly + 8); ctx.lineTo(m.l + pw - 128, ly + 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ink; ctx.fillText(s.label, m.l + pw - 122, ly + 8); ly += 18;
  }
  return { X, Y, m, pw, ph };
}
