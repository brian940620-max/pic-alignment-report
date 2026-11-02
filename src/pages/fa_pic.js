// 分頁 ④ 陣列光纖對 PIC：原 6 個視圖整合成 4 個主題頁；模型與補償各含兩個可切換視圖。
// 視圖順序：陣列模場（呼應 ① 六軸偏差：8 個通道在 PIC 端面上的光斑）
//   → 建模：每個通道都是六軸單通道問題（含八通道整排遠視圖）→ 對位策略（互動）→ 以第 1 通道為圓心（旋轉中心）→ XY 補回 3D 互動
//   → 怎麼定義光耦合成功（使用者清單未列，暫放最後）。前兩張用 src/fa8.js 的透鏡參數；後 4 張仍是 UHNA 示意參數。
// 幾何：N 個通道沿 X 排列，第 1 通道在原點、第 i 通道在 x_i = (i−1)·P；每個通道對準自己的 SSC。
//   θz（端面內旋轉）繞旋轉中心 c：通道位置 c + R(θz)(x_i − c)；θy（偏擺，繞垂直軸、過第 1 通道）：第 i 通道間距 g₀ + x_i·sinθy、光軸傾 θy。
// 耦合效率用 physics.js 的高斯重疊；模場：UHNA 陣列（w 1.75 µm）→ SSC（w 1.5 µm），光腰在光纖端面。
// 量測假設：第 1 與第 N 通道各自量得到功率。
import { h, slider, segmented, fitCanvas, DEG } from '../ui.js';
import { eta } from '../physics.js';
import { tex } from '../tex.js';
import { C3D_CSS } from '../couple3d.js';
import { XYComp3D } from '../xycomp3d.js';
import { FA8, etaFA, peakFA, tol1dB as tolFA8, pivotX, facetSpot, rotR } from '../fa8.js';
import { jet } from '../field6.js';

export const PM = { wf: 1.75, WD: 0, wgx: 1.5, wgy: 1.5 };
// 各頁底部出處（期刊論文為主；PI 為廠商技術文章，標明非期刊）
const SRC = {
  xu: 'Y. Xu et al., “3D-printed facet-attached microlenses for advanced photonic system assembly,” Light: Advanced Manufacturing 4(2), 77–93 (2023), doi:10.37188/lam.2023.003',
  mar: 'R. Marchetti et al., “Coupling strategies for silicon photonics integrated chips,” Photonics Research 7(2), 201–239 (2019), doi:10.1364/PRJ.7.000201',
  model: '　模型參數：UHNA 模場直徑約 3–4 µm（Marchetti 2019, p. 203）；SSC 約 3×3 µm（L. Carroll et al., “Photonic packaging: transforming silicon photonic integrated circuits into photonic devices,” Applied Sciences 6(12), 426 (2016), doi:10.3390/app6120426, p. 4）。',
  pi: '　旋轉中心設在第 1 通道、以 XY 鎖定吸收中心偏差的做法：S. Jordan, “Fiber array alignment, photonic device assembly, with new tools,” Physik Instrumente 技術文章（廠商文件，非期刊）。',
};
export const PEAK = eta(PM, { dx: 0, dy: 0, gap: 0, tx: 0, ty: 0 });
const dB = (v) => 10 * Math.log10(Math.max(v, 1e-12));
const font = (s, w = 400) => `${w} ${s}px system-ui, "Microsoft JhengHei", sans-serif`;
const CSS = `.fa-k { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .fa-k > div { background:rgba(255,255,255,.05); border:1px solid rgba(140,170,230,.25); border-radius:10px; padding:6px 10px; text-align:center; }
.fa-k b { display:block; font-family:var(--mono); font-size:24px; color:#ffb86b; } .fa-k span { font-size:13px; color:#93a6c6; }
.fa-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; flex:none; }
.fa-steps > div { border:1px solid rgba(140,170,230,.25); border-radius:12px; padding:8px 14px; background:rgba(12,20,38,.8); color:#c8d5ec; transition:.25s; }
.fa-steps > div.on { border-color:#ffb86b; background:rgba(255,138,61,.16); box-shadow:0 0 18px rgba(255,138,61,.25); color:#fff; }
.fa-steps b { display:block; font-size:17px; color:#ffb86b; margin-bottom:2px; } .fa-steps span { font-size:14px; line-height:1.45; display:block; }
.fa-txt { font-size:15px; line-height:1.6; color:#dfe8fa; } .fa-txt b { color:#ffb86b; }`;

// 共用：通道數、間距（第 2、5 頁可改，其他頁跟著用）
export const S = { N: 8, P: 127 };
const span = () => (S.N - 1) * S.P;

// 第 i 個通道（0 起算）的偏移與效率
export function chan(i, o) {
  const x = i * S.P, c = o.pivot || { x: 0, y: 0 }, th = o.thz || 0, thy = o.thy || 0;
  const rx = c.x + Math.cos(th) * (x - c.x) - Math.sin(th) * (0 - c.y), ry = c.y + Math.sin(th) * (x - c.x) + Math.cos(th) * (0 - c.y);
  const ox = rx - x + (o.dx || 0), oy = ry + (o.dy || 0), gap = (o.g0 || 0) + x * Math.sin(thy);
  return { x, ox, oy, gap, e: eta(PM, { dx: ox, dy: oy, gap, tx: thy, ty: 0 }) };
}
export const chans = (o) => Array.from({ length: S.N }, (_, i) => chan(i, o));

// 1 dB 橫向容差與對應的 θz 容差
function tol1dB() {
  let lo = 0, hi = 20;
  for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (eta(PM, { dx: 0, dy: m, gap: 0, tx: 0, ty: 0 }) > PEAK * 10 ** -0.1) lo = m; else hi = m; }
  return { lat: lo, thz: Math.asin(lo / span()) };
}

// 共用：PIC 端面正視（藍＝SSC、橘＝光纖纖芯；偏移放大 mag 倍、通道間距不放大）
function drawFacetRow(ctx, box, C, o = {}) {
  const { x: L0, y: T0, w, h: Hh } = box, mag = o.mag || 14, L = L0 + 34, R = L0 + w - 34, yc = T0 + Hh / 2;
  const X = (x) => L + (x / (span() || 1)) * (R - L), rr = Math.min(12, ((R - L) / S.N) * 0.28);
  ctx.fillStyle = '#18202f'; ctx.fillRect(L0, T0, w, Hh); ctx.strokeStyle = 'rgba(140,170,230,.3)'; ctx.lineWidth = 1; ctx.strokeRect(L0, T0, w, Hh);
  C.forEach((c, i) => {
    const x = X(c.x), hl = o.hl && o.hl.includes(i);
    ctx.fillStyle = 'rgba(56,189,248,.22)'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, yc, rr, 0, 7); ctx.fill(); ctx.stroke();
    const fx = x + c.ox * mag, fy = yc - c.oy * mag;
    ctx.fillStyle = hl ? 'rgba(255,138,61,.6)' : 'rgba(255,138,61,.32)'; ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = hl ? 3 : 2; ctx.beginPath(); ctx.arc(fx, fy, rr, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yc); ctx.lineTo(fx, fy); ctx.stroke();
    if (S.N <= 16 || i === 0 || i === S.N - 1) { ctx.fillStyle = hl ? '#ffb86b' : '#93a6c6'; ctx.font = font(12, hl ? 700 : 400); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(i === 0 ? '第 1' : i === S.N - 1 ? `第 ${S.N}` : `${i + 1}`, x, yc + rr + 26); }
  });
  if (o.pivot) {                                        // 旋轉中心（畫面外就畫箭頭）
    const px = X(o.pivot.x), inside = px >= L0 && px <= L0 + w;
    ctx.strokeStyle = '#ffd29a'; ctx.fillStyle = '#ffd29a'; ctx.lineWidth = 2;
    if (inside) { ctx.beginPath(); ctx.moveTo(px - 8, yc - 8); ctx.lineTo(px + 8, yc + 8); ctx.moveTo(px + 8, yc - 8); ctx.lineTo(px - 8, yc + 8); ctx.stroke(); }
    ctx.font = font(13, 600); ctx.textAlign = inside ? 'center' : 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(inside ? '旋轉中心' : `旋轉中心在右邊 ${(o.pivot.x / 1000).toFixed(2)} mm →`, inside ? px : L0 + w - 8, inside ? yc - rr - 10 : yc - rr - 30);
  }
  ctx.fillStyle = '#fff'; ctx.font = font(14, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(o.title || `PIC 端面正視：藍＝SSC，橘＝光纖纖芯（偏移放大 ${mag} 倍，通道間距 ${S.P} µm 未放大）`, L0 + 8, T0 + 6);
  return { X, yc };
}

// 共用：每個通道的耦合效率長條（dB）
function drawBars(ctx, box, C, o = {}) {
  const { x: L0, y: T0, w, h: Hh } = box, L = L0 + 46, R = L0 + w - 10, T = T0 + 26, B = T0 + Hh - 22, lo = o.lo ?? -6;
  ctx.strokeStyle = 'rgba(140,170,230,.25)'; ctx.lineWidth = 1; ctx.strokeRect(L0, T0, w, Hh);
  const Y = (v) => T + (Math.max(lo, Math.min(0, v)) / lo) * (B - T), bw = Math.min(40, ((R - L) / S.N) * 0.6);
  ctx.fillStyle = '#93a6c6'; ctx.font = font(12); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = 0; v >= lo; v += lo / 3) { ctx.strokeStyle = 'rgba(140,170,230,.12)'; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke(); ctx.fillText(`${v.toFixed(0)}`, L - 6, Y(v)); }
  const ref = dB(PEAK) - 1; ctx.setLineDash([4, 4]); ctx.strokeStyle = '#ffd29a'; ctx.beginPath(); ctx.moveTo(L, Y(ref)); ctx.lineTo(R, Y(ref)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#ffd29a'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('比對準時低 1 dB', R, Y(ref) - 2);
  C.forEach((c, i) => {
    const x = L + ((i + 0.5) / S.N) * (R - L), v = dB(c.e), col = v > ref ? '#69db7c' : v > dB(PEAK) - 3 ? '#ffd43b' : '#ff6b6b';
    ctx.fillStyle = col; ctx.fillRect(x - bw / 2, T, bw, Y(v) - T);
    if (S.N <= 16) { ctx.fillStyle = '#dfe8fa'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = font(11.5); ctx.fillText(v < lo ? `< ${lo}` : v.toFixed(2), x, Y(v) + 3); }
    if (S.N <= 16 || i % 4 === 0 || i === S.N - 1) { ctx.fillStyle = '#93a6c6'; ctx.textBaseline = 'top'; ctx.font = font(12); ctx.fillText(`${i + 1}`, x, B + 4); }
  });
  ctx.fillStyle = '#fff'; ctx.font = font(14, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.title || '每個通道的耦合效率（dB，越短越好）', L0 + 8, T0 + 6);
}

const bgFill = (ctx, W, H) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1424'); g.addColorStop(1, '#060b16'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
const segNP = (redraw) => [
  segmented([4, 8, 16].map((n) => ({ id: String(n), label: `${n} 通道` })), String(S.N), (id) => { S.N = +id; redraw(); }),
  segmented([{ id: '127', label: '間距 127 µm' }, { id: '250', label: '250 µm' }], String(S.P), (id) => { S.P = +id; redraw(); }),
];

// Four presentation topics; complementary views stay available within each topic.
export function mount(sec, ctx) {
  const slides = [];
  mountViews({ slide: (opts, build) => slides.push({ opts, build }) }, ctx);
  const groups = [
    { title: '陣列模場與六軸建模', ids: [0, 1], labels: ['通道光斑與六軸偏差', '整排幾何與容差'], model: '透鏡陣列模型 · 8 通道 · WD 14 µm（假設）' },
    { title: '陣列光纖對 PIC：對位策略', ids: [2], model: 'UHNA 示意模型 · 光腰在光纖端面' },
    { title: '旋轉中心與 XY 補償', ids: [3, 4], labels: ['偏移與補償量', 'XY 補回：3D 演示'], model: 'UHNA 示意模型 · 光腰在光纖端面' },
    { title: '怎麼定義光耦合成功', ids: [5], model: 'UHNA 示意模型 · 1 dB 為本報告判定門檻' },
  ];
  groups.forEach(group => sec.slide({ title: group.title, sub: '' }, body => {
    body.closest('.slide').classList.add('edge-ui', 'array-ui');
    let selected = 0, visible = false;
    const panes = [], hooks = [], buttons = [];
    const activate = i => {
      if (i === selected) return;
      if (visible) hooks[selected]?.hide?.();
      selected = i;
      panes.forEach((pane, j) => { pane.hidden = j !== i; buttons[j]?.setAttribute('aria-pressed', String(j === i)); });
      if (visible) hooks[selected]?.show?.();
    };
    const toolbar = h('div', { class: 'array-toolbar' });
    if (group.labels) toolbar.append(h('div', { class: 'array-switch', role: 'group', 'aria-label': '呈現方式' }, group.labels.map((label, i) => {
      const button = h('button', { type: 'button', 'aria-pressed': String(i === 0), onclick: () => activate(i) }, label);
      buttons.push(button); return button;
    })));
    toolbar.append(h('div', { class: 'array-model' }, group.model));
    body.append(toolbar);
    group.ids.forEach((id, i) => {
      const pane = h('div', { class: `array-pane array-view-${id + 1}` });
      body.append(pane); panes.push(pane); pane.hidden = i !== 0;
      hooks.push(slides[id].build(pane) || {});
      // These equations are already presented in the paired optical-field view.
      if (id === 1) {
        pane.querySelectorAll('.card:last-child > .tex').forEach(el => el.remove());
        pane.querySelector('.card:last-child > .fa-txt').textContent = '陣列讓角度變嚴：θz 讓外側通道偏 (uₖ−c)·sinθz，θy 讓兩端間距差 (N−1)P·sinθy。下表比較單通道與陣列最差通道的 1 dB 容差。';
      }
    });
    return { show() { visible = true; hooks[selected]?.show?.(); }, hide() { visible = false; hooks[selected]?.hide?.(); } };
  }));
}

function mountViews(sec, ctx) {
  const modelState = { pose: [0, 0, FA8.WD, 0, 0, 0], pivot: 'center', sel: FA8.nCh - 1 };
  // ============ 1. 陣列模場：8 個通道在 PIC 端面上的光斑（呼應 ① 六軸偏差）============
  // 版面照 ① 六軸偏差（左：六軸拉桿＋各軸單獨造成的損耗；中：端面光強度熱圖），右欄照 ① 角度頁「代入目前的滑桿」。
  // 熱圖＝透鏡光束到晶片端面的高斯光強度（facetSpot，顯示用）；η 用 etaFA（閉式六軸重疊積分，與 MATLAB 逐項相同）。
  sec.slide({ title: '陣列模場：8 個通道在 PIC 端面上的光斑', sub: '' }, (body) => {
    body.append(h('style', null, CSS + `.fm-six { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; } .fm-six .slider { margin:2px 0; }
      .fm-h { color:#ffd29a; font-weight:700; font-size:13.5px; line-height:1.35; margin-top:2px; } .fm-r .tex { font-size:16px; padding:1px 0; }
      .fm-live { font-family:var(--mono); font-size:13px; line-height:1.55; color:#dfe8fa; background:rgba(8,14,28,.6); border:1px solid rgba(140,170,230,.25); border-radius:8px; padding:4px 8px; }
      .fm-live b { color:#ffb86b; }`));
    const p = FA8, n = p.nCh, peak = peakFA(p), L0 = -10 * Math.log10(peak), dBl = (v) => -10 * Math.log10(Math.max(v, 1e-12));
    const st = modelState;
    const AX = [['X 沿陣列', -3, 3, 0.01, 'µm', 1], ['Y 垂直晶片', -3, 3, 0.01, 'µm', 1], ['Z 尖端間距', 4, 30, 0.1, 'µm', 1],
      ['θx 俯仰', -3, 3, 0.01, '°', DEG], ['θy 偏擺', -1, 1, 0.005, '°', DEG], ['θz 滾轉', -0.2, 0.2, 0.001, '°', DEG]];
    let pend = false; const req = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; draw(); }); };
    const SL = AX.map(([label, min, max, step, unit, sc], i) => slider({ label, min, max, step, value: st.pose[i] / sc, unit, digits: unit === '°' ? 3 : 2, onInput: (v) => { st.pose[i] = v * sc; req(); } }));
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block', cursor: 'pointer' } }), G = fitCanvas(cv, () => draw());
    const bars = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), B = fitCanvas(bars, () => draw());
    const big = h('div', { style: { whiteSpace: 'nowrap', fontFamily: 'var(--mono)', fontSize: '34px', fontWeight: 800, color: '#ffb86b', textShadow: '0 0 16px rgba(255,138,61,.45)' } });
    const sub = h('div', { style: { color: '#93a6c6', fontSize: '15px' } }), live = h('div', { class: 'fm-live' });
    const segP = segmented([{ id: 'center', label: '旋轉中心：陣列中心' }, { id: 'ch1', label: '第 1 通道' }], st.pivot, (id) => { st.pivot = id; req(); });
    const segC = segmented(Array.from({ length: n }, (_, k) => ({ id: String(k), label: `${k + 1}` })), String(st.sel), (id) => { st.sel = +id; req(); });
    const reset = () => { st.pose = [0, 0, p.WD, 0, 0, 0]; SL.forEach((s, i) => s.set(st.pose[i] / AX[i][5], true)); req(); };
    const HW = 5, NG = 81, NAMES = ['X', 'Y', 'Z', 'θx', 'θy', 'θz'];
    let tiles = [];                                        // 點熱圖選通道
    cv.addEventListener('click', (ev) => { const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * (G.w / r.width), y = (ev.clientY - r.top) * (G.h / r.height);
      const k = tiles.findIndex((t) => x >= t.x && x <= t.x + t.s && y >= t.y && y <= t.y + t.s + 40); if (k >= 0) { st.sel = k; segC.set(String(k), true); req(); } });
    function draw() {
      const pose = st.pose, C = etaFA(pose, p, st.pivot), L = C.map((c) => dBl(c.e)), worst = Math.max(...L), kw = L.indexOf(worst);
      big.textContent = `${worst.toFixed(2)} dB`;
      sub.textContent = `最差：第 ${kw + 1} 通道　｜　8 通道平均 ${(L.reduce((a, b) => a + b, 0) / n).toFixed(2)} dB　｜　對準時 ${L0.toFixed(2)} dB`;
      // 右欄：代入選定通道
      const k = st.sel, c = C[k], sp = facetSpot(c, pose, p), px = pivotX(p, st.pivot), lev = c.u - px;
      const f2 = (v) => v.toFixed(2), f3 = (v) => v.toFixed(3);
      live.innerHTML = `第 <b>${k + 1}</b> 通道：u<sub>k</sub> − c = ${lev.toFixed(1)} µm（力臂）<br>` +
        `θz 帶來 (u<sub>k</sub>−c)·sinθz = ${f3(lev * Math.sin(pose[5]))} µm；θy 帶來 −(u<sub>k</sub>−c)·sinθy = ${f2(-lev * Math.sin(pose[4]))} µm 間距<br>` +
        `尖端間距 P<sub>z</sub> = ${f2(c.gap)} µm　光腰 W<sub>k</sub> − s<sub>k</sub> = (${f3(c.ox)}, ${f3(c.oy)}, ${f2(c.wz)}) µm<br>` +
        `到端面：s = ${f2(sp.s)} µm、中心 (${f3(sp.cx)}, ${f3(sp.cy)}) µm、w = ${f2(sp.w)} µm（w<sub>f</sub> ${p.wf}、z<sub>R</sub> ${f2(sp.zR)} µm）<br>` +
        `<b>η<sub>${k + 1}</sub> = ${(100 * c.e).toFixed(2)}%　損失 ${f2(L[k])} dB</b>（對準時 ${L0.toFixed(2)} dB）`;
      if (G.w) {
        const { ctx: g, w: W, h: H } = G; g.clearRect(0, 0, W, H); bgFill(g, W, H);
        g.fillStyle = '#fff'; g.font = font(15, 600); g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillText('PIC 端面上的光強度（1＝對準時峰值）；白虛線＝晶片模場；每格一個通道 ±5 µm', 10, 6);
        const cols = 4, gapX = 22, gapY = 52, top = 34, s = Math.min((W - 20 - (cols - 1) * gapX - 40) / cols, (H - top - 2 * gapY) / 2);
        const x0 = (W - 40 - (cols * s + (cols - 1) * gapX)) / 2;
        tiles = [];
        C.forEach((ch, kk) => {
          const tx = x0 + (kk % cols) * (s + gapX), ty = top + Math.floor(kk / cols) * (s + gapY), q = facetSpot(ch, pose, p);
          tiles.push({ x: tx, y: ty, s });
          const img = g.createImageData(NG, NG);
          for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) {
            const x = -HW + (2 * HW * j) / (NG - 1), y = HW - (2 * HW * i) / (NG - 1);
            const I = q.I0 * Math.exp((-2 * ((x - q.cx) ** 2 + (y - q.cy) ** 2)) / q.w ** 2), [r, gg, b] = jet(I);
            img.data.set([r * 255, gg * 255, b * 255, 255], (i * NG + j) * 4);
          }
          const oc = document.createElement('canvas'); oc.width = oc.height = NG; oc.getContext('2d').putImageData(img, 0, 0);
          g.imageSmoothingEnabled = true; g.drawImage(oc, tx, ty, s, s);
          const X = (x) => tx + ((x + HW) / (2 * HW)) * s, Y = (y) => ty + ((HW - y) / (2 * HW)) * s;
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(0), ty); g.lineTo(X(0), ty + s); g.moveTo(tx, Y(0)); g.lineTo(tx + s, Y(0)); g.stroke();
          g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.ellipse(X(0), Y(0), (p.wChip[0] / (2 * HW)) * s, (p.wChip[1] / (2 * HW)) * s, 0, 0, 7); g.stroke(); g.setLineDash([]);
          g.strokeStyle = kk === st.sel ? '#ffb86b' : 'rgba(140,170,230,.35)'; g.lineWidth = kk === st.sel ? 3 : 1; g.strokeRect(tx - 1, ty - 1, s + 2, s + 2);
          const v = L[kk];
          g.fillStyle = kk === st.sel ? '#ffb86b' : '#dfe8fa'; g.font = font(14, 700); g.textAlign = 'center'; g.textBaseline = 'top';
          g.fillText(`第 ${kk + 1}　${(100 * ch.e).toFixed(1)}%`, tx + s / 2, ty + s + 5);
          g.fillStyle = v <= L0 + 1 ? '#69db7c' : v <= L0 + 3 ? '#ffd43b' : '#ff6b6b'; g.font = font(13);
          g.fillText(`${v > 60 ? '> 60' : v.toFixed(2)} dB`, tx + s / 2, ty + s + 24);
        });
        const cx0 = W - 30, T = top, S = 2 * s + gapY;
        for (let i = 0; i < S; i++) { const [r, gg, b] = jet(1 - i / S); g.fillStyle = `rgb(${r * 255},${gg * 255},${b * 255})`; g.fillRect(cx0, T + i, 12, 1.2); }
        g.fillStyle = '#c8d5ec'; g.font = font(12); g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText('1', cx0 - 4, T + 6); g.fillText('0', cx0 - 4, T + S - 6);
      }
      // 左下：各軸單獨造成的損耗（陣列最差通道，dB，扣掉對準值）
      if (B.w) {
        const { ctx: g, w: W, h: H } = B; g.clearRect(0, 0, W, H);
        const loss = NAMES.map((_, a) => { const one = [0, 0, p.WD, 0, 0, 0]; one[a] = pose[a]; return Math.max(0, Math.max(...etaFA(one, p, st.pivot).map((cc) => dBl(cc.e))) - L0); });
        const mx = Math.max(1, ...loss), rowH = Math.min(30, (H - 30) / 6);
        g.fillStyle = '#dce9f5'; g.font = font(14, 600); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('各軸單獨造成的損耗（最差通道，dB）', 4, 18);
        loss.forEach((v, i) => {
          const y = 30 + i * rowH, left = 34, width = W - 90;
          g.fillStyle = '#acc4db'; g.font = font(14); g.textAlign = 'left'; g.fillText(NAMES[i], 4, y + 13);
          g.fillStyle = '#263e56'; g.fillRect(left, y, width, 16);
          g.fillStyle = v < 0.5 ? '#88cbbd' : v < 3 ? '#f1c58e' : '#ed8c79'; g.fillRect(left, y, (width * v) / mx, 16);
          g.fillStyle = '#e5f0fa'; g.textAlign = 'right'; g.fillText(v.toFixed(2), W - 5, y + 13);
        });
      }
    }
    const hd = (s) => h('div', { class: 'fm-h' }, s);
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '380px 1.25fr 0.85fr' } },
      h('div', { class: 'card dark col', style: { gap: '6px' } },
        h('div', { class: 'fm-six' }, SL.map((s) => s.el)), segP.el,
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: reset }, '全部歸零')),
        h('div', { class: 'fill', style: { minHeight: '170px' } }, bars),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => ctx && ctx.goTitle('六軸偏差') }, '← 對照 六軸偏差（單通道）'))),
      h('div', { class: 'card dark col', style: { padding: '6px 8px', gap: '4px' } }, h('div', { class: 'fill' }, cv),
        h('div', { class: 'col', style: { flex: 'none', alignItems: 'center', textAlign: 'center', gap: '2px', padding: '6px 0 8px', borderTop: '1px solid rgba(140,170,230,.2)' } },
          h('div', { style: { color: '#93a6c6', fontSize: '15px' } }, '陣列最差通道的耦合損耗（閉式六軸重疊積分）'), big, sub)),
      h('div', { class: 'card dark col fm-r', style: { gap: '3px' } },
        hd('① 整支陣列是剛體：第 k 通道的尖端（c＝旋轉中心）'),
        tex('\\mathbf{P}_k=\\mathbf{c}+\\mathbf{t}+R\\,(\\mathbf{p}_k-\\mathbf{c}),\\quad R=R_y R_x R_z'),
        hd('② 透鏡光纖的光腰在尖端前方 WD'),
        tex('\\mathbf{W}_k=\\mathbf{P}_k-\\mathrm{WD}\\,R\\,\\mathbf{e}_z'),
        hd('③ 光腰走到晶片端面：中心再偏、光斑變大（同 ① 角度頁）'),
        tex('\\mathbf{r}_c=(\\mathbf{W}_k-\\mathbf{s}_k)_{xy}-s\\,\\mathbf{d}_{xy},\\quad w=w_f\\sqrt{1+s^2/z_R^2}'),
        hd('④ 代入 ① 的六軸重疊積分，每個通道各算一次'),
        tex('\\eta_k=\\eta_{\\text{六軸}}\\!\\left(\\mathbf{W}_k-\\mathbf{s}_k,\\ \\theta_x,\\theta_y,\\theta_z\\right)'),
        hd('⑤ 代入目前的滑桿（選通道，或點熱圖）'), segC.el, live,
        h('div', { class: 'fa-txt', style: { fontSize: '13.5px', marginTop: 'auto' } }, '和 ① 單通道不同：角度在陣列上會變成「力臂 × 角度」的位移，越外側的通道光斑跑得越遠。'))),
      h('div', { class: 'src', style: { flex: 'none' } }, '單通道六軸重疊積分：St-Amant 2004（同 ①）。' + SRC.mar + '：滾轉力臂（Eq. 24）。透鏡光斑 MFD 3.0 µm（標稱）：Chen et al., Phys. Rev. Applied 25, 014078 (2026)；晶片模場 3.0×2.5 µm 為本研究假設（Xu 2023 實測晶片端面 MFD 2.5 µm；Marchetti 2019 的 SSC 約 3×3 µm）；WD 14 µm 為假設值。熱圖為高斯光束光強度示意（忽略斜入射），η 與 MATLAB FA8_Lensed_PIC 逐項相同。'));
    return { show() { SL.forEach((s, i) => s.set(st.pose[i] / AX[i][5], true)); segP.set(st.pivot, true); G.apply(); B.apply(); draw(); } };
  });

  // ============ 2. 建模：8 通道透鏡光纖陣列 → PIC（FA8_Lensed_PIC，六軸剛體）============
  // 這頁用透鏡光纖參數（src/fa8.js，與 MATLAB 逐項核對），和前 4 頁的 UHNA 示意參數不同。
  sec.slide({ title: '建模：陣列的每個通道都是一個六軸單通道問題', sub: '' }, (body) => {
    body.append(h('style', null, CSS + `.fa8-six .slider { margin:2px 0; }
      table.fa8t { border-collapse:collapse; width:100%; font-size:14px; color:#dfe8fa; } table.fa8t th, table.fa8t td { border:1px solid rgba(140,170,230,.25); padding:3px 8px; text-align:right; font-family:var(--mono); }
      table.fa8t th { color:#93a6c6; font-family:inherit; font-weight:600; } table.fa8t td:first-child, table.fa8t th:first-child { text-align:left; font-family:inherit; }
      table.fa8t td.hot { color:#ffb86b; font-weight:700; }`));
    const p = FA8, n = p.nCh, peak = peakFA(p), st = modelState;
    const AX = [['X 沿陣列', -3, 3, 0.01, 'µm', 1], ['Y 垂直晶片', -3, 3, 0.01, 'µm', 1], ['Z 尖端間距', 4, 30, 0.1, 'µm', 1],
      ['θx 俯仰', -3, 3, 0.01, '°', DEG], ['θy 偏擺', -1, 1, 0.005, '°', DEG], ['θz 滾轉', -0.2, 0.2, 0.001, '°', DEG]];
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), G = fitCanvas(cv, () => draw());
    const SL = AX.map(([label, min, max, step, unit, sc], i) => slider({ label, min, max, step, value: st.pose[i] / sc, unit, digits: unit === '°' ? 3 : 2, onInput: (v) => { st.pose[i] = v * sc; draw(); } }));
    const tbl = h('table', { class: 'fa8t' }), kp = h('div', { class: 'fa-k' });
    const tolTable = () => {
      const rows = ['X', 'Y', 'Z', 'θx', 'θy', 'θz'].map((nm, a) => {
        const sc = a < 3 ? 1 : 1 / DEG, u = a < 3 ? 'µm' : '°', w = tolFA8(a, true, p, st.pivot) * sc, s = a === 5 ? null : tolFA8(a, false, p, st.pivot) * sc;
        const f = (v) => (a < 3 ? v.toFixed(2) : v.toFixed(3));
        return h('tr', null, h('td', null, `${nm}（${u}）`), h('td', null, s == null ? '—（圓形光斑）' : `±${f(s)}`), h('td', { class: s == null || w < 0.7 * s ? 'hot' : '' }, `±${f(w)}`));
      });
      tbl.replaceChildren(h('tr', null, h('th', null, '1 dB 容差'), h('th', null, '單通道'), h('th', null, `陣列最差通道`)), ...rows);
    };
    const segP = segmented([{ id: 'center', label: '陣列中心' }, { id: 'ch1', label: '第 1 通道' }], st.pivot, (id) => { st.pivot = id; tolTable(); draw(); });
    const reset = () => { st.pose = [0, 0, p.WD, 0, 0, 0]; SL.forEach((s, i) => s.set(st.pose[i] / AX[i][5], true)); draw(); };
    function draw() {
      const C = etaFA(st.pose, p, st.pivot), L = C.map((c) => -10 * Math.log10(Math.max(c.e, 1e-12))), L0 = -10 * Math.log10(peak);
      const worst = Math.max(...L);
      kp.replaceChildren(
        h('div', null, h('b', null, `${worst.toFixed(2)} dB`), h('span', null, '最差通道損耗')),
        h('div', null, h('b', null, `${(worst - Math.min(...L)).toFixed(2)} dB`), h('span', null, '通道間差異')),
        h('div', null, h('b', null, `${L[0].toFixed(2)} dB`), h('span', null, '第 1 通道')),
        h('div', null, h('b', null, `${L[n - 1].toFixed(2)} dB`), h('span', null, `第 ${n} 通道`)));
      if (!G.w) return;
      const { ctx, w: W, h: H } = G; ctx.clearRect(0, 0, W, H); bgFill(ctx, W, H);
      // 上：八通道整排遠視圖。通道位置為真實比例；偏差（相對標稱位置）放大 MT／MF 倍：
      // 顯示座標 = 標稱 + M·(真實 − 標稱)，同一張圖用同一個倍率，幾何不失真（尖端不會穿進晶片）。
      const MT = 10, MF = 60, Hf = H * 0.34;
      ctx.fillStyle = '#111a2a'; ctx.fillRect(10, 10, W - 20, Hf); ctx.strokeStyle = 'rgba(140,170,230,.3)'; ctx.lineWidth = 1; ctx.strokeRect(10, 10, W - 20, Hf);
      ctx.fillStyle = '#fff'; ctx.font = font(14, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`八通道整排遠視圖（通道位置真實比例；偏差放大：俯視 ${MT} 倍、正視 ${MF} 倍）`, 18, 16);
      {
        const [X0, Y0, Z0, tx0, ty0, tz0] = st.pose, Rt = rotR(tx0, ty0, tz0), pxv = pivotX(p, st.pivot);
        const tru = (v) => { const w = [v[0] - pxv, v[1], v[2]]; return [0, 1, 2].map((i) => [pxv + X0, Y0, Z0][i] + Rt[i][0] * w[0] + Rt[i][1] * w[1] + Rt[i][2] * w[2]); };
        const D = (v, M) => { const t = tru(v); return [0, 1, 2].map((i) => v[i] + M * (t[i] - v[i])); };
        const u = C.map((c) => c.u), ext = (n - 1) * p.pitch / 2 + 160, half = (W - 50) / 2, bt = 40, bh = Hf - 40;
        const sx = (half - 20) / (2 * ext);
        const cross = (x, y) => { ctx.strokeStyle = '#ffd29a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); };
        const poly = (pts) => { ctx.fillStyle = 'rgba(180,200,230,.13)'; ctx.strokeStyle = 'rgba(180,200,230,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke(); };
        // 左半：俯視（XZ）。晶片在下，陣列在上（z 往上）
        const ox0 = 20 + half / 2, zc = 10 + bt + bh * 0.72, PX = (x) => ox0 + x * sx, PZ = (z) => zc - z * sx;
        ctx.fillStyle = 'rgba(56,189,248,.10)'; ctx.fillRect(20, zc, half, 10 + Hf - zc - 4);
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, zc); ctx.lineTo(20 + half, zc); ctx.stroke();
        u.forEach((uk) => { ctx.strokeStyle = 'rgba(56,189,248,.8)'; ctx.beginPath(); ctx.moveTo(PX(uk), zc); ctx.lineTo(PX(uk), Math.min(10 + Hf - 6, zc + 22)); ctx.stroke(); });
        ctx.fillStyle = '#7fd3ff'; ctx.font = font(12); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('PIC', 24, zc + 4);
        const blk = [[u[0] - 90, 0, 20], [u[n - 1] + 90, 0, 20], [u[n - 1] + 90, 0, 260], [u[0] - 90, 0, 260]].map((v) => D(v, MT));
        poly(blk.map((d) => [PX(d[0]), PZ(d[2])]));
        u.forEach((uk, k) => {
          const t = D([uk, 0, 0], MT), b = D([uk, 0, 20], MT), w = D([uk, 0, -p.WD], MT);
          ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(PX(b[0]), PZ(b[2])); ctx.lineTo(PX(t[0]), PZ(t[2])); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,184,107,.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(PX(t[0]), PZ(t[2])); ctx.lineTo(PX(w[0]), PZ(w[2])); ctx.stroke(); ctx.setLineDash([]);
          if (k === 0 || k === n - 1) { ctx.fillStyle = '#ffb86b'; ctx.font = font(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`第 ${k + 1}`, PX(b[0]), PZ(D([uk, 0, 260], MT)[2]) - 3); }
        });
        const pv = D([pxv, 0, 0], MT); cross(PX(pv[0]), PZ(pv[2]));
        ctx.fillStyle = '#c8d5ec'; ctx.font = font(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('俯視（XZ）：θy 偏擺、X、間距 Z', 20 + half / 2, 10 + bt - 4);
        // 右半：正視（XY，從晶片看向陣列）。藍圈＝耦合器、橘點＝纖芯
        const x1 = 30 + half, oy0 = 10 + bt + bh * 0.5, QX = (x) => x1 + half / 2 + x * sx, QY = (y) => oy0 - y * sx;
        poly([[u[0] - 90, -90, 0], [u[n - 1] + 90, -90, 0], [u[n - 1] + 90, 90, 0], [u[0] - 90, 90, 0]].map((v) => D(v, MF)).map((d) => [QX(d[0]), QY(d[1])]));
        ctx.strokeStyle = 'rgba(56,189,248,.45)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(QX(-ext), QY(0)); ctx.lineTo(QX(ext), QY(0)); ctx.stroke(); ctx.setLineDash([]);
        u.forEach((uk) => { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(QX(uk), QY(0), 6, 0, 7); ctx.stroke(); });
        u.forEach((uk) => { const d = D([uk, 0, 0], MF); ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(QX(d[0]), QY(d[1]), 3.5, 0, 7); ctx.fill(); });
        const qv = D([pxv, 0, 0], MF); cross(QX(qv[0]), QY(qv[1]));
        ctx.fillStyle = '#c8d5ec'; ctx.font = font(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('正視（XY）：θz 滾轉、X、Y', x1 + half / 2, 10 + bt - 4);
        ctx.fillStyle = '#93a6c6'; ctx.font = font(12); ctx.textBaseline = 'bottom'; ctx.fillText(`藍圈＝PIC 耦合器　橘點＝纖芯　✕＝旋轉中心　｜　第 1 到第 ${n} 通道 ${((n - 1) * p.pitch / 1000).toFixed(3)} mm`, x1 + half / 2, 10 + Hf - 4);
      }
      // 中：PIC 端面正視，每個通道局部放大（晶片模場與光斑同比例），間距不放大
      const F0 = Hf + 18, fh = H * 0.30, L1 = 50, R1 = W - 50, yc = F0 + 22 + (fh - 70) / 2, X = (k) => L1 + (k / (n - 1)) * (R1 - L1);
      const sp = (R1 - L1) / (n - 1), m = Math.min(11, sp * 0.1);          // px/µm（局部）
      ctx.fillStyle = '#18202f'; ctx.fillRect(10, F0, W - 20, fh); ctx.strokeStyle = 'rgba(140,170,230,.3)'; ctx.lineWidth = 1; ctx.strokeRect(10, F0, W - 20, fh);
      ctx.fillStyle = '#fff'; ctx.font = font(14, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`近看每個通道：藍＝晶片模場（${2 * p.wChip[0]}×${2 * p.wChip[1]} µm），橘＝透鏡光斑（${2 * p.wf} µm），各通道局部放大`, 18, F0 + 6);
      C.forEach((c, k) => {
        const x = X(k);
        ctx.strokeStyle = 'rgba(140,170,230,.18)'; ctx.beginPath(); ctx.moveTo(x - 3.5 * m, yc); ctx.lineTo(x + 3.5 * m, yc); ctx.moveTo(x, yc - 3.5 * m); ctx.lineTo(x, yc + 3.5 * m); ctx.stroke();
        ctx.fillStyle = 'rgba(56,189,248,.22)'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, yc, p.wChip[0] * m, p.wChip[1] * m, 0, 0, 7); ctx.fill(); ctx.stroke();
        const fx = x + Math.max(-3.4, Math.min(3.4, c.ox)) * m, fy = yc - Math.max(-3.4, Math.min(3.4, c.oy)) * m;
        ctx.fillStyle = 'rgba(255,138,61,.35)'; ctx.strokeStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(fx, fy, p.wf * m, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#93a6c6'; ctx.font = font(12); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`第 ${k + 1}`, x, yc + 3.7 * m);
        ctx.fillText(`Δ(${c.ox.toFixed(2)}, ${c.oy.toFixed(2)})`, x, yc + 3.7 * m + 16);
        ctx.fillText(`尖端 ${c.gap.toFixed(1)} µm`, x, yc + 3.7 * m + 32);
      });
      const pxv = pivotX(p, st.pivot), u0 = -(n - 1) / 2 * p.pitch, xp = L1 + ((pxv - u0) / ((n - 1) * p.pitch)) * (R1 - L1);
      ctx.strokeStyle = '#ffd29a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xp - 7, F0 + 26); ctx.lineTo(xp + 7, F0 + 40); ctx.moveTo(xp + 7, F0 + 26); ctx.lineTo(xp - 7, F0 + 40); ctx.stroke();
      ctx.fillStyle = '#ffd29a'; ctx.font = font(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('旋轉中心', xp, F0 + 42);
      // 下：每個通道的損耗（dB）
      const T0 = F0 + fh + 14, Hb = H - T0 - 10, Lb = 56, Rb = W - 14, Tb = T0 + 28, Bb = T0 + Hb - 24, lo = worst < 2.5 ? 3 : worst < 5.5 ? 6 : 15, stp = lo / 3;
      ctx.strokeStyle = 'rgba(140,170,230,.25)'; ctx.lineWidth = 1; ctx.strokeRect(10, T0, W - 20, Hb);
      ctx.fillStyle = '#fff'; ctx.font = font(14, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`每個通道的耦合損耗（dB，越短越好；黃虛線＝對準值 ${L0.toFixed(2)} dB ＋ 1 dB）`, 18, T0 + 6);
      const Yb = (v) => Tb + (Math.min(lo, Math.max(0, v)) / lo) * (Bb - Tb), bw = Math.min(46, ((Rb - Lb) / n) * 0.55);
      ctx.font = font(12); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = 0; v <= lo; v += stp) { ctx.strokeStyle = 'rgba(140,170,230,.12)'; ctx.beginPath(); ctx.moveTo(Lb, Yb(v)); ctx.lineTo(Rb, Yb(v)); ctx.stroke(); ctx.fillStyle = '#93a6c6'; ctx.fillText(`${v}`, Lb - 6, Yb(v)); }
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#ffd29a'; ctx.beginPath(); ctx.moveTo(Lb, Yb(L0 + 1)); ctx.lineTo(Rb, Yb(L0 + 1)); ctx.stroke(); ctx.setLineDash([]);
      L.forEach((v, k) => {
        const x = Lb + ((k + 0.5) / n) * (Rb - Lb);
        ctx.fillStyle = v <= L0 + 1 ? '#69db7c' : v <= L0 + 3 ? '#ffd43b' : '#ff6b6b'; ctx.fillRect(x - bw / 2, Tb, bw, Yb(v) - Tb);
        ctx.fillStyle = '#dfe8fa'; ctx.font = font(12); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(v > lo ? `> ${lo}` : v.toFixed(2), x, Yb(v) + 3);
        ctx.fillStyle = '#93a6c6'; ctx.fillText(`${k + 1}`, x, Bb + 6);
      });
    }
    tolTable();
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '340px 1fr 410px' } },
      h('div', { class: 'card dark col', style: { gap: '8px' } },
        h('div', { class: 'fa-txt' }, h('b', null, '整支陣列是一個剛體'), '：六軸都作用在整支陣列，三個角度共用一個旋轉中心。'),
        h('div', { class: 'fa8-six col' }, SL.map((s) => s.el)), h('div', { class: 'fa-txt' }, '旋轉中心（三個角度共用）'), segP.el,
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: reset }, '全部歸零'))),
      h('div', { class: 'card dark', style: { padding: '8px' } }, cv),
      h('div', { class: 'card dark col', style: { gap: '8px' } },
        tex('\\mathbf{P}_k=\\mathbf{c}+\\mathbf{t}+R(\\theta_x,\\theta_y,\\theta_z)\\,(\\mathbf{p}_k-\\mathbf{c})', 'sm'),
        tex('\\mathbf{W}_k=\\mathbf{P}_k-\\mathrm{WD}\\;R\\,\\mathbf{e}_z', 'sm'),
        tex('\\eta_k=\\eta_{\\text{六軸}}\\!\\left(\\mathbf{W}_k-\\mathbf{s}_k,\\ \\theta_x,\\theta_y,\\theta_z\\right)', 'sm'),
        h('div', { class: 'fa-txt' }, '第 k 通道的尖端 P', h('sub', null, 'k'), ' 由陣列的平移 t 和旋轉 R 決定；透鏡光纖的光腰 W', h('sub', null, 'k'), ' 在尖端前方 WD。光腰相對自己耦合器 s', h('sub', null, 'k'), ' 的位置與角度，直接代入 ① 的六軸重疊積分。',
          h('b', null, '陣列讓角度變嚴'), '：θz 讓外側通道偏 (u', h('sub', null, 'k'), '−c)·sinθz，θy 讓兩端間距差 (N−1)P·sinθy。'),
        kp, tbl)),
      h('div', { class: 'src', style: { flex: 'none' } }, 'Y. St-Amant et al., Applied Optics 43(30), 5691–5704 (2004), doi:10.1364/AO.43.005691（單通道六軸重疊積分）。' + SRC.mar + '：滾轉力臂（Eq. 24）、pitch 127 µm。'
        + '　透鏡光斑 MFD 3.0 µm：Chen et al., Phys. Rev. Applied 25, 014078 (2026), doi:10.1103/th1c-nml5（標稱 3.0 µm；依實際尖端形狀做 FDTD 模擬約 2.6 µm）；晶片模場 3.0×2.5 µm 為本研究假設（Xu 2023 實測晶片端面 MFD 2.5 µm；Marchetti 2019 的 SSC 約 3×3 µm）。工作距離 WD 14 µm 為假設值。模型 FA8_Lensed_PIC（MATLAB，11 項驗證），本頁 JS 與 MATLAB 逐項相同（差 < 1e-13）。'));
    return { show() { SL.forEach((s, i) => s.set(st.pose[i] / AX[i][5], true)); segP.set(st.pivot, true); tolTable(); G.apply(); draw(); } };
  });

  // ============ 3. 對位策略（互動：從完全沒對位開始 → 按鈕完成第 1 通道 → 拉桿轉 θz）============
  sec.slide({ title: '陣列光纖對 PIC：對位策略', sub: '' }, (body) => {
    body.append(h('style', null, CSS));
    const STEPS = [
      ['① 對準第 1 通道', '把第 1 通道當成單根光纖，用 ① 的三階段（粗動 → 相機 → 光訊號）對好'],
      ['② 以第 1 通道為圓心轉 θz', '第 1 通道不動，越外側的通道移動越多'],
      ['③ 量第 N 通道找峰值', '一邊轉一邊看最後一個通道的光強度，最亮的位置就是 θz 對準'],
      ['④ 全通道耦合功率', '第 N 通道對好，中間通道通常跟著對好；最後再逐一確認每個通道'],
    ];
    const steps = h('div', { class: 'fa-steps' }, STEPS.map(([b, s]) => h('div', null, h('b', null, b), h('span', null, s))));
    const D0 = { dx: 3.2, dy: 2.0 }, TH0 = 0.16 * DEG;            // 起始：第 1 通道偏 (3.2, 2.0) µm、θz 差 0.16°（同方向，外側通道最差）
    const st = { a: 0, cmd: 0 };                                 // a：第 1 通道對位進度 0→1；cmd：拉桿轉的角度
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), G = fitCanvas(cv, () => draw());
    const sT = slider({ label: '旋轉角度（以第 1 通道為圓心）', min: -0.3, max: 0.3, step: 0.001, value: 0, unit: '°', digits: 3, onInput: (v) => { st.cmd = v * DEG; draw(); } });
    const kp = h('div', { class: 'fa-k' }), status = h('div', { class: 'fa-txt' });
    let raf = 0;
    const tween = (to) => { cancelAnimationFrame(raf); const a0 = st.a, t0 = performance.now(); const f = (now) => { const u = Math.min(1, (now - t0) / 1200); st.a = a0 + (to - a0) * u * u * (3 - 2 * u); draw(); if (u < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); };
    const bAlign = h('button', { class: 'btn', type: 'button', onclick: () => tween(1) }, '✔ 完成第 1 通道對位');
    const bReset = h('button', { class: 'btn ghost', type: 'button', onclick: () => { cancelAnimationFrame(raf); st.a = 0; st.cmd = 0; sT.set(0, true); draw(); } }, '↺ 從頭開始');
    function draw() {
      const o = { dx: D0.dx * (1 - st.a), dy: D0.dy * (1 - st.a), thz: TH0 + st.cmd }, C = chans(o), pN = dB(C[S.N - 1].e), p1 = dB(C[0].e);
      const ok1 = st.a > 0.999, okN = ok1 && pN >= dB(PEAK) - 1;
      const step = !ok1 ? 0 : okN ? 3 : Math.abs(st.cmd) < 1e-9 ? 1 : 2;
      [...steps.children].forEach((e, i) => e.classList.toggle('on', i === step));
      sT.el.style.opacity = ok1 ? 1 : 0.4; sT.el.querySelector('input').disabled = !ok1;
      bAlign.disabled = ok1;
      kp.replaceChildren(
        h('div', null, h('b', null, `${p1.toFixed(2)} dB`), h('span', null, '第 1 通道功率')),
        h('div', null, h('b', null, pN < -30 ? '沒有光' : `${pN.toFixed(2)} dB`), h('span', null, `第 ${S.N} 通道功率`)),
        h('div', null, h('b', null, `${(o.thz / DEG).toFixed(3)}°`), h('span', null, 'θz 還差多少')),
        h('div', null, h('b', null, `${Math.hypot(C[S.N - 1].ox, C[S.N - 1].oy).toFixed(2)} µm`), h('span', null, `第 ${S.N} 通道總偏移（含 XY）`)));
      status.replaceChildren(!ok1 ? '先按「完成第 1 通道對位」：把第 1 通道當單根光纖對好。'
        : okN ? h('span', null, h('b', null, `✔ 第 ${S.N} 通道對準`), '：離峰值不到 1 dB。中間通道通常也跟著對好，最後再逐一確認。')
          : `拖拉桿以第 1 通道為圓心轉 θz，看第 ${S.N} 通道的功率，找最亮的位置。`);
      if (!G.w) return;
      const { ctx, w: W, h: H } = G; ctx.clearRect(0, 0, W, H); bgFill(ctx, W, H);
      drawFacetRow(ctx, { x: 10, y: 10, w: W - 20, h: H * 0.48 }, C, { hl: ok1 ? [0, S.N - 1] : [0], pivot: ok1 ? { x: 0, y: 0 } : null, mag: 10 });
      drawBars(ctx, { x: 10, y: H * 0.48 + 22, w: W - 20, h: H * 0.52 - 32 }, C, { lo: -30 });
    }
    body.append(steps, h('div', { class: 'grid grow', style: { gridTemplateColumns: '1fr 400px' } },
      h('div', { class: 'card dark', style: { padding: '8px' } }, cv),
      h('div', { class: 'card dark col', style: { gap: '12px' } },
        h('div', { class: 'row' }, bAlign, bReset), sT.el, status, kp)),
      h('div', { class: 'src', style: { flex: 'none' } }, SRC.xu + '：先由第 1 通道進光，六軸最佳化最外側迴路（第 1、8 通道）的功率，位置固定後再量內側通道（該實驗兩端都裝了 3D 列印微透鏡）。' + SRC.model));
    return { show() { G.apply(); draw(); }, hide() { cancelAnimationFrame(raf); } };
  });

  // ============ 4. 旋轉中心要對在第 1 通道 ============
  sec.slide({ title: '以第 1 通道為圓心：平台的旋轉中心要對在第 1 通道', sub: '' }, (body) => {
    body.append(h('style', null, CSS));
    const st = { r: 444, th: 0.05 * DEG, comp: false };
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), G = fitCanvas(cv, () => draw());
    const sR = slider({ label: '平台轉軸離第 1 通道（沿陣列方向）', min: 0, max: 3000, step: 10, value: st.r, unit: 'µm', digits: 0, onInput: (v) => { st.r = v; draw(); } });
    const sT = slider({ label: '轉 θz', min: -0.15, max: 0.15, step: 0.001, value: 0.05, unit: '°', digits: 3, onInput: (v) => { st.th = v * DEG; draw(); } });
    const segC = segmented([{ id: 'off', label: '直接轉' }, { id: 'on', label: '同時用 XY 補回（虛擬旋轉中心）' }], 'off', (id) => { st.comp = id === 'on'; draw(); });
    const kp = h('div', { class: 'fa-k' });
    function draw() {
      const pv = { x: st.r, y: 0 }, raw = chan(0, { thz: st.th, pivot: pv });
      const o = { thz: st.th, pivot: pv, dx: st.comp ? -raw.ox : 0, dy: st.comp ? -raw.oy : 0 }, C = chans(o);
      kp.replaceChildren(
        h('div', null, h('b', null, `${Math.hypot(raw.ox, raw.oy).toFixed(2)} µm`), h('span', null, '第 1 通道被帶走（≈ r·θz）')),
        h('div', null, h('b', null, `${dB(C[0].e).toFixed(2)} dB`), h('span', null, st.comp ? '第 1 通道（補回後）' : '第 1 通道')),
        h('div', null, h('b', null, st.comp ? `(${(-raw.ox).toFixed(2)}, ${(-raw.oy).toFixed(2)})` : '—'), h('span', null, 'XY 補償量（µm）')),
        h('div', null, h('b', null, `${dB(C[S.N - 1].e).toFixed(2)} dB`), h('span', null, `第 ${S.N} 通道`)));
      if (!G.w) return;
      const { ctx, w: W, h: H } = G; ctx.clearRect(0, 0, W, H); bgFill(ctx, W, H);
      drawFacetRow(ctx, { x: 10, y: 10, w: W - 20, h: H * 0.5 }, C, { hl: [0, S.N - 1], pivot: pv, mag: 14 });
      drawBars(ctx, { x: 10, y: H * 0.5 + 22, w: W - 20, h: H * 0.5 - 32 }, C, { lo: -6 });
    }
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1fr 440px' } },
      h('div', { class: 'card dark', style: { padding: '8px' } }, cv),
      h('div', { class: 'card dark col', style: { gap: '10px' } },
        tex('\\Delta_1=\\left(R(\\theta_z)-I\\right)(\\mathbf{p}_1-\\mathbf{c})\\approx r\\,\\theta_z', 'sm'),
        h('div', { class: 'fa-txt' }, '平台 θz 軸的中心 c 通常不在第 1 通道上。離第 1 通道 r，轉 θz 時第 1 通道就被帶走約 r·θz，剛對好的第 1 通道又跑掉。'),
        sR.el, sT.el, segC.el, kp,
        h('div', { class: 'fa-txt', style: { marginTop: 'auto' } }, h('b', null, '兩種解法：'), '機構上把轉軸對在第 1 通道；或轉的同時用 XY 把 Δ₁ 補回來（虛擬旋轉中心）。這跟角度軸的旋轉中心要重合在光纖端面是同一件事。'))),
      h('div', { class: 'src', style: { flex: 'none' } }, 'Δ₁ 為剛體旋轉的幾何關係。' + SRC.xu + '：以六軸平台對光纖陣列做主動對位。' + SRC.pi));
    return { show() { G.apply(); draw(); } };
  });

  // ============ 5. XY 補回的 3D 互動：虛擬旋轉中心（兩步自動循環播放）============
  sec.slide({ title: 'XY 補回：讓旋轉中心「虛擬地」落在第 1 通道', sub: '' }, (body) => {
    body.append(h('style', null, CSS + C3D_CSS + `.xy-cap { position:absolute; left:16px; right:16px; top:12px; z-index:3; font-size:21px; font-weight:800; color:#fff; text-shadow:0 2px 10px #000; line-height:1.4; }
      .xy-cap small { display:block; font-size:15px; font-weight:500; color:#c8d5ec; } .xy-cap .n { color:#ffb86b; }
      .xy-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; } .xy-steps > div { border:1px solid rgba(140,170,230,.25); border-radius:10px; padding:6px 10px; font-size:14px; color:#9fb3d1; transition:.2s; }
      .xy-steps > div.on { border-color:#ffb86b; color:#fff; background:rgba(255,138,61,.16); }`));
    const M = 300;                                        // 角度放大倍率（位移也跟著放大）
    // 時間軸（秒）：0–0.6 起始；0.6–2.6 ① 轉 θz；2.6–3.2 停；3.2–4.8 ② XY 移回；4.8–7 結果；7 秒循環
    const T = { a: 0.6, b: 2.6, c: 3.2, d: 4.8, end: 7 };
    const st = { r: 444, th: 0.05 * DEG, t: 0, playing: true, last: 0 };
    const holder = h('div', { class: 'c3d', style: { height: '100%' } }), cap = h('div', { class: 'xy-cap' });
    const steps = h('div', { class: 'xy-steps' }, ['① 平台轉 θz', '② XY 台移回', '結果：繞第 1 通道轉'].map((s) => h('div', null, s)));
    let v3 = null;
    const sR = slider({ label: '平台轉軸離第 1 通道', min: 100, max: 3000, step: 10, value: st.r, unit: 'µm', digits: 0, onInput: (v) => { st.r = v; st.t = 0; st.reset = true; } });
    const sT = slider({ label: '要轉的 θz', min: 0.01, max: 0.1, step: 0.001, value: 0.05, unit: '°', digits: 3, onInput: (v) => { st.th = v * DEG; st.t = 0; st.reset = true; } });
    const bPlay = h('button', { class: 'btn', type: 'button', onclick: () => { st.playing = !st.playing; bPlay.textContent = st.playing ? '⏸ 暫停' : '▶ 播放'; } }, '⏸ 暫停');
    const bView = h('button', { class: 'btn ghost', type: 'button', onclick: () => v3 && v3.resetView() }, '視角重置');
    const kp = h('div', { class: 'fa-k' });
    const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    function refresh() {
      const t = st.t, a = ease((t - T.a) / (T.b - T.a)), f = ease((t - T.c) / (T.d - T.c)), th = st.th * a;
      const phase = t < T.a ? -1 : t < T.c ? 0 : t < T.d ? 1 : 2;
      const raw = chan(0, { thz: th, pivot: { x: st.r, y: 0 } }), ox = raw.ox * (1 - f), oy = raw.oy * (1 - f), off = Math.hypot(ox, oy);
      [...steps.children].forEach((e, i) => e.classList.toggle('on', i === phase));
      const CAP = [
        ['準備：第 1 通道已經對準藍圈', `平台的 θz 轉軸（✕）不在第 1 通道上，離它 ${st.r} µm`],
        ['① 平台繞自己的轉軸轉 θz', '第 1 通道沿著以轉軸為圓心的圓弧（虛線）跑掉了'],
        ['② 同時讓 XY 台往反方向移', '把第 1 通道推回藍圈；轉軸也跟著 XY 台一起移動'],
        ['結果：等於繞第 1 通道轉', '第 1 通道留在原地，只有其他通道在轉——第 1 通道成了「虛擬旋轉中心」'],
      ][phase + 1];
      cap.replaceChildren(h('span', { class: 'n' }, CAP[0]), h('small', null, CAP[1]));
      kp.replaceChildren(
        h('div', null, h('b', { style: { color: off < 0.01 ? '#69db7c' : '#ff8a70' } }, `${Math.round(off * 1000)} nm`), h('span', null, '第 1 通道偏移（真實）')),
        h('div', null, h('b', null, `${(th / DEG).toFixed(3)}°`), h('span', null, '已轉的 θz')),
        h('div', null, h('b', null, `(${Math.round(-raw.ox * f * 1000) + 0}, ${Math.round(-raw.oy * f * 1000) + 0})`), h('span', null, 'XY 台移回（nm）')),
        h('div', null, h('b', null, `${(Math.hypot(raw.ox, raw.oy) * 1000).toFixed(0)} nm`), h('span', null, '≈ r·θz（要補回的量）')));
      v3 && v3.update({ N: S.N, P: S.P, r: st.r, thd: th * M, f, arrow: phase === 1, resetTrail: st.reset || t < T.a }); st.reset = false;
    }
    const frame = (now) => { const dt = Math.min(0.05, (now - st.last) / 1000 || 0); st.last = now; if (st.playing) { st.t += dt; if (st.t > T.end) { st.t = 0; st.reset = true; } } refresh(); };
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1fr 380px' } },
      h('div', { class: 'card dark', style: { padding: '6px', position: 'relative' } }, holder, cap,
        h('div', { class: 'small', style: { position: 'absolute', left: '16px', bottom: '12px', color: '#93a6c6' } }, `角度放大 ${M} 倍顯示（位移也一起放大）；拖曳可旋轉視角`)),
      h('div', { class: 'card dark col', style: { gap: '10px' } },
        steps, kp,
        tex('(\\Delta x,\\Delta y)=-\\left(R(\\theta_z)-I\\right)(\\mathbf{p}_1-\\mathbf{c})', 'sm'),
        h('div', { class: 'fa-txt' }, '旋轉台裝在 XY 台上。轉的同時讓 XY 台移回 (Δx, Δy)，兩個動作合起來就等於繞第 1 通道轉。'),
        h('div', { class: 'row' }, bPlay, bView), sR.el, sT.el)),
      h('div', { class: 'src', style: { flex: 'none' } }, '補回量為剛體旋轉的幾何關係。' + SRC.pi + '　' + SRC.xu + '：以六軸平台對光纖陣列做主動對位。'));
    return {
      show() { if (!v3) v3 = new XYComp3D(holder); st.t = 0; st.reset = true; st.last = performance.now(); refresh(); v3.start(frame); },
      hide() { v3 && v3.stop(); },
    };
  });

  // ============ 6. 怎麼定義光耦合成功：只量最遠的通道 ============
  sec.slide({ title: '怎麼定義光耦合成功', sub: '' }, (body) => {
    body.append(h('style', null, CSS));
    const st = { th: 0.03 * DEG };
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } }), G = fitCanvas(cv, () => draw());
    const [sN, sP] = segNP(() => draw());
    const sT = slider({ label: 'θz（繞第 1 通道）', min: -0.15, max: 0.15, step: 0.001, value: 0.03, unit: '°', digits: 3, onInput: (v) => { st.th = v * DEG; draw(); } });
    const kp = h('div', { class: 'fa-k' });
    function draw() {
      const C = chans({ thz: st.th }), tl = tol1dB(), last = C[S.N - 1], ok = dB(C[0].e) >= dB(PEAK) - 1 && dB(last.e) >= dB(PEAK) - 1;
      kp.replaceChildren(
        h('div', null, h('b', null, `${Math.hypot(last.ox, last.oy).toFixed(2)} µm`), h('span', null, `第 ${S.N} 通道偏移`)),
        h('div', null, h('b', null, `${dB(Math.min(...C.map((c) => c.e))).toFixed(2)} dB`), h('span', null, '最差通道')),
        h('div', null, h('b', { style: { color: ok ? '#69db7c' : '#ff6b6b' } }, ok ? '✔ 成功' : '✖ 未成功'), h('span', null, `判定：第 1、第 ${S.N} 通道都離對準值 ≤ 1 dB`)),
        h('div', null, h('b', null, `±${(tl.thz / DEG).toFixed(3)}°`), h('span', null, `第 ${S.N} 通道掉 1 dB 的 θz`)));
      if (!G.w) return;
      const { ctx, w: W, h: H } = G; ctx.clearRect(0, 0, W, H); bgFill(ctx, W, H);
      drawFacetRow(ctx, { x: 10, y: 10, w: W - 20, h: H * 0.45 }, C, { hl: [0, S.N - 1], pivot: { x: 0, y: 0 }, mag: 14 });
      drawBars(ctx, { x: 10, y: H * 0.45 + 22, w: W - 20, h: H * 0.55 - 32 }, C, { lo: -6 });
    }
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1fr 420px' } },
      h('div', { class: 'card dark', style: { padding: '8px' } }, cv),
      h('div', { class: 'card dark col', style: { gap: '10px' } },
        tex('\\Delta y_N=(N-1)\\,P\\,\\sin\\theta_z=L\\sin\\theta_z', 'sm'),
        tex('\\mathrm{IL}_1,\\ \\mathrm{IL}_N\\le\\mathrm{IL}_{0}+1\\,\\mathrm{dB}\\;\\Rightarrow\\;\\text{成功}', 'sm'),
        h('div', { class: 'fa-txt' }, '以第 1 通道為圓心轉 θz，第 i 通道偏 (i−1)·P·sinθz：離第 1 通道越遠，偏差越大。第 1 通道在步驟 ① 已對好並持續監看，所以只要再量最遠的第 N 通道：兩端都離對準值（IL₀）不到 1 dB，中間通道的偏差介於兩端之間，在理想陣列中也會在 1 dB 內。實際陣列的纖芯位置有誤差（文獻值：纖芯偏 1.4 µm 時，UHNA〔MFD 3.5 µm〕多損約 2.1 dB，Marchetti 2019 Fig. 56b），所以最後仍要逐一確認中間通道。1 dB 為本報告自訂的判定門檻。'),
        sN.el, sP.el, sT.el, kp)),
      h('div', { class: 'src', style: { flex: 'none' } }, SRC.mar + '：陣列滾轉位移 d = (N−1)·P·tanθ（Eq. 24，p. 230），纖芯位置偏差造成的損耗（p. 230）。' + SRC.xu + '：最外側迴路對好後，再量內側通道確認。' + SRC.model));
    return { show() { G.apply(); draw(); } };
  });

}
