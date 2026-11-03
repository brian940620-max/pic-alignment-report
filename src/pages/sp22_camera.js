// 計畫版 2-2「機器學習影像粗對位」三頁（2026-11-02，濃縮自桌面「雙視角光纖粗對位_ML課程報告.pptx」與 報告/最終相機ML模型_報告.md）
//   1. 高倍率相機的景深：相機即時畫面隨離焦、傾斜變糊（光學估算＋示意渲染）
//   2. 雙視角 CNN 與傳統方法：拖難度 0–4 看模擬影像與合格率（ML 簡報第 22 頁的數字）
//   3. 最終相機模型：CNN 逐步改進（ML 簡報第 20 頁的圖）到最終模型 T* 94.3%
// 全部是模擬；第 1 頁的畫面是示意渲染，景深、模糊量用公式估算。
import { h, slider, segmented, fitCanvas, loop } from '../ui.js';
import { frameTask } from '../render-task.js';
import { profileConvolver } from '../camera-profile.js';

const CSS = `
.sp22 .card.dark { padding:12px 16px; }
.sp22 .k-h { font-size:19px; font-weight:800; color:#fff; margin:0 0 6px; }
.sp22 .k-ul { margin:0; padding-left:20px; font-size:16.5px; line-height:1.55; color:#e8eefb; } .sp22 .k-ul b { color:#ffd29a; }
.sp22 .src { font-size:12.5px; color:#93a6c6; line-height:1.4; }
.sp22 .cam { position:relative; background:#05080f; border-radius:10px; overflow:hidden; }
.sp22 .cam canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.sp22 .cam-hud { position:absolute; left:12px; top:10px; font-size:15px; font-weight:700; color:#fff; background:rgba(8,14,28,.7); padding:3px 10px; border-radius:99px; font-family:var(--mono); }
.sp22 .cam-stat { position:absolute; right:12px; top:10px; font-size:17px; font-weight:800; padding:4px 14px; border-radius:99px; transition:background .2s; }
.sp22 .cam-stat.ok { background:#2f9e44; color:#fff; } .sp22 .cam-stat.bad { background:#c92a2a; color:#fff; box-shadow:0 0 18px rgba(201,42,42,.6); }
.sp22 .rd { display:grid; grid-template-columns:auto 1fr; gap:2px 12px; font-size:15.5px; color:#cfd9ec; }
.sp22 .rd b { font-family:var(--mono); color:#ffb86b; text-align:right; }
.sp22 .rd b.hot { color:#ff6b6b; }
.sp22 .pipe { display:flex; align-items:center; gap:8px; justify-content:center; }
.sp22 .pipe > div { border:1.5px solid rgba(255,181,71,.6); background:rgba(140,88,10,.35); color:#fff; border-radius:10px; padding:6px 12px; text-align:center; font-size:15px; line-height:1.3; }
.sp22 .pipe > div b { display:block; font-size:16.5px; }
.sp22 .pipe > i { font-style:normal; color:#ffb547; font-size:22px; }
.sp22 .big2 { font-family:var(--mono); font-size:40px; font-weight:800; line-height:1.05; }
.sp22 .ver { display:flex; gap:6px; flex-wrap:wrap; }
.sp22 .ver button { font:inherit; font-size:14.5px; padding:5px 10px; border-radius:8px; cursor:pointer; border:1px solid rgba(190,210,245,.45); background:rgba(255,255,255,.06); color:#dfe8fa; }
.sp22 .ver button.on { background:#ffb547; color:#1a1206; border-color:#ffb547; font-weight:700; }
.sp22 .ver button.fin { border-color:#5fd068; } .sp22 .ver button.fin.on { background:#5fd068; border-color:#5fd068; }
.sp22 table.p95 { border-collapse:collapse; font-size:14.5px; color:#e8eefb; width:100%; }
.sp22 table.p95 td, .sp22 table.p95 th { border-bottom:1px solid rgba(140,170,230,.2); padding:3px 6px; text-align:center; }
.sp22 table.p95 th { color:#93a6c6; font-weight:600; }
`;

// ---------- 共用：深色長條圖 ----------
// spec: { cats:[...], series:[{name,color,vals,ghost?}], sel:index|null, ymax, label? }
function drawBars(g, spec) {
  const { ctx, w, h: H } = g;
  if (!w) return;
  ctx.clearRect(0, 0, w, H);
  const m = { l: 44, r: 10, t: 46, b: 34 }, pw = w - m.l - m.r, ph = H - m.t - m.b;
  const Y = (v) => m.t + ph * (1 - v / spec.ymax);
  ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textBaseline = 'middle';
  for (let v = 0; v <= spec.ymax; v += 20) {
    ctx.strokeStyle = 'rgba(140,170,230,.15)'; ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(w - m.r, Y(v)); ctx.stroke();
    ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'right'; ctx.fillText(v, m.l - 6, Y(v));
  }
  const nC = spec.cats.length, nS = spec.series.length, cw = pw / nC, bw = Math.min(46, (cw * 0.78) / nS);
  spec.cats.forEach((c, i) => {
    const x0 = m.l + cw * i + (cw - bw * nS) / 2;
    if (spec.sel === i) { ctx.fillStyle = 'rgba(144,202,209,.07)'; ctx.beginPath(); ctx.roundRect(m.l + cw * i + 2, m.t - 22, cw - 4, ph + 26, 8); ctx.fill(); }
    spec.series.forEach((s, k) => {
      const v = s.vals[i], x = x0 + bw * k;
      const gradient = ctx.createLinearGradient(0, m.t, 0, Y(0));
      gradient.addColorStop(0, s.color); gradient.addColorStop(1, s.color + '60');
      ctx.fillStyle = gradient; ctx.globalAlpha = spec.sel == null || spec.sel === i ? 1 : 0.42;
      const barHeight = Y(0) - Y(v);
      ctx.beginPath(); ctx.roundRect(x + 2, Y(v), bw - 4, barHeight, [Math.min(5, barHeight / 2), Math.min(5, barHeight / 2), 0, 0]); ctx.fill(); ctx.globalAlpha = 1;
      // Outline beyond the bar so the baseline remains visible even after improvement.
      if (s.ghost) { ctx.strokeStyle = '#a3b9cb88'; ctx.setLineDash([4, 4]); ctx.strokeRect(x - 3, Y(s.ghost[i]), bw + 6, Y(0) - Y(s.ghost[i])); ctx.setLineDash([]); }
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '600 12.5px system-ui, "Microsoft JhengHei", sans-serif';
      ctx.fillText(v >= 99.95 ? '100' : v < 10 ? v.toFixed(1) : v.toFixed(v % 1 ? 1 : 0), x + bw / 2, Y(v) - 9);
    });
    ctx.fillStyle = spec.sel === i ? '#ffb86b' : '#cfd9ec'; ctx.font = '600 14px system-ui, "Microsoft JhengHei", sans-serif';
    ctx.fillText(c, m.l + cw * i + cw / 2, H - m.b + 16);
  });
  if (spec.label) { ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = '#93a6c6'; ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillText(spec.label, 0, 0); ctx.restore(); }
  // 圖例
  let lx = m.l + 4;
  ctx.font = '13.5px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left';
  for (const s of spec.series) { ctx.fillStyle = s.color; ctx.fillRect(lx, 7, 14, 12); ctx.fillStyle = '#dfe8fa'; ctx.fillText(s.name, lx + 19, 13); lx += 28 + ctx.measureText(s.name).width; }
}

// ---------- 第 1 頁：相機光學 ----------
// 物鏡 NA 取 Mitutoyo M Plan Apo 型錄值；景深 DOF = λ/(2NA²)（同型錄的定義，λ = 0.55 µm）；感測器 FLIR CM3 像素 3.69 µm。
const LAMBDA = 0.55, PIX = 3.69;
const LENS = { 2: { na: 0.055 }, 5: { na: 0.14 }, 10: { na: 0.28 } };
const VW = 480, VH = 240, GAP = 10, R = 62.5, CORE = 4.5;   // 示意視野、尖端到晶片間隙、光纖半徑、纖芯半徑（µm）
const dofOf = (M) => LAMBDA / (2 * LENS[M].na ** 2);
// 物方模糊（高斯 σ，µm）：繞射 σ ≈ 0.21λ/NA；離焦 δ 的幾何模糊圓直徑 ≈ 2·NA·|δ|，σ ≈ 直徑/4
const sigmaOf = (M, dz) => { const na = LENS[M].na, sd = 0.21 * LAMBDA / na, sg = (2 * na * Math.abs(dz)) / 4; return Math.hypot(sd, sg); };

// 光纖的截面亮度（y 方向，示意）：背景、包層、兩條亮邊、纖芯
function fiberProfile(y) {
  const a = Math.abs(y);
  let v = 0.08;
  if (a <= R) v = 0.2 + (a < CORE ? 0.12 : 0) + (Math.abs(a - CORE) < 0.6 ? 0.1 : 0);
  if (Math.abs(a - R) < 1.2) v = 0.95;
  if (Math.abs(a - (R - 7)) < 0.8) v = Math.max(v, 0.38);
  return v;
}

function drawFiber(ctx, s, xa, xb, tipX = xb) {
  // Tapered glass body with a rounded lens apex; dimensions are illustrative.
  ctx.save(); ctx.translate(VW / 2 * s, VH / 2 * s); ctx.scale(s, s);
  const shoulder = tipX - 108, lens = tipX - 8;
  const outline = () => {
    ctx.beginPath(); ctx.moveTo(xa, -R); ctx.lineTo(shoulder, -R);
    ctx.bezierCurveTo(shoulder + 25, -R, lens - 27, -12, lens, -8);
    ctx.bezierCurveTo(tipX + 2.7, -8, tipX + 2.7, 8, lens, 8);
    ctx.bezierCurveTo(lens - 27, 12, shoulder + 25, R, shoulder, R);
    ctx.lineTo(xa, R); ctx.closePath();
  };
  const glass = ctx.createLinearGradient(0, -R, 0, R);
  glass.addColorStop(0, '#c9e3eb'); glass.addColorStop(.05, '#6c919f');
  glass.addColorStop(.2, '#2c4658'); glass.addColorStop(.48, '#608492');
  glass.addColorStop(.54, '#8faeaf'); glass.addColorStop(.75, '#253e50'); glass.addColorStop(1, '#9dbdc8');
  outline(); ctx.fillStyle = glass; ctx.fill(); ctx.strokeStyle = '#d6e9ed'; ctx.lineWidth = .85; ctx.stroke();
  ctx.save(); outline(); ctx.clip();
  ctx.fillStyle = '#e6cd9e35'; ctx.fillRect(xa, -CORE, tipX - xa, CORE * 2);
  ctx.strokeStyle = '#f2d2a6aa'; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.moveTo(xa, 0); ctx.lineTo(lens, 0); ctx.stroke();
  ctx.strokeStyle = '#e7f4f578'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xa, -R + 9); ctx.lineTo(shoulder, -R + 9);
  ctx.bezierCurveTo(shoulder + 26, -R + 9, lens - 30, -10, lens - 4, -6); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#fff2dc'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(lens, -8); ctx.bezierCurveTo(tipX + 2.7, -8, tipX + 2.7, 8, lens, 8); ctx.stroke();
  ctx.restore();
}

// Microscope-style illustration, not a photograph or a specific foundry layout.
// Geometry and texture are cached with the in-focus PIC layer.
function drawPIC(ctx, s) {
  ctx.save(); ctx.translate(VW / 2 * s, VH / 2 * s); ctx.scale(s, s);
  const edge = GAP / 2, end = VW / 2 + 20, top = -88, bottom = 88;
  let seed = 22017;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.save(); ctx.beginPath(); ctx.rect(edge, top, end - edge, bottom - top); ctx.clip();
  const silicon = ctx.createLinearGradient(edge, top, end, bottom);
  silicon.addColorStop(0, '#77797c'); silicon.addColorStop(.3, '#52555a');
  silicon.addColorStop(.72, '#3c4046'); silicon.addColorStop(1, '#595d62');
  ctx.fillStyle = silicon; ctx.fillRect(edge, top, end - edge, bottom - top);
  // Low-contrast surface grain, without the previous diagram grid.
  for (let i = 0; i < 6500; i++) {
    const x = edge + random() * (end - edge), y = top + random() * (bottom - top);
    ctx.fillStyle = i % 2 ? '#f1f2f30a' : '#06080b12';
    ctx.fillRect(x, y, .18 + random() * .55, .16 + random() * .3);
  }
  // Oxide openings and etched waveguide paths: thin, recessed, unlit.
  for (const y of [-32, 0, 32]) {
    ctx.fillStyle = '#23282e'; ctx.fillRect(edge + 3, y - 3.8, end - edge, 7.6);
    ctx.strokeStyle = '#acafb26b'; ctx.lineWidth = .45;
    ctx.strokeRect(edge + 3, y - 3.8, end - edge, 7.6);
    ctx.fillStyle = '#83888d'; ctx.beginPath();
    ctx.moveTo(edge + 3, y - 2.7); ctx.lineTo(edge + 68, y - 1.6);
    ctx.lineTo(end, y - 1.6); ctx.lineTo(end, y + 1.6);
    ctx.lineTo(edge + 68, y + 1.6); ctx.lineTo(edge + 3, y + 2.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d5d7d9'; ctx.lineWidth = .55;
    ctx.beginPath(); ctx.moveTo(edge + 3, y); ctx.lineTo(edge + 90, y); ctx.lineTo(end, y); ctx.stroke();
  }
  // Metal routing and recessed passivation windows around bonding pads.
  for (const row of [-1, 1]) for (let col = 0; col < 3; col++) {
    const x = edge + 74 + col * 57, y = row < 0 ? -78 : 50;
    const routeY = row * (17 + col * 3);
    ctx.strokeStyle = '#1a1d22'; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(x + 17, y + 12); ctx.lineTo(x + 17, routeY);
    ctx.lineTo(x + 39, routeY); ctx.stroke();
    ctx.strokeStyle = '#a5a6a7'; ctx.lineWidth = 1.9; ctx.stroke();
    ctx.fillStyle = '#24272c'; ctx.fillRect(x - 2, y - 2, 39, 28);
    const metal = ctx.createLinearGradient(x, y, x + 35, y + 24);
    metal.addColorStop(0, '#d7d8d8'); metal.addColorStop(.18, '#aaabad');
    metal.addColorStop(.65, '#8a8d90'); metal.addColorStop(1, '#c3c5c7');
    ctx.fillStyle = metal; ctx.fillRect(x, y, 35, 24);
    ctx.strokeStyle = '#f4f4f480'; ctx.lineWidth = .6; ctx.strokeRect(x + .7, y + .7, 33.6, 22.6);
    ctx.strokeStyle = '#55595f'; ctx.strokeRect(x + 3.2, y + 3.2, 28.6, 17.6);
    ctx.strokeStyle = '#eeeeee15'; ctx.lineWidth = .35;
    for (let k = 0; k < 12; k++) {
      const sy = y + 4 + k * 1.35; ctx.beginPath(); ctx.moveTo(x + 4, sy); ctx.lineTo(x + 31, sy + .35); ctx.stroke();
    }
  }
  // Small lithographic registration marks, set back from the polished edge.
  for (const y of [-63, 63]) {
    ctx.strokeStyle = '#24282d'; ctx.lineWidth = 1.6; ctx.strokeRect(edge + 21, y - 6, 12, 12);
    ctx.strokeStyle = '#c7c9cb'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(edge + 27, y - 10); ctx.lineTo(edge + 27, y + 10);
    ctx.moveTo(edge + 17, y); ctx.lineTo(edge + 37, y); ctx.stroke();
  }
  // Diced edge: a narrow dark facet and intermittent specular highlights.
  const facet = ctx.createLinearGradient(edge, 0, edge + 4.5, 0);
  facet.addColorStop(0, '#c5c7c9'); facet.addColorStop(.18, '#606369');
  facet.addColorStop(.5, '#292e35'); facet.addColorStop(1, '#92969b');
  ctx.fillStyle = facet; ctx.fillRect(edge, top, 4.5, bottom - top);
  for (let y = top; y < bottom; y += .75) {
    ctx.fillStyle = random() > .5 ? '#e1e2e370' : '#11151b80';
    ctx.fillRect(edge + random() * 1.2, y, .3 + random() * 1.7, .2 + random() * .5);
  }
  for (const y of [-32, 0, 32]) {
    ctx.fillStyle = '#20252c'; ctx.fillRect(edge, y - 3, 4.5, 6);
    ctx.fillStyle = '#c4c9cd'; ctx.fillRect(edge + .6, y - 1.4, 3.9, 2.8);
  }
  ctx.strokeStyle = '#c5c8cb90'; ctx.lineWidth = .6;
  ctx.beginPath(); ctx.moveTo(edge, top); ctx.lineTo(end, top); ctx.stroke();
  ctx.restore(); ctx.restore();
}

function camSlide(body) {
  const st = { M: 10, dz: 4, th: 0, play: false, t: 0 };
  const requestDraw = frameTask(draw);
  const dy = 0.25, ys = Array.from({ length: 761 }, (_, i) => -95 + i * dy);
  const convolve = profileConvolver(ys.map(fiberProfile), dy), references = new Map();
  let imageKey = '', profileKey = '', currentProfile;
  // Presentation gain applies only to defocus, never to the optical estimates.
  const displaySigma = (M, dz) => sigmaOf(M, dz * 5);
  const cv = h('canvas', { 'aria-label': '透鏡光纖對 PIC：焦面固定於晶片，僅光纖隨離焦量變模糊' }), prof = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
  const hud = h('div', { class: 'cam-hud' }), stat = h('div', { class: 'cam-stat ok' });
  const buf = document.createElement('canvas'), bx = buf.getContext('2d');
  const mov = document.createElement('canvas'), mx = mov.getContext('2d');
  const bg = document.createElement('canvas'), gx = bg.getContext('2d');
  const refImage = document.createElement('canvas'), rx = refImage.getContext('2d');
  const fixedImage = document.createElement('canvas'), fx = fixedImage.getContext('2d');
  let opticalKey = '';
  const detailCanvases = [h('canvas'), h('canvas')];
  const details = detailCanvases.map(c => fitCanvas(c, requestDraw));
  let bgKey = '';
  const G = fitCanvas(cv, requestDraw), P = fitCanvas(prof, requestDraw);

  const rd = {};
  const row = (k, label) => [h('span', null, label), (rd[k] = h('b'))];
  const readout = h('div', { class: 'rd' }, ...row('px', '每像素'), ...row('dof', '景深（±一半）'), ...row('tip', '端面離焦'), ...row('blur', '估算模糊圈直徑'), ...row('dh', '畫面內前後高低差'), ...row('edge', '示意亮邊銳利度'));
  const effectNote = h('div', { class: 'camera-effect-note' });
  const featureState = h('div', { class: 'camera-feature-state', role: 'status', 'aria-live': 'polite' });

  const tipX = -GAP / 2;
  const dzAt = (x) => st.dz + (tipX - x) * Math.tan((st.th * Math.PI) / 180);   // 俯仰傾斜：越往後端離焦越多
  function makeBg(N, Hh, s) {   // 背景（焦外的雜散光斑＋固定雜訊），換倍率才重做
    const key = `${N}x${Hh}`; if (key === bgKey) return; bgKey = key;
    bg.width = N; bg.height = Hh;
    const gr = gx.createRadialGradient(N * 0.5, Hh * 0.45, 10, N * 0.5, Hh * 0.5, N * 0.7);
    gr.addColorStop(0, '#142737'); gr.addColorStop(1, '#070f1c'); gx.fillStyle = gr; gx.fillRect(0, 0, N, Hh);
    gx.filter = `blur(${Math.max(2, 18 * s)}px)`;
    for (const [x, y, r, a] of [[0.18, 0.2, 40, 0.10], [0.72, 0.82, 55, 0.08], [0.88, 0.15, 30, 0.07]]) { gx.fillStyle = `rgba(200,205,215,${a})`; gx.beginPath(); gx.arc(x * N, y * Hh, r * s, 0, 7); gx.fill(); }
    gx.filter = 'none';
    const img = gx.getImageData(0, 0, N, Hh), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 2; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    gx.putImageData(img, 0, 0);
  }

  function draw() {
    if (!G.w) return;
    const M = st.M, p = PIX / M, s = 1 / p;                        // 每像素 µm、每 µm 幾像素（感測器解析度渲染）
    const N = Math.round(VW * s), Hh = Math.round(VH * s);
    if (buf.width !== N || buf.height !== Hh) { buf.width = N; buf.height = Hh; mov.width = N; mov.height = Hh; }
    makeBg(N, Hh, s);
    // Cache the fixed optical image and sharp moving fiber until magnification changes.
    if (opticalKey !== `${M}:${N}:${Hh}`) {
      opticalKey = `${M}:${N}:${Hh}`;
      fixedImage.width = refImage.width = N; fixedImage.height = refImage.height = Hh;
      mx.clearRect(0, 0, N, Hh); drawPIC(mx, s);
      fx.filter = `blur(${(sigmaOf(M, 0) * s).toFixed(2)}px)`; fx.drawImage(mov, 0, 0); fx.filter = 'none';
      mx.clearRect(0, 0, N, Hh); drawFiber(mx, s, -VW / 2 - 20, tipX, tipX);
      rx.drawImage(bg, 0, 0);
      rx.filter = `blur(${sigmaOf(M, 0) * s}px)`; rx.drawImage(mov, 0, 0); rx.filter = 'none';
      rx.drawImage(fixedImage, 0, 0);
    }
    const nextImageKey = `${M}:${st.dz}:${st.th}`;
    if (imageKey !== nextImageKey) {
      imageKey = nextImageKey;
      bx.filter = 'none'; bx.drawImage(bg, 0, 0);
      // At zero tilt the blur is uniform: one pass is identical to 24 clipped passes.
      const K = st.th === 0 ? 1 : 24, xL = -VW / 2;
      for (let k = 0; k < K; k++) {
        const xa = xL + ((tipX - xL) * k) / K, xb = xL + ((tipX - xL) * (k + 1)) / K;
        const sg = displaySigma(M, dzAt((xa + xb) / 2)) * s;
        bx.save(); bx.beginPath();
        // 段界取整數像素、首尾相接不重疊（重疊會畫兩次變亮線）
        const c0 = k === 0 ? 0 : Math.round((xa + VW / 2) * s), c1 = k === K - 1 ? N : Math.round((xb + VW / 2) * s);
        bx.rect(c0, 0, c1 - c0, Hh); bx.clip();
        bx.filter = `blur(${sg.toFixed(2)}px)`; bx.drawImage(mov, 0, 0); bx.restore();
      }
      bx.filter = 'none';
      // Composite the sharp PIC last: defocus applies only to the fiber layer.
      bx.drawImage(fixedImage, 0, 0);
    }

    // Crop around the fiber core and PIC input port using the same physical area.
    details.forEach((g, i) => {
      if (!g.w || !g.h) return;
      const dc = g.ctx, scale = Math.min(g.w / 140, g.h / 64), dw = 140 * scale, dh = 64 * scale, ox = (g.w - dw) / 2, oy = (g.h - dh) / 2;
      dc.fillStyle = '#080f1b'; dc.fillRect(0, 0, g.w, g.h);
      dc.imageSmoothingEnabled = true;
      dc.filter = 'grayscale(1)';
      dc.drawImage(i ? buf : refImage, (VW / 2 - 85) * s, (VH / 2 - 32) * s, 140 * s, 64 * s, ox, oy, dw, dh);
      dc.filter = 'none';
      dc.strokeStyle = '#72d6cb'; dc.lineWidth = 1;
      const px = ox + (85 + GAP / 2) * scale, py = oy + dh / 2;
      dc.beginPath(); dc.moveTo(px + 7, py - 13); dc.lineTo(px + 13, py - 13); dc.lineTo(px + 13, py - 7);
      dc.moveTo(px + 7, py + 13); dc.lineTo(px + 13, py + 13); dc.lineTo(px + 13, py + 7); dc.stroke();
    });

    // 顯示：保持比例置中；低倍率時用最近鄰放大，看得到像素
    const { ctx, w, h: H } = G;
    if (w) {
      ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, w, H);
      const sc = Math.min(w / N, H / Hh), dw = N * sc, dh = Hh * sc, ox = (w - dw) / 2, oy = (H - dh) / 2;
      ctx.imageSmoothingEnabled = sc < 1; ctx.filter = 'grayscale(1)'; ctx.drawImage(buf, ox, oy, dw, dh); ctx.filter = 'none';
      // 比例尺 50 µm
      const sb = 50 * s * sc; ctx.fillStyle = '#fff'; ctx.fillRect(ox + 18, oy + dh - 26, sb, 4);
      ctx.font = '600 14px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('50 µm', ox + 18, oy + dh - 30);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '13.5px system-ui, "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'left'; ctx.fillStyle = '#f1d4ad';
      ctx.fillText('透鏡光纖', ox + 18, oy + 65);
      ctx.fillStyle = '#9ee4db'; ctx.fillText('PIC · 固定焦面', ox + dw * .59, oy + 65);
      ctx.strokeStyle = '#83c7cf66'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.strokeRect(ox + (VW / 2 - 85) * s * sc, oy + (VH / 2 - 32) * s * sc, 140 * s * sc, 64 * s * sc); ctx.setLineDash([]);
      const portX = ox + (VW / 2 + GAP / 2) * s * sc, portY = oy + dh / 2;
      ctx.strokeStyle = '#8de0d3'; ctx.beginPath();
      ctx.moveTo(portX + 9, portY - 12); ctx.lineTo(portX + 20, portY - 12); ctx.lineTo(portX + 20, portY + 12); ctx.lineTo(portX + 9, portY + 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(portX + 20, portY + 12); ctx.lineTo(portX + 44, portY + 43); ctx.lineTo(portX + 128, portY + 43); ctx.stroke();
      ctx.fillStyle = '#b7eee4'; ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillText('入光口 · 對焦基準', portX + 46, portY + 39);
      ctx.fillStyle = '#9aaec2'; ctx.fillText(`尖端間隙 ${GAP} µm · 幾何示意`, ox + 18, oy + dh - 8);
    }

    // 數字
    const dof = dofOf(M), dTip = Math.abs(dzAt(tipX)), inF = dTip <= dof / 2;
    const dh = Math.abs((tipX + VW / 2) * Math.tan((st.th * Math.PI) / 180));
    hud.textContent = `上視顯微示意  /  ${M}X  /  NA ${LENS[M].na}`;
    effectNote.textContent = '失焦效果 ×5 · 示意強化；光學讀值維持原估算';
    stat.className = `cam-stat ${inF ? 'ok' : 'bad'}`;
    stat.textContent = inF ? '光纖在焦 · PIC 清晰' : `僅光纖失焦 · ${st.dz > 0 ? '+' : ''}${st.dz.toFixed(1)} µm`;
    rd.px.textContent = `${p.toFixed(2)} µm/px`;
    rd.dof.textContent = `±${(dof / 2).toFixed(dof < 10 ? 2 : 1)} µm`;
    rd.tip.textContent = `${dTip.toFixed(1)} µm`; rd.tip.classList.toggle('hot', !inF);
    rd.blur.textContent = `${(2 * LENS[M].na * dTip).toFixed(1)} µm`;
    rd.dh.textContent = `${dh.toFixed(1)} µm`; rd.dh.classList.toggle('hot', dh > dof / 2);

    // Approximate shaft profile, 140 µm behind the lens apex (outside the taper).
    if (!references.has(M)) references.set(M, convolve(sigmaOf(M, 0), p));
    const sig = displaySigma(M, dzAt(tipX - 140)), nextProfileKey = `${M}:${sig}`;
    if (profileKey !== nextProfileKey) { currentProfile = convolve(sig, p); profileKey = nextProfileKey; }
    const ref = references.get(M), cur = currentProfile;
    const slope = (a) => { let m = 0; for (let i = 1; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - a[i - 1])); return m; };
    const sharp = slope(cur) / slope(ref);
    rd.edge.textContent = `${(sharp * 100).toFixed(0)}%`; rd.edge.classList.toggle('hot', sharp < 0.5);
    const message = sharp < .3 ? 'PIC 焦面固定｜光纖輪廓擴散，尖端定位更困難' : sharp < .7 ? 'PIC 焦面固定｜光纖邊緣對比下降' : 'PIC 焦面固定｜透鏡光纖輪廓清晰';
    if (featureState.textContent !== message) featureState.textContent = message;
    featureState.classList.toggle('degraded', sharp < .7);
    const { ctx: pc, w: pw, h: ph } = P;
    if (pw) {
      pc.clearRect(0, 0, pw, ph);
      const m = { l: 10, r: 10, t: 22, b: 20 }, X = (y) => m.l + ((y + 95) / 190) * (pw - m.l - m.r), Yv = (v) => m.t + (1 - v) * (ph - m.t - m.b);
      pc.font = '12.5px system-ui, "Microsoft JhengHei", sans-serif'; pc.textBaseline = 'middle';
      for (const yy of [-R, R]) { pc.strokeStyle = 'rgba(140,170,230,.3)'; pc.beginPath(); pc.moveTo(X(yy), m.t); pc.lineTo(X(yy), ph - m.b); pc.stroke(); }
      const line = (arr, col, dash, lwd) => { pc.strokeStyle = col; pc.lineWidth = lwd; pc.setLineDash(dash); pc.beginPath(); arr.forEach((v, i) => (i ? pc.lineTo(X(ys[i]), Yv(v)) : pc.moveTo(X(ys[i]), Yv(v)))); pc.stroke(); pc.setLineDash([]); pc.lineWidth = 1; };
      line(ref, 'rgba(220,228,245,.6)', [5, 4], 1.4); line(cur, '#efc28c', [], 2.4);
      pc.fillStyle = '#dfe8fa'; pc.textAlign = 'left'; pc.fillText('光纖本體剖面 · 虛線在焦／橘線目前', m.l, 9);
      pc.fillStyle = '#93a6c6'; pc.textAlign = 'center'; pc.fillText('尖端後方 140 µm · 簡化亮度估算', (X(-R) + X(R)) / 2, ph - 8);
    }
  }

  const segM = segmented([{ id: '2', label: '2X' }, { id: '5', label: '5X' }, { id: '10', label: '10X' }], '10', (id) => { st.M = +id; requestDraw(); });
  const sDz = slider({ label: '光纖離開 PIC 焦面 Δz', min: -40, max: 40, step: 0.5, value: st.dz, unit: 'µm', onInput: (v) => { if (st.play) bPlay.click(); st.dz = v; requestDraw(); } });
  const sTh = slider({ label: '俯仰傾斜（手裝可達 ±5°）', min: -5, max: 5, step: 0.1, value: 0, unit: '°', onInput: (v) => { if (st.play) bPlay.click(); st.th = v; requestDraw(); } });
  const anim = loop((dt) => { st.t += dt; sDz.set(12 * Math.sin(st.t * 1.6) + 4 * Math.sin(st.t * 3.7), true); st.dz = sDz.get(); requestDraw.flush(); });
  const bPlay = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => { st.play = !st.play; bPlay.setAttribute('aria-pressed', String(st.play)); bPlay.textContent = st.play ? 'Ⅱ 暫停晃動' : '▶ 播放：光纖上下晃 ±16 µm'; st.play ? anim.start() : anim.stop(); } }, '▶ 播放：光纖上下晃 ±16 µm');
  const bZero = h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (st.play) bPlay.click(); sDz.set(0); sTh.set(0); } }, '歸零');
  const bSmall = h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (st.play) bPlay.click(); sTh.set(0, true); st.th = 0; sDz.set(8); } }, '微偏 8 µm');

  body.append(h('div', { class: 'camera-layout grow' },
    h('div', { class: 'camera-visual col' },
      h('div', { class: 'cam fill' }, cv, hud, h('div', { class: 'camera-focus-lock' }, '◎ 焦點鎖定 PIC'), stat),
      h('div', { class: 'camera-detail' }, ...detailCanvases.map((c, i) => h('figure', { class: 'camera-crop' }, h('figcaption', null, h('span', null, i ? '02  目前光纖' : '01  在焦參考'), h('small', null, 'PIC 焦面固定')), h('div', { class: 'camera-crop-canvas' }, c)))), featureState),
    h('div', { class: 'col camera-controls' },
      h('div', { class: 'card dark col' },
        h('div', { class: 'k-h' }, '透鏡光纖 · 離焦與傾斜'),
        h('div', { class: 'camera-optical-toolbar' }, segM.el), effectNote,
        sDz.el, sTh.el,
        h('div', { class: 'row camera-focus-actions' }, bPlay, bSmall, bZero), readout),
      h('div', { class: 'card dark camera-profile' }, prof),
      h('div', { class: 'camera-takeaway' }, h('b', null, '相機對焦 PIC，觀察光纖離焦'),
        h('p', null, '晶片與入光口維持清晰；光纖離開焦面時，透鏡尖端與玻璃輪廓逐漸模糊。'),
        h('span', null, '透鏡與波導幾何為示意；焦面清晰不代表耦合最佳，仍需光功率精對位。')))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp22', 'camera-ui', 'camera-optics');
  requestDraw();
  return { show() { G.apply(); P.apply(); details.forEach(g => g.apply()); requestDraw(); }, hide() { if (st.play) bPlay.click(); requestDraw.cancel(); } };
}

// ---------- 第 2 頁：雙視角 CNN vs 傳統 ----------
// 合格＝XY ±40 µm、間隙 ±50 µm、傾斜 ±2.5°；ML 簡報第 22 頁（五軸，同一測試集、每難度同一組姿態）
const PASS = { trad: [99.0, 96.0, 54.3, 4.8, 0.2], cnn: [100.0, 100.0, 100.0, 99.8, 99.7] };
const DIFF_TXT = ['乾淨影像', '輕微：開始模糊、對比下降、雜訊', '中等：再加反光條紋與髒污', '嚴重：背景亮塊與長條干擾', '最嚴重：三種退化都加到最強'];

function cnnSlide(body) {
  let d = 0, timer = null;
  const requestPaint = frameTask(paint);
  const img = new Image(); img.src = 'assets/ml_difficulty_0to4.jpg';
  const cTop = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), cSide = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
  const T = fitCanvas(cTop, requestPaint), S = fitCanvas(cSide, requestPaint);
  const bars = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), B = fitCanvas(bars, requestPaint);
  const dTxt = h('div', { style: { fontSize: '17px', color: '#ffd29a', fontWeight: 700 } });
  const nT = h('div', { class: 'big2', style: { color: '#9fb0c8' } }), nC = h('div', { class: 'big2', style: { color: '#efc28c' } });
  const crop = (g, row) => { const { ctx, w, h: H } = g; if (!w || !img.complete || !img.naturalWidth) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, H);
    const sw = 399, sh = 200, sc = Math.min(w / sw, H / sh), dw = sw * sc, dh = sh * sc;
    ctx.drawImage(img, d * 414, row ? 214 : 0, sw, sh, (w - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.font = '700 14px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillStyle = '#ffe066'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(row ? '側視（看 Y、俯仰）' : '上視（看 X、偏擺）', (w - dw) / 2 + 8, (H - dh) / 2 + 6); };
  function paint() {
    crop(T, 0); crop(S, 1);
    drawBars(B, { cats: ['難度 0', '1', '2', '3', '4'], sel: d, ymax: 100, label: '合格率 %',
      series: [{ name: '傳統（找邊＋擬合）', color: '#829bb4', vals: PASS.trad }, { name: '雙視角 CNN', color: '#efc28c', vals: PASS.cnn }] });
    dTxt.textContent = `難度 ${d}：${DIFF_TXT[d]}`;
    nT.textContent = `${PASS.trad[d].toFixed(1)}%`; nC.textContent = `${PASS.cnn[d].toFixed(1)}%`;
  }
  img.onload = requestPaint;
  const seg = segmented([0, 1, 2, 3, 4].map((k) => ({ id: String(k), label: `難度 ${k}` })), '0', (id) => { d = +id; requestPaint(); });
  const stop = () => { clearInterval(timer); timer = null; bPlay.textContent = '▶ 自動 0 → 4'; };
  const bPlay = h('button', { type: 'button', class: 'btn', onclick: () => { if (timer) return stop(); bPlay.textContent = '■ 停止'; d = -1;
    const tick = () => { d = (d + 1) % 5; seg.set(String(d), true); requestPaint(); if (d === 4) stop(); }; tick(); timer = setInterval(tick, 1400); } }, '▶ 自動 0 → 4');

  body.append(
    h('div', { class: 'pipe', style: { flex: 'none' } },
      h('div', null, h('b', null, '上視＋側視'), '兩台相機各一張'), h('i', null, '➜'),
      h('div', null, h('b', null, '雙分支 CNN'), '各 6 層卷積，合併後回歸'), h('i', null, '➜'),
      h('div', null, h('b', null, 'dx、dy、間隙、俯仰、偏擺'), '＋每軸不確定度'), h('i', null, '➜'),
      h('div', { style: { borderColor: 'rgba(95,208,104,.7)', background: 'rgba(40,110,52,.45)' } }, h('b', null, '交給光訊號精對位'), 'XY ±40 µm、間隙 ±50 µm、傾斜 ±2.5° 內')),
    h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.1fr 1fr' } },
      h('div', { class: 'card dark col', style: { gap: '6px' } },
        h('div', { class: 'row' }, seg.el, bPlay), dTxt,
        h('div', { class: 'fill', style: { display: 'grid', gridTemplateRows: '1fr 1fr', gap: '6px' } },
          ...[cTop, cSide].map((c) => { c.style.position = 'absolute'; c.style.inset = '0'; return h('div', { style: { position: 'relative', minHeight: '0' } }, c); }))),
      h('div', { class: 'col' },
        h('div', { class: 'card dark', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center' } },
          h('div', null, h('div', { style: { color: '#cfd9ec' } }, '傳統方法'), nT), h('div', null, h('div', { style: { color: '#cfd9ec' } }, '雙視角 CNN'), nC)),
        h('div', { class: 'card dark fill', style: { padding: '6px 8px' } }, bars),
        h('div', { class: 'card dark' },
          h('ul', { class: 'k-ul' },
            h('li', null, h('b', null, '乾淨影像傳統方法就夠準：'), '誤差比 CNN 小 6–9 倍'),
            h('li', null, h('b', null, '影像一變差傳統先崩：'), '難度 2 剩 54%、難度 3 剩 5%；拆解後主因是背景干擾，不是雜訊'),
            h('li', null, h('b', null, 'CNN 在難度 4 仍 99.7% 合格'), '→ ML 的價值是退化影像下的穩健性'))))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp22', 'camera-ui', 'camera-compare');
  return { show() { requestPaint(); }, hide() { stop(); requestPaint.cancel(); } };
}

// ---------- 第 3 頁：最終相機模型 ----------
// 前四版：ML 簡報第 20 頁（嚴格範圍達標率，同一測試集）；最終：最終測試集 T*（3000 姿態，只評估一次）
const VERS = [
  { name: '基準', vals: [69, 59, 43, 20, 6], note: '雙分支 CNN，高斯負對數概似損失' },
  { name: 'Student-t 損失', vals: [86, 77, 60, 27, 8], note: '改用 Student-t 損失：對離群值不敏感' },
  { name: '＋鏡射增強', vals: [97, 97, 88, 68, 27], note: '上下翻轉影像並把對應標籤變號，資料多一倍：主要的進步來源' },
  { name: '＋超參數最佳化', vals: [98, 97, 95, 82, 48], note: 'batch 16、dropout 0.49、AdamW、dense 256（GWO 與隨機搜尋找到的設定相當）' },
  { name: '最終模型', vals: [100, 100, 99.2, 94.8, 77.5], fin: true, note: '再加大第一層卷積核、多一層卷積、隨機平移與亮度擾動；推論時 4 種翻轉取平均。在最終測試集 T* 只評估一次' },
];

function finalSlide(body) {
  let v = 0, cur = VERS[0].vals.slice(), from = cur.slice(), t0 = 0, timer = null;
  const bars = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), B = fitCanvas(bars, () => paint());
  const note = h('div', { style: { fontSize: '16px', color: '#e8eefb', minHeight: '48px' } });
  const avg = h('div', { class: 'big2', style: { color: '#efc28c' } });
  const btns = VERS.map((q, k) => h('button', { type: 'button', class: q.fin ? 'fin' : '', onclick: () => pick(k) }, `${k + 1}. ${q.name}`));
  const anim = loop(() => { const a = Math.min(1, (performance.now() - t0) / 600), e = a * a * (3 - 2 * a);
    cur = from.map((x, i) => x + (VERS[v].vals[i] - x) * e); paint(); if (a >= 1) anim.stop(); });
  function paint() {
    drawBars(B, { cats: ['難度 0', '1', '2', '3', '4'], sel: null, ymax: 100, label: '嚴格範圍達標率 %',
      series: [{ name: VERS[v].name, color: VERS[v].fin ? '#93d8bd' : '#efc28c', vals: cur, ghost: v ? VERS[0].vals : null }] });
  }
  function pick(k) {
    v = k; from = cur.slice(); t0 = performance.now(); anim.start();
    btns.forEach((b, i) => { b.classList.toggle('on', i === k); b.setAttribute('aria-pressed', String(i === k)); });
    note.textContent = VERS[k].note;
    const m = VERS[k].vals.reduce((a, b) => a + b, 0) / 5;
    avg.textContent = `${m.toFixed(1)}%`; avg.style.color = VERS[k].fin ? '#93d8bd' : '#efc28c';
  }
  const stop = () => { clearInterval(timer); timer = null; bPlay.textContent = '▶ 一步步播放'; };
  const bPlay = h('button', { type: 'button', class: 'btn', onclick: () => { if (timer) return stop(); bPlay.textContent = '■ 停止'; let k = 0; pick(0);
    timer = setInterval(() => { k++; pick(k); if (k === VERS.length - 1) stop(); }, 1600); } }, '▶ 一步步播放');
  const p95 = h('table', { class: 'p95' },
    h('tr', null, h('th', null, '難度'), h('th', null, 'dx'), h('th', null, 'dy'), h('th', null, '間隙'), h('th', null, '傾斜')),
    h('tr', null, h('td', null, '0（乾淨）'), h('td', null, '3.3'), h('td', null, '2.3'), h('td', null, '4.8'), h('td', null, '0.21°')),
    h('tr', null, h('td', null, '4（最差）'), h('td', null, '13.0'), h('td', null, '10.5'), h('td', null, '12.7'), h('td', null, '0.60°')),
    h('tr', null, h('td', null, '規格'), h('td', { colspan: 2 }, '±40'), h('td', null, '±50'), h('td', null, '±2.5°')));

  body.append(h('div', { class: 'final-layout grow' },
    h('aside', { class: 'card dark col final-steps' },
      h('div', { class: 'eyebrow' }, 'MODEL EVOLUTION'),
      h('div', { class: 'k-h' }, '模型改進路徑'),
      h('div', { class: 'ver' }, ...btns), bPlay,
      h('div', { class: 'final-note' }, note)),
    h('div', { class: 'col final-chart' },
      h('div', { class: 'card dark final-summary' },
        h('div', null, h('div', { class: 'eyebrow' }, '目前選取版本'),
          h('div', { class: 'k-h' }, '五個難度平均嚴格達標率')), avg),
      h('div', { class: 'card dark col fill' },
        h('div', { class: 'k-h' }, '各難度表現'), h('div', { class: 'fill' }, bars),
        h('div', { class: 'src' }, '嚴格範圍：XY ≤10 µm、間隙 ≤12.5 µm、傾斜 ≤0.625°。虛線框為基準。'))),
    h('div', { class: 'col final-results' },
      h('div', { class: 'card dark' }, h('div', { class: 'eyebrow' }, '原光纖對光纖基準 · 模擬'),
        h('div', { class: 'k-h' }, '最終模型誤差 p95'),
        h('div', { class: 'src' }, '位置單位 µm；傾斜單位 °'), p95),
      h('div', { class: 'card dark' }, h('div', { class: 'k-h' }, '交付與精對位銜接'),
        h('p', null, '以原光纖對光纖模型作為方法基準；轉用 PIC 時，需加入晶片邊緣、入光口與標記資料重新訓練及驗證。'),
        h('div', { class: 'result-badge' }, '原基準規格達標率 100%')),
      h('div', { class: 'camera-takeaway' }, h('b', null, '下一步：光纖對 PIC 驗證'),
        h('p', null, '本頁數值皆來自原模擬測試，尚非 PIC 成績。須校正 µm/px、景深與標記到入光口的座標，再用光功率確認耦合。')))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp22', 'camera-ui', 'camera-final');
  pick(VERS.length - 1); cur = VERS[VERS.length - 1].vals.slice();
  return { show() { B.apply(); paint(); }, hide() { stop(); anim.stop(); cur = VERS[v].vals.slice(); } };
}

export function mount(sec) {
  sec.slide({ title: '高倍相機微小失配就失焦', sub: '' }, camSlide);
  sec.slide({ title: '雙視角CNN對上傳統影像分析', sub: '' }, cnnSlide);
  sec.slide({ title: '經過訓練後模型的表現', sub: '' }, finalSlide);
}
