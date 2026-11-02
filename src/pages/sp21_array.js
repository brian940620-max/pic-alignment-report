// 計畫版 2-1「陣列模場與六軸建模」（2026-11-02 重做，取代 fa_pic.js 那頁在 2-1 的位置）：
// 一眼看懂：整支陣列是剛體，角度在陣列上變成「力臂 × 角度」的位移，越外側的通道偏越多。
// 左：六軸拉桿＋快捷情境；中：PIC 端面正視（整支 FA 的位置，偏移放大）＋8 個通道的端面光強度；右：最差通道與 8 通道損耗。
// 模型 ../fa8.js（FA8_Lensed_PIC v1.0 移植，與 MATLAB 核對）；不放公式。
import { h, slider, fitCanvas, loop, clamp, DEG } from '../ui.js';
import { FA8, etaFA, peakFA, facetSpot } from '../fa8.js';
import { jet } from '../field6.js';

const PK = peakFA(FA8), N = FA8.nCh, U = Array.from({ length: N }, (_, k) => (k - (N - 1) / 2) * FA8.pitch);
const dBrel = (e) => 10 * Math.log10(Math.max(e / PK, 1e-12));
const colDb = (db) => (db > -1 ? '#5fd068' : db > -3 ? '#ffb547' : '#ff6b6b');
const AX = [['X 沿陣列', -3, 3, 0.01, 'µm', 1, 2], ['Y 垂直晶片', -3, 3, 0.01, 'µm', 1, 2], ['Z 間距', 4, 30, 0.1, 'µm', 1, 1],
  ['θx 俯仰', -2, 2, 0.01, '°', DEG, 2], ['θy 偏擺', -1, 1, 0.005, '°', DEG, 3], ['θz 滾轉', -0.2, 0.2, 0.001, '°', DEG, 3]];
const HOME = [0, 0, FA8.WD, 0, 0, 0];
const PRESETS = [['θz 滾轉 0.1°', [0, 0, FA8.WD, 0, 0, 0.1]], ['θy 偏擺 0.5°', [0, 0, FA8.WD, 0, 0.5, 0]], ['Y 偏 0.6 µm', [0, 0.6, FA8.WD, 0, 0, 0]]];
const MAG = 40;   // 正視圖的偏移放大倍率

const CSS = `
.sp21a .card.dark { padding:10px 14px; }
.sp21a .k-h { font-size:17px; font-weight:800; color:#fff; margin:0 0 4px; }
.sp21a .pane { position:relative; min-height:0; }
.sp21a .pane > canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.sp21a .six { display:grid; grid-template-columns:1fr; gap:0; } .sp21a .slider { margin:3px 0; }
.sp21a input[type=range] { margin-left:0; margin-right:0; }
.sp21a .pre { display:flex; flex-wrap:wrap; gap:6px; }
.sp21a .pre button { font:inherit; font-size:14.5px; padding:5px 10px; border-radius:8px; cursor:pointer; border:1px solid rgba(255,181,71,.6); background:rgba(255,181,71,.12); color:#ffe0b0; }
.sp21a .pre button.on { background:#ffb547; color:#1a1206; font-weight:700; }
.sp21a .kp { text-align:center; } .sp21a .kp b { display:block; font-family:var(--mono); font-size:44px; font-weight:800; line-height:1.1; }
.sp21a .kp span { font-size:15px; color:#cfd9ec; }
.sp21a .take { font-size:19px; font-weight:800; color:#ffd29a; text-align:center; line-height:1.45; }
`;
const pane = (c) => { c.style.position = 'absolute'; return h('div', { class: 'pane fill' }, c); };

function arraySlide(body) {
  const v = HOME.slice();
  const cF = h('canvas'), cT = h('canvas'), cB = h('canvas');
  const F = fitCanvas(cF, () => draw()), T = fitCanvas(cT, () => draw()), B = fitCanvas(cB, () => draw());
  const kpV = h('b'), kpS = h('span');
  let pend = false; const req = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; draw(); }); };
  const stopDemo = () => { anim.stop(); bDemo.textContent = '▶ 滾轉示範'; bDemo.setAttribute('aria-pressed', 'false'); };
  const SL = AX.map(([label, min, max, step, unit, , digits], i) => slider({ label, min, max, step, value: v[i], unit, digits, onInput: (x) => { stopDemo(); v[i] = x; preBtns.forEach((b) => b.classList.remove('on')); req(); } }));
  const setPose = (p) => { p.forEach((x, i) => { v[i] = x; SL[i].set(x, true); }); req(); };
  const preBtns = PRESETS.map(([t, p]) => h('button', { type: 'button', onclick: (e) => { stopDemo(); setPose(p); preBtns.forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } }, t));
  const bHome = h('button', { type: 'button', class: 'btn ghost', onclick: () => { stopDemo(); setPose(HOME); preBtns.forEach((b) => b.classList.remove('on')); } }, '歸零');
  let phase = 0;
  const anim = loop((dt) => { phase += dt; v[5] = 0.15 * Math.sin(phase * Math.PI / 3); SL[5].set(v[5], true); draw(); });
  const bDemo = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => {
    if (anim.running) return stopDemo();
    setPose(HOME); preBtns.forEach((b) => b.classList.remove('on')); phase = 0;
    bDemo.textContent = 'Ⅱ 暫停示範'; bDemo.setAttribute('aria-pressed', 'true'); anim.start();
  } }, '▶ 滾轉示範');

  function draw() {
    const pose = v.map((x, i) => x * AX[i][5]), C = etaFA(pose), db = C.map((c) => dBrel(c.e)), worst = Math.min(...db), kw = db.indexOf(worst);
    const spots = C.map((c) => facetSpot(c, pose));
    // ---- PIC 端面正視：耦合器（藍）與整支 FA 的光斑位置（橘，偏移放大 MAG 倍）----
    { const { ctx, w, h: H } = F; if (w) {
      ctx.clearRect(0, 0, w, H);
      const span = 1200, sx = (w - 40) / span, X = (u) => w / 2 + u * sx, cy = H * 0.52, Y = (y) => cy - y * MAG * sx;
      // 晶片端面帶
      ctx.fillStyle = 'rgba(125,138,166,.28)'; ctx.fillRect(14, cy - 26, w - 28, 52); ctx.strokeStyle = 'rgba(160,175,205,.5)'; ctx.strokeRect(14, cy - 26, w - 28, 52);
      ctx.fillStyle = '#93a6c6'; ctx.font = '14px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('PIC 端面 · 8 通道 · 間距 127 µm', 18, H - 26);
      // FA 本體：沿光斑中心連成的剛體條
      const P = spots.map((s, k) => [X(U[k] + MAG * s.cx), Y(s.cy)]);
      const ang = Math.atan2(P[N - 1][1] - P[0][1], P[N - 1][0] - P[0][0]), len = Math.hypot(P[N - 1][0] - P[0][0], P[N - 1][1] - P[0][1]);
      const mx = (P[0][0] + P[N - 1][0]) / 2, my = (P[0][1] + P[N - 1][1]) / 2;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.fillStyle = 'rgba(255,138,61,.12)'; ctx.strokeStyle = 'rgba(255,138,61,.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(-len / 2 - 26, -22, len + 52, 44, 10); ctx.fill(); ctx.stroke(); ctx.restore();
      // 耦合器與光斑
      for (let k = 0; k < N; k++) {
        ctx.strokeStyle = '#4f8cff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(X(U[k]), cy, 7, 6, 0, 0, 7); ctx.stroke();
        const [px, py] = P[k], r = clamp(spots[k].w / FA8.wf, 1, 3) * 7, hot = k === kw && worst < -0.05;
        ctx.fillStyle = colDb(db[k]); ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (hot) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r + 4, 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#dfe8fa'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${k + 1}`, X(U[k]), cy + 30);
      }
      // 旋轉中心
      ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(mx, my, 4, 0, 7); ctx.fill();
      ctx.font = '600 13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('旋轉中心', mx, my - 26);
      ctx.fillStyle = '#93a6c6'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '14px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillText(`藍圈：晶片模場　彩點：FA 光斑　偏移 ×${MAG}`, 18, 34);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '700 15px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillText('整支陣列一起動（正視）', 18, 8);
    } }
    // ---- 8 個通道的端面光強度（±4 µm），白虛線＝晶片模場 ----
    { const { ctx, w, h: H } = T; if (w) {
      ctx.clearRect(0, 0, w, H);
      const gap = 8, s = Math.min((w - gap * (N - 1)) / N, H - 24), x0 = (w - (s * N + gap * (N - 1))) / 2, HW = 4, NG = 61;
      spots.forEach((q, k) => {
        const tx = x0 + k * (s + gap), img = ctx.createImageData(NG, NG);
        for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) { const x = -HW + (2 * HW * j) / (NG - 1), y = HW - (2 * HW * i) / (NG - 1);
          const I = q.I0 * Math.exp((-2 * ((x - q.cx) ** 2 + (y - q.cy) ** 2)) / q.w ** 2), [r, g, b] = jet(I); img.data.set([r * 255, g * 255, b * 255, 255], (i * NG + j) * 4); }
        const oc = document.createElement('canvas'); oc.width = oc.height = NG; oc.getContext('2d').putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true; ctx.drawImage(oc, tx, 0, s, s);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.ellipse(tx + s / 2, s / 2, (FA8.wChip[0] / (2 * HW)) * s, (FA8.wChip[1] / (2 * HW)) * s, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = k === kw && worst < -0.05 ? '#fff' : 'rgba(140,170,230,.35)'; ctx.lineWidth = k === kw && worst < -0.05 ? 2.5 : 1; ctx.strokeRect(tx, 0, s, s);
        ctx.fillStyle = colDb(db[k]); ctx.font = '700 13.5px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${db[k].toFixed(2)} dB`, tx + s / 2, s + 5);
      });
    } }
    // ---- 8 通道損耗長條 ----
    { const { ctx, w, h: H } = B; if (w) {
      ctx.clearRect(0, 0, w, H);
      const limit = Math.max(6, Math.ceil(-worst / 3) * 3);
      const m = { l: 56, r: 8, t: 8, b: 24 }, pw = w - m.l - m.r, ph = H - m.t - m.b, Y = (d) => m.t + (clamp(-d, 0, limit) / limit) * ph, bw = pw / N;
      ctx.font = '12.5px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      for (const d of [0, -1, -limit / 2, -limit]) { ctx.strokeStyle = d === -1 ? 'rgba(95,208,104,.65)' : 'rgba(140,170,230,.15)'; ctx.setLineDash(d === -1 ? [5, 4] : []); ctx.beginPath(); ctx.moveTo(m.l, Y(d)); ctx.lineTo(w - m.r, Y(d)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#93a6c6'; ctx.fillText(`${d} dB`, m.l - 5, Y(d)); }
      db.forEach((d, k) => { ctx.fillStyle = colDb(d); ctx.fillRect(m.l + k * bw + bw * 0.16, Y(0), bw * 0.68, Math.max(2, Y(d) - Y(0))); ctx.fillStyle = '#cfd9ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${k + 1}`, m.l + k * bw + bw / 2, H - m.b + 5); });
    } }
    kpV.textContent = `${worst.toFixed(2)} dB`; kpV.style.color = colDb(worst);
    kpS.textContent = worst < -0.05 ? `最差：第 ${kw + 1} 通道` : '8 個通道都對準';
  }

  body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '300px 1.55fr 0.8fr' } },
    h('div', { class: 'card dark col', style: { gap: '6px' } },
      h('div', { class: 'k-h' }, '轉一點，看看 8 通道'), h('div', { class: 'pre' }, bDemo, ...preBtns, bHome),
      h('div', { class: 'six' }, SL.map((s) => s.el))),
    h('div', { class: 'col' },
      h('div', { class: 'card dark fill', style: { padding: '6px 8px', display: 'flex', flexDirection: 'column' } }, pane(cF)),
      h('div', { class: 'card dark', style: { padding: '8px', flex: 'none', height: '150px', display: 'flex', flexDirection: 'column' } }, pane(cT), h('div', { style: { fontSize: '13px', color: '#cfd9ec' } }, '端面光強度（±4 µm） · 白虛線：晶片模場'))),
    h('div', { class: 'col' },
      h('div', { class: 'card dark kp' }, h('span', null, '陣列最差通道'), kpV, kpS),
      h('div', { class: 'card dark fill', style: { padding: '6px 8px', display: 'flex', flexDirection: 'column' } }, h('div', { class: 'k-h' }, '8 個通道的損耗'), pane(cB)),
      h('div', { class: 'card dark take' }, '滾轉時，外側通道偏最多'))));
  body.append(h('div', { style: { fontSize: '12px', color: '#93a6c6' } }, '理想 FA 模擬 · 損耗相對標稱對準值 · 工作距離 14 µm 為假設'));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp21a');
  draw();
  return { show() { F.apply(); T.apply(); B.apply(); draw(); }, hide() { stopDemo(); } };
}

export function mount(sec) {
  sec.slide({ title: '陣列六軸建模（計畫版）', sub: '' }, arraySlide);
}
