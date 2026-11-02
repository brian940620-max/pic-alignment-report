// 計畫版 2-2「機器學習影像粗對位」三頁（2026-11-02，濃縮自桌面「雙視角光纖粗對位_ML課程報告.pptx」與 報告/最終相機ML模型_報告.md）
//   1. 高倍率相機的景深：相機即時畫面隨離焦、傾斜變糊（光學估算＋示意渲染）
//   2. 雙視角 CNN 與傳統方法：拖難度 0–4 看模擬影像與合格率（ML 簡報第 22 頁的數字）
//   3. 最終相機模型：CNN 逐步改進（ML 簡報第 20 頁的圖）到最終模型 T* 94.3%
// 全部是模擬；第 1 頁的畫面是示意渲染，景深、模糊量用公式估算。
import { h, slider, segmented, fitCanvas, loop, clamp } from '../ui.js';

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
    if (spec.sel === i) { ctx.fillStyle = 'rgba(255,181,71,.10)'; ctx.fillRect(m.l + cw * i + 2, m.t - 22, cw - 4, ph + 22); }
    spec.series.forEach((s, k) => {
      const v = s.vals[i], x = x0 + bw * k;
      if (s.ghost) { ctx.strokeStyle = 'rgba(220,228,245,.45)'; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 1, Y(s.ghost[i]), bw - 2, Y(0) - Y(s.ghost[i])); ctx.setLineDash([]); }
      ctx.fillStyle = s.color; ctx.globalAlpha = spec.sel == null || spec.sel === i ? 1 : 0.45;
      ctx.fillRect(x + 1, Y(v), bw - 2, Y(0) - Y(v)); ctx.globalAlpha = 1;
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
const VW = 480, VH = 300, GAP = 10, R = 62.5, CORE = 4.5;   // 畫面範圍、間隙、光纖半徑、纖芯半徑（µm）
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

function drawFiber(ctx, s, xa, xb, tipX) {   // 在 µm→px 座標（s px/µm）畫一段水平光纖；tipX＝端面（null＝沒有）
  const X = (x) => (x + VW / 2) * s, Y = (y) => (y + VH / 2) * s;
  const lw = (um) => Math.max(um * s, 0.6);
  ctx.fillStyle = 'rgba(150,160,175,.20)'; ctx.fillRect(X(xa), Y(-R), X(xb) - X(xa), Y(R) - Y(-R));
  ctx.fillStyle = 'rgba(190,200,215,.20)'; ctx.fillRect(X(xa), Y(-CORE), X(xb) - X(xa), Y(CORE) - Y(-CORE));
  for (const [y, um, c] of [[-R, 2.4, '#eef1f6'], [R, 2.4, '#eef1f6'], [-(R - 7), 1.6, 'rgba(230,235,245,.45)'], [R - 7, 1.6, 'rgba(230,235,245,.45)'], [-CORE, 1, 'rgba(230,235,245,.3)'], [CORE, 1, 'rgba(230,235,245,.3)']]) {
    ctx.fillStyle = c; ctx.fillRect(X(xa), Y(y) - lw(um) / 2, X(xb) - X(xa), lw(um));
  }
  if (tipX != null) { ctx.fillStyle = '#f4f6fa'; ctx.fillRect(X(tipX) - lw(2.4) / 2, Y(-R), lw(2.4), Y(R) - Y(-R)); }
}

function camSlide(body) {
  const st = { M: 10, dz: 0, th: 0, play: false, t: 0 };
  const cv = h('canvas'), prof = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
  const hud = h('div', { class: 'cam-hud' }), stat = h('div', { class: 'cam-stat ok' });
  const buf = document.createElement('canvas'), bx = buf.getContext('2d');
  const mov = document.createElement('canvas'), mx = mov.getContext('2d');
  const bg = document.createElement('canvas'), gx = bg.getContext('2d');
  let bgKey = '';
  const G = fitCanvas(cv, () => draw()), P = fitCanvas(prof, () => draw());

  const rd = {};
  const row = (k, label) => [h('span', null, label), (rd[k] = h('b'))];
  const readout = h('div', { class: 'rd' }, ...row('px', '每像素'), ...row('dof', '景深（±一半）'), ...row('tip', '端面離焦'), ...row('blur', '端面模糊圈直徑'), ...row('dh', '畫面內前後高低差'), ...row('edge', '亮邊銳利度'));

  const tipX = -GAP / 2;
  const dzAt = (x) => st.dz + (tipX - x) * Math.tan((st.th * Math.PI) / 180);   // 俯仰傾斜：越往後端離焦越多
  function makeBg(N, Hh, s) {   // 背景（焦外的雜散光斑＋固定雜訊），換倍率才重做
    const key = `${N}x${Hh}`; if (key === bgKey) return; bgKey = key;
    bg.width = N; bg.height = Hh;
    const gr = gx.createRadialGradient(N * 0.5, Hh * 0.45, 10, N * 0.5, Hh * 0.5, N * 0.7);
    gr.addColorStop(0, '#20232a'); gr.addColorStop(1, '#0b0c10'); gx.fillStyle = gr; gx.fillRect(0, 0, N, Hh);
    gx.filter = `blur(${Math.max(2, 18 * s)}px)`;
    for (const [x, y, r, a] of [[0.18, 0.2, 40, 0.10], [0.72, 0.82, 55, 0.08], [0.88, 0.15, 30, 0.07]]) { gx.fillStyle = `rgba(200,205,215,${a})`; gx.beginPath(); gx.arc(x * N, y * Hh, r * s, 0, 7); gx.fill(); }
    gx.filter = 'none';
    const img = gx.getImageData(0, 0, N, Hh), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    gx.putImageData(img, 0, 0);
  }

  function draw() {
    const M = st.M, p = PIX / M, s = 1 / p;                        // 每像素 µm、每 µm 幾像素（感測器解析度渲染）
    const N = Math.round(VW * s), Hh = Math.round(VH * s);
    if (buf.width !== N || buf.height !== Hh) { buf.width = N; buf.height = Hh; mov.width = N; mov.height = Hh; }
    makeBg(N, Hh, s);
    bx.filter = 'none'; bx.drawImage(bg, 0, 0);
    // 固定光纖（焦面對在它上面）：只有繞射模糊
    mx.clearRect(0, 0, N, Hh); drawFiber(mx, s, GAP / 2, VW / 2 + 20, GAP / 2);
    bx.filter = `blur(${(sigmaOf(M, 0) * s).toFixed(2)}px)`; bx.drawImage(mov, 0, 0);
    // 移動光纖：沿長度切段，各段依當地離焦量模糊（傾斜時前後清楚程度不同）
    mx.clearRect(0, 0, N, Hh); drawFiber(mx, s, -VW / 2 - 20, tipX, tipX);
    const K = 24, xL = -VW / 2;
    for (let k = 0; k < K; k++) {
      const xa = xL + ((tipX - xL) * k) / K, xb = xL + ((tipX - xL) * (k + 1)) / K;
      const sg = sigmaOf(M, dzAt((xa + xb) / 2)) * s;
      bx.save(); bx.beginPath();
      // 段界取整數像素、首尾相接不重疊（重疊會畫兩次變亮線）
      const c0 = k === 0 ? 0 : Math.round((xa + VW / 2) * s), c1 = k === K - 1 ? Math.round((tipX + GAP * 0.5 + VW / 2) * s) : Math.round((xb + VW / 2) * s);
      bx.rect(c0, 0, c1 - c0, Hh); bx.clip();
      bx.filter = `blur(${sg.toFixed(2)}px)`; bx.drawImage(mov, 0, 0); bx.restore();
    }
    bx.filter = 'none';

    // 顯示：保持比例置中；低倍率時用最近鄰放大，看得到像素
    const { ctx, w, h: H } = G;
    if (w) {
      ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, w, H);
      const sc = Math.min(w / N, H / Hh), dw = N * sc, dh = Hh * sc, ox = (w - dw) / 2, oy = (H - dh) / 2;
      ctx.imageSmoothingEnabled = sc < 1; ctx.drawImage(buf, ox, oy, dw, dh);
      // 比例尺 50 µm
      const sb = 50 * s * sc; ctx.fillStyle = '#fff'; ctx.fillRect(ox + 18, oy + dh - 26, sb, 4);
      ctx.font = '600 14px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('50 µm', ox + 18, oy + dh - 30);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '13.5px system-ui, "Microsoft JhengHei", sans-serif';
      ctx.fillText(`焦面對在右側固定光纖；間隙 ${GAP} µm`, ox + dw - 14, oy + dh - 10);
      // 剖面位置
      const xs = (tipX - 40 + VW / 2) * s * sc + ox;
      ctx.strokeStyle = 'rgba(255,181,71,.7)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(xs, oy + (VH / 2 - 95) * s * sc); ctx.lineTo(xs, oy + (VH / 2 + 95) * s * sc); ctx.stroke(); ctx.setLineDash([]);
    }

    // 數字
    const dof = dofOf(M), dTip = Math.abs(dzAt(tipX)), inF = dTip <= dof / 2;
    const dh = Math.abs((tipX - xL) * Math.tan((st.th * Math.PI) / 180));
    hud.textContent = `相機即時畫面（上視）· ${M}X 物鏡 · NA ${LENS[M].na}`;
    stat.className = `cam-stat ${inF ? 'ok' : 'bad'}`;
    stat.textContent = inF ? '端面在景深內' : `失焦：超出景深 ${(dTip / (dof / 2)).toFixed(dTip / (dof / 2) < 10 ? 1 : 0)} 倍`;
    rd.px.textContent = `${p.toFixed(2)} µm/px`;
    rd.dof.textContent = `±${(dof / 2).toFixed(dof < 10 ? 2 : 1)} µm`;
    rd.tip.textContent = `${dTip.toFixed(1)} µm`; rd.tip.classList.toggle('hot', !inF);
    rd.blur.textContent = `${(2 * LENS[M].na * dTip).toFixed(1)} µm`;
    rd.dh.textContent = `${dh.toFixed(1)} µm`; rd.dh.classList.toggle('hot', dh > dof / 2);

    // 剖面：穿過移動光纖（端面後 40 µm）的亮度，含模糊與像素取樣
    const ys = [], dy = 0.25;
    for (let y = -95; y <= 95; y += dy) ys.push(y);
    const raw = ys.map(fiberProfile);
    const conv = (sig) => { const rr = Math.ceil((3 * Math.max(sig, p)) / dy), ker = []; let sum = 0;
      for (let k = -rr; k <= rr; k++) { const wgt = Math.exp(-0.5 * ((k * dy) / sig) ** 2); ker.push(wgt); sum += wgt; }
      const box = Math.max(1, Math.round(p / dy));   // 像素積分
      const g1 = raw.map((_, i) => { let a = 0; for (let k = -rr; k <= rr; k++) a += (raw[clamp(i + k, 0, raw.length - 1)] || 0) * ker[k + rr]; return a / sum; });
      return g1.map((_, i) => { let a = 0, n = 0; for (let k = -(box >> 1); k <= box >> 1; k++) { a += g1[clamp(i + k, 0, g1.length - 1)]; n++; } return a / n; }); };
    const ref = conv(sigmaOf(M, 0)), cur = conv(sigmaOf(M, dzAt(tipX - 40)));
    const slope = (a) => { let m = 0; for (let i = 1; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - a[i - 1])); return m; };
    const sharp = slope(cur) / slope(ref);
    rd.edge.textContent = `${(sharp * 100).toFixed(0)}%`; rd.edge.classList.toggle('hot', sharp < 0.5);
    const { ctx: pc, w: pw, h: ph } = P;
    if (pw) {
      pc.clearRect(0, 0, pw, ph);
      const m = { l: 10, r: 10, t: 22, b: 20 }, X = (y) => m.l + ((y + 95) / 190) * (pw - m.l - m.r), Yv = (v) => m.t + (1 - v) * (ph - m.t - m.b);
      pc.font = '12.5px system-ui, "Microsoft JhengHei", sans-serif'; pc.textBaseline = 'middle';
      for (const yy of [-R, R]) { pc.strokeStyle = 'rgba(140,170,230,.3)'; pc.beginPath(); pc.moveTo(X(yy), m.t); pc.lineTo(X(yy), ph - m.b); pc.stroke(); }
      const line = (arr, col, dash, lwd) => { pc.strokeStyle = col; pc.lineWidth = lwd; pc.setLineDash(dash); pc.beginPath(); arr.forEach((v, i) => (i ? pc.lineTo(X(ys[i]), Yv(v)) : pc.moveTo(X(ys[i]), Yv(v)))); pc.stroke(); pc.setLineDash([]); pc.lineWidth = 1; };
      line(ref, 'rgba(220,228,245,.6)', [5, 4], 1.4); line(cur, '#ffb547', [], 2.4);
      pc.fillStyle = '#dfe8fa'; pc.textAlign = 'left'; pc.fillText('亮度剖面（虛線＝在焦，橘＝目前）', m.l, 9);
      pc.fillStyle = '#93a6c6'; pc.textAlign = 'center'; pc.fillText('兩條亮邊＝傳統方法要找的邊', (X(-R) + X(R)) / 2, ph - 8);
    }
  }

  const segM = segmented([{ id: '2', label: '2X' }, { id: '5', label: '5X' }, { id: '10', label: '10X' }], '10', (id) => { st.M = +id; draw(); });
  const sDz = slider({ label: '端面離焦 Δz（上下偏）', min: -40, max: 40, step: 0.5, value: 0, unit: 'µm', onInput: (v) => { st.dz = v; draw(); } });
  const sTh = slider({ label: '俯仰傾斜（手裝可達 ±5°）', min: -5, max: 5, step: 0.1, value: 0, unit: '°', onInput: (v) => { st.th = v; draw(); } });
  const anim = loop((dt) => { st.t += dt; st.dz = 12 * Math.sin(st.t * 1.6) + 4 * Math.sin(st.t * 3.7); sDz.set(+st.dz.toFixed(1), true); draw(); });
  const bPlay = h('button', { type: 'button', class: 'btn', onclick: () => { st.play = !st.play; bPlay.textContent = st.play ? '■ 停止' : '▶ 播放：光纖上下晃 ±16 µm'; st.play ? anim.start() : anim.stop(); } }, '▶ 播放：光纖上下晃 ±16 µm');
  const bZero = h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (st.play) bPlay.click(); sDz.set(0); sTh.set(0); } }, '歸零');

  body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.55fr 1fr' } },
    h('div', { class: 'col' }, h('div', { class: 'cam fill' }, cv, hud, stat),
      h('div', { class: 'src' }, '畫面為示意渲染：依感測器像素（FLIR CM3，3.69 µm）與物鏡 NA 計算解析度與模糊；物鏡 NA 用 Mitutoyo M Plan Apo 型錄值（2X 0.055、5X 0.14、10X 0.28），景深 DOF = λ/(2NA²)，λ = 0.55 µm。實機的鏡頭還沒定、景深還沒量。')),
    h('div', { class: 'col' },
      h('div', { class: 'card dark col', style: { gap: '4px' } },
        h('div', { class: 'row' }, h('span', { style: { color: '#cfd9ec', fontSize: '15px' } }, '物鏡倍率'), segM.el, bPlay, bZero),
        sDz.el, sTh.el, readout),
      h('div', { class: 'card dark fill', style: { minHeight: '120px', padding: '6px 10px' } }, prof),
      h('div', { class: 'card dark' },
        h('ul', { class: 'k-ul' },
          h('li', null, h('b', null, '要看清 µm 級間隙與透鏡尖端'), '需要高倍率：10X 每像素 0.37 µm'),
          h('li', null, h('b', null, '代價是景深只剩 ±1.75 µm：'), '光纖上下偏 2 µm 端面就出景深；傾斜 1° 時畫面內前後差 4 µm，後段跟著糊'),
          h('li', null, h('b', null, '靠清楚亮邊的傳統視覺'), '在失焦、反光、背景干擾下容易失效 → 用 ML（下兩頁）'))))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp22');
  draw();
  return { show() { G.apply(); P.apply(); draw(); }, hide() { if (st.play) bPlay.click(); } };
}

// ---------- 第 2 頁：雙視角 CNN vs 傳統 ----------
// 合格＝XY ±40 µm、間隙 ±50 µm、傾斜 ±2.5°；ML 簡報第 22 頁（五軸，同一測試集、每難度同一組姿態）
const PASS = { trad: [99.0, 96.0, 54.3, 4.8, 0.2], cnn: [100.0, 100.0, 100.0, 99.8, 99.7] };
const DIFF_TXT = ['乾淨影像', '輕微：開始模糊、對比下降、雜訊', '中等：再加反光條紋與髒污', '嚴重：背景亮塊與長條干擾', '最嚴重：三種退化都加到最強'];

function cnnSlide(body) {
  let d = 0, timer = null;
  const img = new Image(); img.src = 'assets/ml_difficulty_0to4.jpg';
  const cTop = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), cSide = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
  const T = fitCanvas(cTop, () => paint()), S = fitCanvas(cSide, () => paint());
  const bars = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), B = fitCanvas(bars, () => paint());
  const dTxt = h('div', { style: { fontSize: '17px', color: '#ffd29a', fontWeight: 700 } });
  const nT = h('div', { class: 'big2', style: { color: '#9fb0c8' } }), nC = h('div', { class: 'big2', style: { color: '#ffb547' } });
  const crop = (g, row) => { const { ctx, w, h: H } = g; if (!w || !img.complete || !img.naturalWidth) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, H);
    const sw = 399, sh = 200, sc = Math.min(w / sw, H / sh), dw = sw * sc, dh = sh * sc;
    ctx.drawImage(img, d * 414, row ? 214 : 0, sw, sh, (w - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.font = '700 14px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillStyle = '#ffe066'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(row ? '側視（看 Y、俯仰）' : '上視（看 X、偏擺）', (w - dw) / 2 + 8, (H - dh) / 2 + 6); };
  function paint() {
    crop(T, 0); crop(S, 1);
    drawBars(B, { cats: ['難度 0', '1', '2', '3', '4'], sel: d, ymax: 100, label: '合格率 %',
      series: [{ name: '傳統（找邊＋擬合）', color: '#8a96ab', vals: PASS.trad }, { name: '雙視角 CNN', color: '#ffb547', vals: PASS.cnn }] });
    dTxt.textContent = `難度 ${d}：${DIFF_TXT[d]}`;
    nT.textContent = `${PASS.trad[d].toFixed(1)}%`; nC.textContent = `${PASS.cnn[d].toFixed(1)}%`;
  }
  img.onload = paint;
  const seg = segmented([0, 1, 2, 3, 4].map((k) => ({ id: String(k), label: `難度 ${k}` })), '0', (id) => { d = +id; paint(); });
  const stop = () => { clearInterval(timer); timer = null; bPlay.textContent = '▶ 自動 0 → 4'; };
  const bPlay = h('button', { type: 'button', class: 'btn', onclick: () => { if (timer) return stop(); bPlay.textContent = '■ 停止'; d = -1;
    const tick = () => { d = (d + 1) % 5; seg.set(String(d), true); paint(); if (d === 4) stop(); }; tick(); timer = setInterval(tick, 1400); } }, '▶ 自動 0 → 4');

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
          ...[cTop, cSide].map((c) => { c.style.position = 'absolute'; c.style.inset = '0'; return h('div', { style: { position: 'relative', minHeight: '0' } }, c); })),
        h('div', { class: 'src' }, '模擬影像（同一個姿態，只改外觀）。訓練資料混合難度 0–4，讓 CNN 看過退化的畫面。')),
      h('div', { class: 'col' },
        h('div', { class: 'card dark', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center' } },
          h('div', null, h('div', { style: { color: '#cfd9ec' } }, '傳統方法'), nT), h('div', null, h('div', { style: { color: '#cfd9ec' } }, '雙視角 CNN'), nC)),
        h('div', { class: 'card dark fill', style: { padding: '6px 8px' } }, bars),
        h('div', { class: 'card dark' },
          h('ul', { class: 'k-ul' },
            h('li', null, h('b', null, '乾淨影像傳統方法就夠準：'), '誤差比 CNN 小 6–9 倍'),
            h('li', null, h('b', null, '影像一變差傳統先崩：'), '難度 2 剩 54%、難度 3 剩 5%；拆解後主因是背景干擾，不是雜訊'),
            h('li', null, h('b', null, 'CNN 在難度 4 仍 99.7% 合格'), '→ ML 的價值是退化影像下的穩健性')),
          h('div', { class: 'src', style: { marginTop: '4px' } }, '合格＝XY ±40 µm、間隙 ±50 µm、傾斜 ±2.5°；五軸模擬、每難度同一組姿態（ML 課程報告第 22 頁）。全部是模擬，沒有真機驗證。')))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp22');
  return { show() { paint(); }, hide: stop };
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
  const avg = h('div', { class: 'big2', style: { color: '#ffb547' } });
  const btns = VERS.map((q, k) => h('button', { type: 'button', class: q.fin ? 'fin' : '', onclick: () => pick(k) }, `${k + 1}. ${q.name}`));
  const anim = loop(() => { const a = Math.min(1, (performance.now() - t0) / 600), e = a * a * (3 - 2 * a);
    cur = from.map((x, i) => x + (VERS[v].vals[i] - x) * e); paint(); if (a >= 1) anim.stop(); });
  function paint() {
    drawBars(B, { cats: ['難度 0', '1', '2', '3', '4'], sel: null, ymax: 100, label: '嚴格範圍達標率 %',
      series: [{ name: VERS[v].name, color: VERS[v].fin ? '#5fd068' : '#ffb547', vals: cur, ghost: v ? VERS[0].vals : null }] });
  }
  function pick(k) {
    v = k; from = cur.slice(); t0 = performance.now(); anim.start();
    btns.forEach((b, i) => b.classList.toggle('on', i === k));
    note.textContent = VERS[k].note;
    const m = VERS[k].vals.reduce((a, b) => a + b, 0) / 5;
    avg.textContent = `${m.toFixed(1)}%`; avg.style.color = VERS[k].fin ? '#5fd068' : '#ffb547';
  }
  const stop = () => { clearInterval(timer); timer = null; bPlay.textContent = '▶ 一步步播放'; };
  const bPlay = h('button', { type: 'button', class: 'btn', onclick: () => { if (timer) return stop(); bPlay.textContent = '■ 停止'; let k = 0; pick(0);
    timer = setInterval(() => { k++; pick(k); if (k === VERS.length - 1) stop(); }, 1600); } }, '▶ 一步步播放');
  const p95 = h('table', { class: 'p95' },
    h('tr', null, h('th', null, '難度'), h('th', null, 'dx'), h('th', null, 'dy'), h('th', null, '間隙'), h('th', null, '傾斜')),
    h('tr', null, h('td', null, '0（乾淨）'), h('td', null, '3.3'), h('td', null, '2.3'), h('td', null, '4.8'), h('td', null, '0.21°')),
    h('tr', null, h('td', null, '4（最差）'), h('td', null, '13.0'), h('td', null, '10.5'), h('td', null, '12.7'), h('td', null, '0.60°')),
    h('tr', null, h('td', null, '規格'), h('td', { colspan: 2 }, '±40'), h('td', null, '±50'), h('td', null, '±2.5°')));

  body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.45fr 1fr' } },
    h('div', { class: 'card dark col', style: { gap: '8px' } },
      h('div', { class: 'row' }, h('div', { class: 'ver' }, ...btns), bPlay),
      note,
      h('div', { class: 'fill' }, bars),
      h('div', { class: 'src' }, '嚴格範圍＝XY ≤10 µm、間隙 ≤12.5 µm、傾斜 ≤0.625°（規格的 1/4）。虛線框＝基準。1–4 版用同一個測試集（ML 課程報告第 20 頁）；最終模型用另外保留、只評估一次的最終測試集 T*（3000 個姿態）。')),
    h('div', { class: 'col' },
      h('div', { class: 'card dark', style: { textAlign: 'center' } },
        h('div', { style: { color: '#cfd9ec' } }, '五個難度平均嚴格達標率'), avg,
        h('div', { class: 'src' }, '最終模型：規格範圍（寬鬆）達標 100%；3 個種子 93.3／89.9／94.3%')),
      h('div', { class: 'card dark' }, h('div', { class: 'k-h' }, '最終模型的誤差（第 95 百分位，µm）'), p95),
      h('div', { class: 'card dark fill' },
        h('ul', { class: 'k-ul' },
          h('li', null, h('b', null, '交付單一 CNN＋鏡射測試時增強；'), 'stacking 在新 CNN 上沒有增益（94.2 對 94.3%），不採用'),
          h('li', null, h('b', null, '誤差遠小於規格：'), '相機只負責送進 ±40 µm，之後交給 2-7 的光訊號精對位'),
          h('li', null, h('b', null, '限制：'), '全部是模擬影像、難度自訂；FLIR 相機已到，鏡頭未定；實機第一天要量 µm/px 與景深，做 sim-to-real 校正'))))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp22');
  pick(VERS.length - 1); cur = VERS[VERS.length - 1].vals.slice();
  return { show() { paint(); }, hide: stop };
}

export function mount(sec) {
  sec.slide({ title: '高倍率相機：景深只有幾 µm，偏一點就失焦', sub: '' }, camSlide);
  sec.slide({ title: '雙視角 CNN：影像越差，ML 越有價值', sub: '' }, cnnSlide);
  sec.slide({ title: '最終相機模型：嚴格範圍平均達標 94.3%（模擬）', sub: '' }, finalSlide);
}
