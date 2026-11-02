// 計畫版 2-4「光功率量測」前兩頁（2026-11-02）：
//   1. AESC：擾動找梯度（動畫＋30 組場景的表現）
//   2. 擾動法的極限：越接近峰值，訊號越被雜訊淹沒（互動）＋「繞 1 圈接 AESC」失敗
// AESC 的迭代式與參數照 2D_alignment_sim/Spiral_AESC.m（G 節）：擾動 0.15→0.01 µm 隨低通功率線性縮小、
// 兩軸角頻率 0.65／0.88 rad/次、輸出低通 0.10、梯度低通 0.03、步進 0.5；場景照共用基準
// （主峰 σ 1.5 µm、First Light 門檻 0.20、雜訊每點 0.3%、10 點移動平均）。
// 動畫只重現迭代式本身（沒有模擬移動途中取樣與假峰），所以是示意；表現數字來自 aesc_30trials.csv。
import { h, segmented, slider, fitCanvas, loop, clamp } from '../ui.js';
import { fieldRGB } from '../presentation-palette.js';

const SIG = 1.5, T = 0.2, AMAX = 0.15, AMIN = 0.01, W = [0.65, 0.88], A_OUT = 0.10, A_GRAD = 0.03, STEP = 0.5;
const NOISE_EFF = (n) => n / Math.sqrt(10);   // 每點雜訊 → 10 點移動平均後
const Pof = (x, y) => Math.exp(-(x * x + y * y) / (2 * SIG * SIG));
const ditherOf = (p) => AMAX - clamp((p - T) / (1 - T), 0, 1) * (AMAX - AMIN);
const D_FL = SIG * Math.sqrt(2 * Math.log(1 / T));   // First Light 門檻 0.20 的等高線半徑 ≈ 2.69 µm
const R995 = SIG * Math.sqrt(-2 * Math.log(0.995)); // 0.995 等高線半徑 ≈ 0.150 µm

function rng(seed) { let s = seed % 2147483647 || 1; const u = () => (s = (s * 16807) % 2147483647) / 2147483647; return { u, n: () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()) }; }

// AESC 狀態機：一次 step() = 一次迭代
function makeAESC({ start, noise, seed, stopAt = 0.995 }) {
  const R = rng(seed);
  const st = { c: start.slice(), lp: Pof(...start), g: [0, 0], a: [AMAX, AMAX], k: 0, path: [start.slice()], probes: [], dist: [Math.hypot(...start)], amp: [AMAX], stopped: false };
  st.step = () => {
    if (st.stopped) return;
    st.k++;
    const da = ditherOf(st.lp);
    st.a = st.a.map((v) => v + 0.0501 * (da - v));
    const ds = W.map((f) => Math.sin(f * st.k));
    const q = [st.c[0] + st.a[0] * ds[0], st.c[1] + st.a[1] * ds[1]];
    const m = Pof(...q) + NOISE_EFF(noise) * R.n();
    st.probes.push(q);
    if (stopAt && m >= stopAt) { st.c = q; st.stopped = true; }   // 原版的停止：量到 ≥ 0.995（要事先知道峰值 1.0）
    else {
      st.lp += A_OUT * (m - st.lp);
      const hp = m - st.lp;
      st.g = st.g.map((v, i) => v + A_GRAD * ((2 / st.a[i]) * hp * ds[i] - v));
      st.c = st.c.map((v, i) => v + STEP * st.g[i]);
    }
    st.path.push(st.c.slice()); st.dist.push(Math.hypot(...st.c)); st.amp.push(st.a[0]);
  };
  return st;
}

function heat(ctx, w, H, X, Y, inv, dbMin) {   // 畫功率熱圖（dB），inv：像素 → µm
  const img = ctx.createImageData(Math.ceil(w), Math.ceil(H));
  for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
    const [x, y] = inv(i, j), db = 10 * Math.log10(Math.max(Pof(x, y), 1e-9));
    const [r, g, b] = fieldRGB(1 - db / dbMin), o = (j * img.width + i) * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  return img;
}

function logPlot(g, { series, xmax, ylim, hl, label, marker }) {   // 離峰距離（對數）對迭代次數
  const { ctx, w, h: H } = g; if (!w) return;
  ctx.clearRect(0, 0, w, H);
  const m = { l: 52, r: 10, t: 20, b: 26 }, pw = w - m.l - m.r, ph = H - m.t - m.b;
  const [y0, y1] = ylim.map(Math.log10), X = (x) => m.l + (x / xmax) * pw, Y = (v) => m.t + (1 - (Math.log10(clamp(v, 10 ** y0, 10 ** y1)) - y0) / (y1 - y0)) * ph;
  ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textBaseline = 'middle';
  for (let e = Math.ceil(y0); e <= y1; e++) {
    ctx.strokeStyle = 'rgba(140,170,230,.15)'; ctx.beginPath(); ctx.moveTo(m.l, Y(10 ** e)); ctx.lineTo(w - m.r, Y(10 ** e)); ctx.stroke();
    ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'right'; const v = 10 ** e; ctx.fillText(v >= 1 ? `${v} µm` : `${v * 1000} nm`, m.l - 5, Y(v));
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#93a6c6';
  for (let x = 0; x <= xmax; x += xmax / 5) ctx.fillText(Math.round(x), X(x), H - m.b + 6);
  ctx.textAlign = 'right'; ctx.fillText(label, w - m.r, H - m.b + 6 - 14);
  for (const l of hl || []) { ctx.strokeStyle = l.color; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.l, Y(l.y)); ctx.lineTo(w - m.r, Y(l.y)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = l.color; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(l.text, m.l + 6, Y(l.y) - 2); }
  for (const s of series) { ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); s.v.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke(); ctx.lineWidth = 1; }
  if (marker) { ctx.fillStyle = marker.color; ctx.beginPath(); ctx.arc(X(marker.x), Y(marker.y), 5, 0, 7); ctx.fill(); }
}

const CSS = `
.sp24 .card.dark { padding:10px 14px; }
.sp24 .k-h { font-size:18px; font-weight:800; color:#fff; margin:0 0 4px; }
.sp24 .k-ul { margin:0; padding-left:20px; font-size:15.5px; line-height:1.5; color:#e8eefb; } .sp24 .k-ul b { color:#ffd29a; }
.sp24 .src { font-size:12.5px; color:#93a6c6; line-height:1.4; }
.sp24 .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; text-align:center; }
.sp24 .kpis > div { background:rgba(255,255,255,.04); border-radius:10px; padding:6px 4px; }
.sp24 .kpis b { display:block; font-family:var(--mono); font-size:27px; color:#ffb86b; line-height:1.15; }
.sp24 .kpis span { font-size:13.5px; color:#cfd9ec; }
.sp24 .pane { position:relative; min-height:0; }
.sp24 .pane > canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.sp24 .tag { position:absolute; left:10px; top:8px; z-index:2; font-size:14.5px; font-weight:700; color:#fff; background:rgba(8,14,28,.75); padding:2px 10px; border-radius:99px; }
.sp24 .rd2 { font-family:var(--mono); font-size:15px; color:#cfd9ec; }
.sp24 .rd2 b { color:#ffb86b; } .sp24 .rd2 b.bad { color:#ff6b6b; } .sp24 .rd2 b.ok { color:#5fd068; }
.sp24 table.cmp { border-collapse:collapse; width:100%; font-size:14.5px; color:#e8eefb; }
.sp24 table.cmp td, .sp24 table.cmp th { padding:2px 6px; border-bottom:1px solid rgba(140,170,230,.2); text-align:center; }
.sp24 table.cmp th { color:#93a6c6; font-weight:600; } .sp24 table.cmp td.bad { color:#ff8a8a; font-weight:700; } .sp24 table.cmp td.ok { color:#5fd068; font-weight:700; }
.sp24 .figs { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.sp24 .figs figure { margin:0; position:relative; background:#fff; border-radius:8px; overflow:hidden; }
.sp24 .figs img { width:100%; height:100%; object-fit:contain; display:block; }
.sp24 .figs figcaption { position:absolute; left:6px; top:6px; font-size:13px; font-weight:700; color:#1a1206; background:#ffd29a; padding:1px 8px; border-radius:6px; }
`;
const pane = (c, tag) => { c.style.position = 'absolute'; return h('div', { class: 'pane fill' }, c, tag ? h('div', { class: 'tag' }, tag) : null); };

// Keep the original comparison figures readable without crowding the slide.
function figureZoom(body) {
  body.querySelectorAll('.figs img').forEach(img => {
    img.tabIndex = 0; img.setAttribute('role', 'button'); img.setAttribute('aria-label', `放大：${img.alt}`);
    const open = () => {
      const dialog = h('dialog', { class: 'measure-figure-dialog', 'aria-label': img.alt },
        h('div', { class: 'measure-dialog-head' }, h('b', null, img.alt),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => dialog.close() }, '關閉')),
        h('img', { src: img.src, alt: img.alt }));
      dialog.addEventListener('close', () => { dialog.remove(); img.focus(); });
      dialog.addEventListener('keydown', e => e.stopPropagation());
      body.closest('.slide').append(dialog); dialog.showModal();
    };
    img.addEventListener('click', open);
    img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); open(); } });
  });
}

// ---------- 第 1 頁：AESC 動畫與表現 ----------
function aescSlide(body) {
  const st = { noise: 0.003, seed: 7, speed: 1, run: null, acc: 0 };
  const cv = h('canvas'), cd = h('canvas');
  const G = fitCanvas(cv, () => { bg = null; draw(); }), D = fitCanvas(cd, () => draw());
  let bg = null;
  const info = h('div', { class: 'rd2' });
  const VIEW = 3.2;
  const reset = () => {
    // Golden-angle spacing makes consecutive starts visibly different around the same First Light contour.
    const th = (st.seed * Math.PI * (3 - Math.sqrt(5))) % (2 * Math.PI);
    st.run = makeAESC({ start: [D_FL * Math.cos(th), D_FL * Math.sin(th)], noise: st.noise, seed: st.seed });
    st.acc = 0; draw();
  };
  function draw() {
    const r = st.run; if (!r) return;
    const { ctx, w, h: H } = G;
    if (w) {
      const sz = Math.min(w, H), ox = (w - sz) / 2, oy = (H - sz) / 2, X = (x) => ox + ((x + VIEW) / (2 * VIEW)) * sz, Y = (y) => oy + ((VIEW - y) / (2 * VIEW)) * sz;
      ctx.fillStyle = '#0b1426'; ctx.fillRect(0, 0, w, H);
      if (!bg) { const k = 2; const img = heat(ctx, sz / k, sz / k, null, null, (i, j) => [-VIEW + (i * k / sz) * 2 * VIEW, VIEW - (j * k / sz) * 2 * VIEW], -6); bg = document.createElement('canvas'); bg.width = img.width; bg.height = img.height; bg.getContext('2d').putImageData(img, 0, 0); }
      ctx.imageSmoothingEnabled = true; ctx.drawImage(bg, ox, oy, sz, sz);
      // 等高線：First Light 門檻、0.995
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([6, 5]);
      for (const [rr, t] of [[D_FL, 'First Light 門檻 0.20'], [R995, '0.995（停止）']]) { ctx.beginPath(); ctx.arc(X(0), Y(0), (rr / (2 * VIEW)) * sz, 0, 7); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '12.5px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(t, X(rr * 0.71) + 4, Y(-rr * 0.71) + 12); }
      ctx.setLineDash([]);
      // 擾動取樣點（最近 60 個）＋中心路徑
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (const q of r.probes.slice(-60)) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 1.8, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 2.4; ctx.beginPath(); r.path.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); ctx.lineWidth = 1;
      const [cx, cy] = r.c; ctx.fillStyle = r.stopped ? '#e03131' : '#fff'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(X(cx), Y(cy), 6, 0, 7); ctx.fill(); ctx.stroke();
      // 真峰（星）
      ctx.fillStyle = '#ff3df2'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', X(0), Y(0));
      // 目前擾動圈（Lissajous 的範圍）
      ctx.strokeStyle = 'rgba(255,224,102,.9)'; ctx.strokeRect(X(cx - r.a[0]), Y(cy + r.a[1]), (2 * r.a[0] / (2 * VIEW)) * sz, (2 * r.a[1] / (2 * VIEW)) * sz);
      ctx.fillStyle = '#fff'; ctx.font = '12.5px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('1 µm', X(-VIEW) + 14, Y(-VIEW) - 20);
      ctx.fillRect(X(-VIEW) + 14, Y(-VIEW) - 14, sz / (2 * VIEW), 3);
    }
    logPlot(D, { xmax: Math.max(200, Math.ceil(r.k / 100) * 100), ylim: [0.001, 5], label: '迭代次數',
      series: [{ v: r.dist, color: '#ff7a1a' }, { v: r.amp, color: '#ffe066' }],
      hl: [{ y: R995, color: 'rgba(255,255,255,.6)', text: '0.995 等高線 150 nm' }] });
    const d = r.dist[r.dist.length - 1];
    info.innerHTML = `迭代 <b>${r.k}</b>　離峰 <b>${d >= 1 ? d.toFixed(2) + ' µm' : (d * 1000).toFixed(0) + ' nm'}</b>　擾動 <b>${(r.a[0] * 1000).toFixed(0)} nm</b>　${r.stopped ? '<b class="ok">量到 ≥ 0.995，停止</b>' : ''}`;
  }
  const anim = loop((dt) => { st.acc += dt * 60 * st.speed; let n = Math.floor(st.acc); st.acc -= n; while (n-- > 0 && !st.run.stopped && st.run.k < 700) st.run.step(); draw(); if (st.run.stopped || st.run.k >= 700) { anim.stop(); bPlay.textContent = '↻ 重播'; } });
  const bPlay = h('button', { type: 'button', class: 'btn', onclick: () => { if (anim.running) { anim.stop(); bPlay.textContent = '▶ 繼續'; return; } if (st.run.stopped || st.run.k >= 700) reset(); bPlay.textContent = '❚❚ 暫停'; anim.start(); } }, '▶ 播放');
  const bNew = h('button', { type: 'button', class: 'btn ghost', title: '起點沿找光門檻圓周移動約 137.5°，並更換雜訊序列', onclick: () => { st.seed++; anim.stop(); bPlay.textContent = '▶ 播放'; reset(); } }, '更換起點');
  const segN = segmented([{ id: '0', label: '無雜訊' }, { id: '0.003', label: '雜訊 0.3%' }], '0.003', (id) => { st.noise = +id; anim.stop(); bPlay.textContent = '▶ 播放'; reset(); });
  const segS = segmented([{ id: '0.5', label: '0.5×' }, { id: '1', label: '1×' }], '1', (id) => { st.speed = +id; });

  const kpi = (v, l) => h('div', null, h('b', null, v), h('span', null, l));
  body.append(h('div', { class: 'grid grow aesc-layout' },
    h('div', { class: 'card dark col aesc-demo' },
      h('div', { class: 'row measure-toolbar' }, bPlay, bNew, segN.el, segS.el),
      pane(cv, '找到光後的 AESC 軌跡（示意）'), info,
      h('div', { class: 'measure-legend' },
        h('span', { class: 'legend-path' }, '橘線：中心路徑'), h('span', null, '白點：取樣'),
        h('span', { class: 'legend-dither' }, '黃框：擾動幅度'), h('span', null, '★：真峰'))),
    h('div', { class: 'col aesc-results' },
      h('div', { class: 'card dark measure-principle' },
        h('div', { class: 'measure-flow' }, ['① 雙軸擾動', '② 解調梯度', '③ 更新位置'].map(t => h('span', null, t))),
        h('p', null, '功率越高，擾動幅度由 150 nm 縮至 10 nm。')),
      h('div', { class: 'card dark col fill aesc-convergence' },
        h('div', { class: 'measure-chart-head' }, h('b', null, '收斂過程'), h('span', null, '橘：離峰距離　黃：擾動幅度（對數）')), pane(cd)),
      h('div', { class: 'card dark measure-results' },
        h('div', { class: 'k-h' }, '30 組隨機場景（模擬）'),
        h('div', { class: 'kpis' }, kpi('30/30', '成功找到峰'), kpi('124 nm', '平均誤差'), kpi('181', '平均迭代次數'), kpi('2.08 s', '平均總時間')),
        h('div', { class: 'measure-takeaway' }, h('b', null, '限制：停止需要已知峰值'),
          h('p', null, '門檻 0.995 對應約 150 nm；取樣平均也限制移動速度。'))))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp24');
  reset();
  return { show() { draw(); }, hide() { anim.stop(); bPlay.textContent = '▶ 播放'; } };
}

// ---------- 第 2 頁：擾動法的極限 ----------
// 在離峰 d 處：擾動幅度 a 照 AESC 規則由功率決定；功率的一次諧波振幅 A1（數值積分）＝訊號；
// 解調後梯度雜訊（梯度低通 α = 0.03 的穩態）＝ √2·σe·√(α/(2−α))，σe＝每點雜訊/√10。SNR = A1 / 上式。
const N_SCOPE = 24;
function harmonic(d, a) { let s = 0; for (let i = 0; i < 64; i++) { const th = (2 * Math.PI * i) / 64; s += Math.exp(-((d + a * Math.sin(th)) ** 2) / (2 * SIG * SIG)) * Math.sin(th); } return Math.abs((2 / 64) * s); }
const snrOf = (d, noise) => { const a = ditherOf(Pof(d, 0)); return harmonic(d, a) / (Math.SQRT2 * NOISE_EFF(noise) * Math.sqrt(A_GRAD / (2 - A_GRAD))); };
const Phi = (z) => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));   // 標準常態 CDF（近似）

function limitSlide(body) {
  const st = { d: 0.5, noise: 0.003, t: 0, walk: null };
  const cs = h('canvas'), cn = h('canvas'), cw = h('canvas');
  const S = fitCanvas(cs, () => draw()), N = fitCanvas(cn, () => draw()), Wk = fitCanvas(cw, () => draw());
  const rd = h('div', { class: 'rd2' });
  const R = rng(99);
  // The three noise settings have fixed SNR curves; distance only moves the dot.
  const snrCurves = new Map();
  const newWalk = () => { st.walk = makeAESC({ start: [0.05, 0.02], noise: st.noise, seed: 5 + Math.floor(Math.random() * 1000), stopAt: null }); };

  function draw() {
    const d = st.d, P0 = Pof(d, 0), a = ditherOf(P0), A1 = harmonic(d, a), ne = NOISE_EFF(st.noise), snr = snrOf(d, st.noise);
    // 示波器：一次擾動週期上的量測功率（扣掉平均），訊號＋雜訊
    { const { ctx, w, h: H } = S; if (w) {
      ctx.clearRect(0, 0, w, H);
      const m = { l: 12, r: 12, t: 30, b: 24 }, pw = w - m.l - m.r, ph = H - m.t - m.b, span = Math.max(3 * A1, 4 * ne, 1e-6), Yv = (v) => m.t + ph / 2 - (v / span) * (ph / 2);
      ctx.strokeStyle = 'rgba(140,170,230,.2)'; ctx.beginPath(); ctx.moveTo(m.l, Yv(0)); ctx.lineTo(w - m.r, Yv(0)); ctx.stroke();
      const per = 3, n = N_SCOPE * per;
      ctx.strokeStyle = 'rgba(255,224,102,.85)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const th = (i / 200) * 2 * Math.PI * per + st.t; const v = Pof(d + a * Math.sin(th), 0) - P0; const x = m.l + (i / 200) * pw; i ? ctx.lineTo(x, Yv(v)) : ctx.moveTo(x, Yv(v)); }
      ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#7fb2ff';
      for (let i = 0; i < n; i++) { const th = (i / n) * 2 * Math.PI * per + st.t; const v = Pof(d + a * Math.sin(th), 0) - P0 + ne * R.n(); ctx.beginPath(); ctx.arc(m.l + (i / n) * pw, Yv(clamp(v, -span, span)), 3, 0, 7); ctx.fill(); }
      ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffe066'; ctx.fillText(`訊號振幅 ${(A1 * 100).toPrecision(2)}%`, m.l, 6);
      ctx.fillStyle = '#7fb2ff'; ctx.textAlign = 'right'; ctx.fillText(`平均後雜訊 ${(ne * 100).toFixed(3)}%`, w - m.r, 6);
    } }
    // SNR 對離峰距離
    { const { ctx, w, h: H } = N; if (w) {
      ctx.clearRect(0, 0, w, H);
      const m = { l: 52, r: 12, t: 14, b: 30 }, pw = w - m.l - m.r, ph = H - m.t - m.b, xl = [Math.log10(0.003), Math.log10(3)], yl = [-2, 3];
      const X = (v) => m.l + ((Math.log10(v) - xl[0]) / (xl[1] - xl[0])) * pw, Y = (v) => m.t + (1 - (Math.log10(clamp(v, 10 ** yl[0], 10 ** yl[1])) - yl[0]) / (yl[1] - yl[0])) * ph;
      ctx.fillStyle = 'rgba(201,42,42,.14)'; ctx.fillRect(m.l, Y(1), pw, Y(10 ** yl[0]) - Y(1));
      ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif';
      for (let e = yl[0]; e <= yl[1]; e++) { ctx.strokeStyle = 'rgba(140,170,230,.15)'; ctx.beginPath(); ctx.moveTo(m.l, Y(10 ** e)); ctx.lineTo(w - m.r, Y(10 ** e)); ctx.stroke(); ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`${10 ** e}`, m.l - 6, Y(10 ** e)); }
      for (const [v, t] of [[0.01, '10 nm'], [0.1, '100 nm'], [1, '1 µm']]) { ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(t, X(v), H - m.b + 6); }
      ctx.save(); ctx.translate(14, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('訊號／雜訊（SNR）', 0, 0); ctx.restore();
      ctx.fillStyle = '#ff8a8a'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('SNR < 1：方向被雜訊蓋過', m.l + 6, Y(1) + 16);
      for (const [nz, col] of [[0.001, 'rgba(127,178,255,.45)'], [st.noise, '#ffb547'], [0.01, 'rgba(255,107,107,.45)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = nz === st.noise ? 2.6 : 1.4; ctx.beginPath();
        if (!snrCurves.has(nz)) snrCurves.set(nz, Array.from({ length: 161 }, (_, i) => { const v = 10 ** (xl[0] + (i / 160) * (xl[1] - xl[0])); return [v, snrOf(v, nz)]; }));
        snrCurves.get(nz).forEach(([v, snr], i) => { const y = Y(snr); i ? ctx.lineTo(X(v), y) : ctx.moveTo(X(v), y); }); ctx.stroke(); }
      ctx.lineWidth = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(d), Y(snr), 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('離峰距離', w - m.r, H - m.b - 2);
    } }
    // 一直跑下去的 AESC（不設停止）：±0.6 µm
    { const { ctx, w, h: H } = Wk, r = st.walk; if (w && r) {
      const V = 0.6, sz = Math.min(w, H), ox = (w - sz) / 2, oy = (H - sz) / 2, X = (x) => ox + ((x + V) / (2 * V)) * sz, Y = (y) => oy + ((V - y) / (2 * V)) * sz;
      ctx.fillStyle = '#0b1426'; ctx.fillRect(0, 0, w, H);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(X(0), Y(0), (R995 / (2 * V)) * sz, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); r.path.slice(-300).forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); ctx.lineWidth = 1;
      const [cx, cy] = r.c; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(clamp(cx, -V, V)), Y(clamp(cy, -V, V)), 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff3df2'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', X(0), Y(0));
      const dd = r.dist[r.dist.length - 1];
      ctx.fillStyle = dd > V ? '#ff6b6b' : '#fff'; ctx.font = '600 13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`第 ${r.k} 次：離峰 ${dd >= 1 ? dd.toFixed(1) + ' µm' : (dd * 1000).toFixed(0) + ' nm'}${dd > V ? '（跑出畫面）' : ''}`, 8, H - 6);
    } }
    rd.innerHTML = `<div><span>SNR</span><b class="${snr < 1 ? 'bad' : 'ok'}">${snr < 10 ? snr.toFixed(2) : snr.toFixed(0)}</b></div><div><span>擾動幅度</span><b>${(a * 1000).toFixed(0)} nm</b></div><div><span>方向判對率（估算）</span><b class="${snr < 1 ? 'bad' : 'ok'}">${(Phi(snr) * 100).toFixed(0)}%</b></div>`;
  }
  const sD = slider({ label: '離峰距離（對數）', min: Math.log10(0.005), max: Math.log10(2), step: 0.01, value: Math.log10(st.d), fmt: (v) => { const x = 10 ** v; return x >= 1 ? `${x.toFixed(2)} µm` : `${(x * 1000).toFixed(0)} nm`; }, onInput: (v) => { st.d = 10 ** v; draw(); } });
  const segN = segmented([{ id: '0.001', label: '0.1%' }, { id: '0.003', label: '0.3%（基準）' }, { id: '0.01', label: '1%' }], '0.003', (id) => { st.noise = +id; newWalk(); draw(); });
  const anim = loop((dt) => { st.t += dt * 2.2; if (st.walk && st.walk.k < 3000) st.walk.step(); draw(); });
  const bWalk = h('button', { type: 'button', class: 'btn ghost', onclick: () => { newWalk(); draw(); } }, '↻ 重跑');
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bPause = h('button', { type: 'button', class: 'btn ghost', onclick: () => {
    playing = !playing; bPause.textContent = playing ? '暫停演示' : '播放演示';
    if (playing) anim.start(); else anim.stop();
  } }, playing ? '暫停演示' : '播放演示');
  rd.classList.add('noise-metrics');

  body.append(h('div', { class: 'grid grow noise-layout' },
    h('div', { class: 'col noise-demo' },
      h('div', { class: 'card dark col noise-controls' },
        h('div', { class: 'row measure-toolbar' }, h('span', null, '每點雜訊'), segN.el, bPause), sD.el, rd),
      h('div', { class: 'card dark col fill noise-wave' },
        h('div', { class: 'measure-chart-head' }, h('b', null, '訊號與雜訊'), h('span', null, '黃線：理想訊號　藍點：量測')), pane(cs)),
      h('div', { class: 'grid fill noise-lower' },
        h('div', { class: 'card dark col' }, pane(cn)),
        h('div', { class: 'card dark col noise-walk' },
          h('div', { class: 'measure-chart-head' }, h('b', null, '未設停止條件'), bWalk), pane(cw)))),
    h('div', { class: 'col noise-evidence' },
      h('div', { class: 'card dark measure-principle' },
        h('div', { class: 'k-h' }, '越接近峰頂，方向越難判斷'),
        h('ul', { class: 'k-ul' },
          h('li', null, '功率變化 ∝ 離峰距離 × 擾動幅度'),
          h('li', null, '擾動縮小 15 倍，梯度雜訊放大 15 倍'),
          h('li', null, '方向誤判可能累積成位置漂移'))),
      h('div', { class: 'card dark fill col noise-comparison' },
        h('div', { class: 'measure-chart-head' }, h('b', null, '接續 AESC 未改善精度'), h('span', null, '點圖放大')),
        h('div', { class: 'figs fill' },
          h('figure', null, h('img', { src: 'assets/aesc_combo_converge.jpg', alt: '繞到收斂' }), h('figcaption', null, 'A 繞到收斂')),
          h('figure', null, h('img', { src: 'assets/aesc_combo_onerev.jpg', alt: '繞 1 圈接 AESC' }), h('figcaption', null, 'B 繞 1 圈＋AESC'))),
        h('table', { class: 'cmp' },
          h('tr', null, h('th', null, '第二階段'), h('th', null, '最終誤差'), h('th', null, '時間')),
          h('tr', null, h('td', null, '繞到收斂（現行）'), h('td', { class: 'ok' }, '1.2 nm'), h('td', null, '21.9 ms')),
          h('tr', null, h('td', null, '繞 1 圈＋AESC 30 次'), h('td', { class: 'bad' }, '37.8 nm'), h('td', null, '8.2 ms')),
          h('tr', null, h('td', null, '繞 1 圈＋AESC 100 次'), h('td', { class: 'bad' }, '121 nm'), h('td', null, '—')),
          h('tr', null, h('td', null, '繞 1 圈＋AESC 300 次'), h('td', { class: 'bad' }, '25.9 µm（跑掉）'), h('td', null, '—'))),
        h('div', { class: 'measure-takeaway' }, '本組模擬保留繞圈收斂；增加 AESC 迭代可能造成漂移。')))),
    h('div', { class: 'src measure-source', title: 'SNR 訊號取功率的一次諧波振幅；每點雜訊除以 √10，再計入梯度低通 α=0.03 的穩態雜訊。方向判對率以常態近似估算。' },
      '模擬：10-13 進度報告，30 組場景；SNR 估算採 10 點平均、梯度低通 α=0.03、主峰 σ=1.5 µm。'));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp24');
  figureZoom(body);
  newWalk(); draw();
  return { show() { S.apply(); N.apply(); Wk.apply(); draw(); if (playing) anim.start(); }, hide() { anim.stop(); } };
}

export function mount(sec) {
  sec.slide({ title: 'AESC：擾動找梯度，沿梯度爬到峰', sub: '' }, aescSlide);
  sec.slide({ title: '擾動法的極限：越接近峰值，訊號越被雜訊淹沒', sub: '' }, limitSlide);
}
