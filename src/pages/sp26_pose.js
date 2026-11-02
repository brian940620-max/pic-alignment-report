// 計畫版 2-6「六軸系統光功率回授對應的姿態」（2026-11-02）：光纖陣列（8 通道透鏡 FA）對 PIC。
// 六軸姿態 → 8 個通道的耦合功率＝一筆「姿態–光功率」配對；自動採集一批姿態，畫出姿態空間裡的功率分佈。
// 模型用 ../fa8.js（FA8_Lensed_PIC v1.0 的 JS 移植，check_fa8.mjs 與 MATLAB 逐項核對）：pitch 127 µm、WD 14 µm（假設）、
// 透鏡光斑 MFD 3.0 µm、晶片模場 3.0×2.5 µm、旋轉中心在陣列中央。全部是模擬，沒有量測雜訊。
import { h, slider, fitCanvas, loop, clamp, DEG } from '../ui.js';
import { FA8, etaFA, peakFA, facetSpot } from '../fa8.js';

const PK = peakFA(FA8), NCH = FA8.nCh;
const dBrel = (e) => 10 * Math.log10(Math.max(e / PK, 1e-12));
const AX = [
  { k: 'X', label: 'X 橫移', min: -3, max: 3, step: 0.05, unit: 'µm', digits: 2 },
  { k: 'Y', label: 'Y 上下', min: -3, max: 3, step: 0.05, unit: 'µm', digits: 2 },
  { k: 'Z', label: 'Z 間距', min: 4, max: 24, step: 0.1, unit: 'µm', digits: 1 },
  { k: 'tx', label: 'θx 俯仰', min: -1.5, max: 1.5, step: 0.01, unit: '°', digits: 2 },
  { k: 'ty', label: 'θy 偏擺', min: -1.5, max: 1.5, step: 0.01, unit: '°', digits: 2 },
  { k: 'tz', label: 'θz 滾轉', min: -0.3, max: 0.3, step: 0.002, unit: '°', digits: 3 },
];
const HOME = [0, 0, FA8.WD, 0, 0, 0];
const toPose = (v) => [v[0], v[1], v[2], v[3] * DEG, v[4] * DEG, v[5] * DEG];
const colDb = (db) => (db > -1 ? '#5fd068' : db > -3 ? '#ffb547' : '#ff6b6b');

const CSS = `
.sp26 .card.dark { padding:10px 14px; }
.sp26 .k-h { font-size:18px; font-weight:800; color:#fff; margin:0 0 4px; }
.sp26 .k-ul { margin:0; padding-left:20px; font-size:15px; line-height:1.5; color:#e8eefb; } .sp26 .k-ul b { color:#ffd29a; }
.sp26 .src { font-size:12.5px; color:#93a6c6; line-height:1.4; }
.sp26 .pane { position:relative; min-height:0; }
.sp26 .pane > canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.sp26 .vec { font-family:var(--mono); font-size:13.5px; color:#cfd9ec; line-height:1.5; background:rgba(255,255,255,.04); border-radius:8px; padding:5px 8px; }
.sp26 .vec b { color:#ffb86b; font-weight:600; }
.sp26 table.log { border-collapse:collapse; width:100%; font-family:var(--mono); font-size:12.5px; color:#dfe8fa; }
.sp26 table.log td, .sp26 table.log th { padding:1px 4px; text-align:right; border-bottom:1px solid rgba(140,170,230,.15); }
.sp26 table.log th { color:#93a6c6; font-weight:600; }
.sp26 .slider { margin:2px 0; }
`;
const pane = (c) => { c.style.position = 'absolute'; return h('div', { class: 'pane fill' }, c); };

function poseSlide(body) {
  const v = HOME.slice();
  const data = [];   // {pose(顯示單位), db[8], worst}
  const cT = h('canvas'), cB = h('canvas'), cS = h('canvas');
  const T = fitCanvas(cT, () => draw()), B = fitCanvas(cB, () => draw()), Sg = fitCanvas(cS, () => drawScatter());
  const vec = h('div', { class: 'vec' }), cnt = h('span', { style: { color: '#ffb86b', fontWeight: 700 } }, '0');
  const logT = h('table', { class: 'log' });
  const sl = AX.map((a, i) => slider({ label: a.label, min: a.min, max: a.max, step: a.step, value: v[i], unit: a.unit, digits: a.digits, onInput: (x) => { v[i] = x; draw(); } }));
  const compute = (vv) => { const ch = etaFA(toPose(vv)); const db = ch.map((c) => dBrel(c.e)); return { ch, db, worst: Math.min(...db) }; };

  function draw() {
    const { ch, db, worst } = compute(v), pose = toPose(v);
    // 8 個通道的端面小圖：藍＝晶片耦合器模場（1/e²），橘＝FA 光束打在端面的光斑（偏移不放大，±4 µm）
    { const { ctx, w, h: H } = T; if (w) {
      ctx.clearRect(0, 0, w, H);
      const gap = 6, tw = (w - gap * (NCH - 1)) / NCH, th = Math.min(tw, H - 34), y0 = 4, R = 4;
      ch.forEach((c, k) => {
        const x0 = k * (tw + gap), sc = th / (2 * R), cx = x0 + tw / 2, cy = y0 + th / 2;
        ctx.fillStyle = '#0b1426'; ctx.fillRect(x0, y0, tw, th); ctx.strokeStyle = 'rgba(140,170,230,.3)'; ctx.strokeRect(x0, y0, tw, th);
        ctx.strokeStyle = '#4f8cff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, FA8.wChip[0] * sc, FA8.wChip[1] * sc, 0, 0, 7); ctx.stroke();
        const sp = facetSpot(c, pose), sx = cx + clamp(sp.cx, -R, R) * sc, sy = cy - clamp(sp.cy, -R, R) * sc;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.w * sc); g.addColorStop(0, `rgba(255,140,50,${0.25 + 0.65 * Math.min(1, sp.I0)})`); g.addColorStop(1, 'rgba(255,140,50,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sp.w * sc, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(sx, sy, sp.w * sc, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        ctx.font = '600 13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#cfd9ec'; ctx.fillText(`ch${k + 1}`, cx, y0 + th + 3);
        ctx.fillStyle = colDb(db[k]); ctx.fillText(`${db[k].toFixed(2)} dB`, cx, y0 + th + 18);
      });
    } }
    // 8 通道功率長條（相對對準時，dB）
    { const { ctx, w, h: H } = B; if (w) {
      ctx.clearRect(0, 0, w, H);
      const m = { l: 44, r: 8, t: 10, b: 22 }, pw = w - m.l - m.r, ph = H - m.t - m.b, Y = (d) => m.t + (clamp(-d, 0, 10) / 10) * ph, bw = pw / NCH;
      ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      for (const d of [0, -1, -3, -6, -10]) { ctx.strokeStyle = d === -1 ? 'rgba(95,208,104,.6)' : 'rgba(140,170,230,.15)'; ctx.setLineDash(d === -1 ? [5, 4] : []); ctx.beginPath(); ctx.moveTo(m.l, Y(d)); ctx.lineTo(w - m.r, Y(d)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#93a6c6'; ctx.fillText(`${d} dB`, m.l - 5, Y(d)); }
      db.forEach((d, k) => { ctx.fillStyle = colDb(d); ctx.fillRect(m.l + k * bw + bw * 0.18, Y(0), bw * 0.64, Y(d) - Y(0)); ctx.fillStyle = '#cfd9ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`ch${k + 1}`, m.l + k * bw + bw / 2, H - m.b + 5); });
    } }
    const f = (x, d) => (x >= 0 ? ' ' : '') + x.toFixed(d);
    vec.innerHTML = `姿態 [X Y Z θx θy θz]＝[<b>${f(v[0], 2)} ${f(v[1], 2)} ${v[2].toFixed(1)} ${f(v[3], 2)}° ${f(v[4], 2)}° ${f(v[5], 3)}°</b>]<br>→ 功率 [ch1…ch8]＝[<b>${db.map((d) => d.toFixed(1)).join(' ')}</b>] dB　最差 <b style="color:${colDb(worst)}">${worst.toFixed(2)} dB</b>`;
  }

  // 姿態空間：θz（橫軸）× Y（縱軸），顏色＝最差通道功率（其他四軸隨機小量）
  function drawScatter() {
    const { ctx, w, h: H } = Sg; if (!w) return;
    ctx.clearRect(0, 0, w, H);
    const m = { l: 48, r: 12, t: 22, b: 30 }, pw = w - m.l - m.r, ph = H - m.t - m.b, X = (t) => m.l + ((t + 0.2) / 0.4) * pw, Y = (y) => m.t + ((1.5 - y) / 3) * ph;
    ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(m.l, m.t, pw, ph);
    ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillStyle = '#93a6c6';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; for (const t of [-0.2, -0.1, 0, 0.1, 0.2]) ctx.fillText(`${t}°`, X(t), H - m.b + 4);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; for (const y of [-1.5, -0.75, 0, 0.75, 1.5]) ctx.fillText(`${y}`, m.l - 6, Y(y));
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#dfe8fa'; ctx.fillText('θz 滾轉 × Y 上下（µm）；顏色＝最差通道', m.l, 4);
    for (const r of data) { ctx.fillStyle = colDb(r.worst); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(X(r.pose[5]), Y(r.pose[1]), 3.2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(v[5]), Y(v[1]), 6, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    const leg = [['> −1 dB', '#5fd068'], ['−1～−3', '#ffb547'], ['< −3 dB', '#ff6b6b']]; let lx = w - m.r - 230;
    for (const [t, c] of leg) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx, 10, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#cfd9ec'; ctx.textBaseline = 'middle'; ctx.fillText(t, lx + 8, 10); lx += 78; }
  }
  function renderLog() {
    const rows = data.slice(-4).reverse();
    logT.replaceChildren(h('tr', null, ...['#', 'X', 'Y', 'Z', 'θx', 'θy', 'θz', 'ch1', 'ch8', '最差'].map((t) => h('th', null, t))),
      ...rows.map((r) => h('tr', null, h('td', null, r.n), ...r.pose.map((x, i) => h('td', null, x.toFixed(i === 5 ? 3 : i === 2 ? 1 : 2))), h('td', null, r.db[0].toFixed(1)), h('td', null, r.db[7].toFixed(1)), h('td', { style: { color: colDb(r.worst) } }, r.worst.toFixed(1)))));
    cnt.textContent = data.length;
  }
  const record = (vv) => { const { db, worst } = compute(vv); data.push({ n: data.length + 1, pose: vv.slice(), db, worst }); };
  let rs = 12345; const u = () => (rs = (rs * 16807) % 2147483647) / 2147483647, U = (a) => (u() * 2 - 1) * a;
  let todo = 0;
  const acq = loop(() => { for (let i = 0; i < 6 && todo > 0; i++, todo--) { const p = [U(0.3), U(1.5), FA8.WD + U(2), U(0.15), U(0.15), U(0.2)]; record(p); v.splice(0, 6, ...p); sl.forEach((s, k) => s.set(p[k], true)); } draw(); drawScatter(); renderLog(); if (todo <= 0) { acq.stop(); bAuto.disabled = false; } });
  const bRec = h('button', { type: 'button', class: 'btn', onclick: () => { record(v); renderLog(); drawScatter(); } }, '＋ 記錄這一筆');
  const bAuto = h('button', { type: 'button', class: 'btn', onclick: () => { todo = 300; bAuto.disabled = true; acq.start(); } }, '▶ 自動採集 300 筆');
  const bClr = h('button', { type: 'button', class: 'btn ghost', onclick: () => { data.length = 0; renderLog(); drawScatter(); } }, '清空');
  const bHome = h('button', { type: 'button', class: 'btn ghost', onclick: () => { HOME.forEach((x, i) => sl[i].set(x, true)); v.splice(0, 6, ...HOME); draw(); drawScatter(); } }, '歸零');

  body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '330px 1.25fr 1fr' } },
    h('div', { class: 'col' },
      h('div', { class: 'card dark col', style: { gap: '0' } }, h('div', { class: 'k-h' }, 'FA 六軸姿態'), ...sl.map((s) => s.el), h('div', { class: 'row', style: { marginTop: '4px' } }, bHome)),
      h('div', { class: 'card dark fill' },
        h('ul', { class: 'k-ul' },
          h('li', null, h('b', null, '一個姿態 → 8 個功率：'), '六軸平台的位置讀值配上多通道功率計，就是一筆配對'),
          h('li', null, h('b', null, '自動採集：'), '平台走過一批姿態，同步記錄，不用人工'),
          h('li', null, h('b', null, '用途：'), '給子計畫一 1-7（對位控制＋PINN 前饋）的配對數據')))),
    h('div', { class: 'col' },
      h('div', { class: 'card dark col', style: { flex: 'none', gap: '4px' } },
        h('div', { class: 'k-h' }, 'PIC 端面：每個通道的光斑與耦合器'), (cT.style.position = 'absolute', h('div', { class: 'pane', style: { height: '122px' } }, cT)),
        h('div', { class: 'src' }, '藍＝晶片耦合器模場（3.0×2.5 µm）；橘＝FA 光束打到端面的光斑（偏移真實比例，每格 ±4 µm）。θz 滾轉會讓外側通道往上下偏：ch1、ch8 離中心 444 µm。')),
      h('div', { class: 'card dark col', style: { flex: '1', minHeight: '0', gap: '4px' } }, pane(cB)),
      vec),
    h('div', { class: 'col' },
      h('div', { class: 'card dark col', style: { gap: '6px' } }, h('div', { class: 'row' }, bRec, bAuto, bClr), h('div', { style: { color: '#cfd9ec', fontSize: '15px' } }, '已採集 ', cnt, ' 筆')),
      h('div', { class: 'card dark fill', style: { padding: '6px 8px', display: 'flex', flexDirection: 'column' } }, pane(cS)),
      h('div', { class: 'card dark' }, logT),
      h('div', { class: 'src' }, '模型：8 通道透鏡 FA 對 PIC（FA8_Lensed_PIC v1.0，與 MATLAB 核對 11/11），pitch 127 µm、WD 14 µm（假設）、旋轉中心在陣列中央；理想 FA、無量測雜訊。自動採集：X ±0.3、Y ±1.5、Z ±2 µm、θx θy ±0.15°、θz ±0.2° 均勻隨機；最差通道 1 dB 容差：Y ±0.66 µm、θz ±0.085°。全部是模擬。'))));
  body.prepend(h('style', null, CSS));
  body.closest('.slide').classList.add('sp26');
  renderLog(); draw();
  return { show() { draw(); drawScatter(); }, hide() { acq.stop(); bAuto.disabled = false; todo = 0; } };
}

export function mount(sec) {
  sec.slide({ title: '六軸系統光功率回授對應的姿態', sub: '' }, poseSlide);
}
