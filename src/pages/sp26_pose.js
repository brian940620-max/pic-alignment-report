// 計畫版 2-6「六軸系統光功率回授對應的姿態」（2026-11-02）：光纖陣列（8 通道透鏡 FA）對 PIC。
// 六軸姿態 → 8 個通道的耦合功率＝一筆「姿態–光功率」配對，供子計畫三模型訓練。
// 模型用 ../fa8.js（FA8_Lensed_PIC v1.0 的 JS 移植，check_fa8.mjs 與 MATLAB 逐項核對）：pitch 127 µm、WD 14 µm（假設）、
// 透鏡光斑 MFD 3.0 µm、晶片模場 3.0×2.5 µm、旋轉中心在陣列中央。全部是模擬，沒有量測雜訊。
import { h, slider, fitCanvas, loop, clamp, DEG } from '../ui.js';
import { FA8, etaFA, peakFA, facetSpot } from '../fa8.js';
import { interpolateCapturePose } from '../capture-motion.js';

const PK = peakFA(FA8), NCH = FA8.nCh;
const CAPTURE_COUNT = 100;
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
const colDb = (db) => (db > -1 ? '#9cdbc1' : db > -3 ? '#edc28e' : '#e79783');

const CSS = `
.slide.sp26 .capture-layout { display:grid; grid-template-columns:300px minmax(0,1.35fr) minmax(0,1fr); gap:20px; flex:1; min-height:0; }
.slide.sp26 .capture-card.card { padding:24px; display:flex; flex-direction:column; gap:20px; min-height:0; position:relative; overflow:visible; }
.slide.sp26 .capture-card:last-child { gap:14px; }
.sp26 .capture-head { display:flex; align-items:center; gap:12px; padding-bottom:18px; border-bottom:1px solid #8faec425; }
.sp26 .capture-step { display:grid; place-items:center; width:36px; height:36px; border:1px solid #86cbd551; background:#86cbd50b; border-radius:50%; color:#a4d9e0; font:14px var(--mono); }
.sp26 .capture-head h2 { margin:0; color:#f0f5fa; font-size:24px; font-weight:600; letter-spacing:.5px; }
.sp26 .capture-card:not(:last-child)::after { content:'→'; position:absolute; right:-25px; top:29px; z-index:2; color:#a3c6d5; background:#0d1b2b; width:28px; text-align:center; font-size:22px; }
.sp26 .capture-sliders { flex:1; display:flex; flex-direction:column; justify-content:space-around; gap:8px; }
.slide.report-ui.sp26 .capture-sliders .slider { margin:0; padding:8px 12px; }
.sp26 .capture-tools { display:flex; align-items:center; gap:8px; }
.sp26 .capture-tools .btn { flex:1; white-space:nowrap; font-size:14px; padding:10px 8px; }
.sp26 .capture-caption { display:flex; justify-content:space-between; align-items:center; font-size:14px; color:#aec6d6; gap:12px; }
.sp26 .capture-legend { font-size:13px; color:#adc3d3; display:flex; gap:14px; }
.sp26 .capture-legend span::before { content:''; display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--dot); margin-right:5px; }
.sp26 .capture-facets { height:108px; flex:none; position:relative; }
.sp26 .capture-chart { flex:1; min-height:0; position:relative; }
.sp26 canvas { position:absolute; inset:0; display:block; width:100%; height:100%; }
.sp26 .capture-chart-note { color:#91adbf; font-size:13px; margin-top:-12px; }
.sp26 .capture-total { display:flex; align-items:baseline; gap:12px; }
.sp26 .capture-total strong { font-size:64px; font-weight:600; line-height:1; letter-spacing:-3px; color:#f1d0a4; font-variant-numeric:tabular-nums; }
.sp26 .capture-total span { color:#bbcfdd; font-size:16px; }
.sp26 .capture-records { flex:none; display:flex; flex-direction:column; gap:6px; }
.sp26 .capture-record-head,.sp26 .capture-record { display:grid; grid-template-columns:44px 1fr 20px 1.2fr; gap:10px; align-items:center; }
.sp26 .capture-record-head { font-size:13px; color:#94b0c3; text-align:center; margin-bottom:3px; }
.sp26 .capture-record { height:40px; padding:6px 10px; border:1px solid #7eacc02b; border-radius:9px; background:#091b2b; }
.sp26 .capture-record.empty { opacity:.32; }
.sp26 .capture-record > span { color:#9fbacb; font:12px var(--mono); }
.sp26 .capture-record > i { font-style:normal; color:#728fa3; }
.sp26 .capture-code { display:flex; align-items:center; justify-content:space-between; gap:4px; height:27px; }
.sp26 .capture-code i { flex:1; height:100%; position:relative; background:#263e51; border-radius:3px; overflow:hidden; }
.sp26 .capture-code i::after { content:''; position:absolute; inset:0; transform:scaleY(var(--level)); transform-origin:bottom; background:var(--color); border-radius:3px; }
.sp26 .capture-destination { margin-top:auto; padding:14px 20px; border:1px solid #ddba8157; border-radius:12px; background:linear-gradient(115deg,#d4ad7219,#b9daca05); }
.sp26 .capture-destination span { display:block; color:#c3b196; font-size:13px; margin-bottom:6px; }
.sp26 .capture-destination strong { font-size:26px; color:#f4d6af; font-weight:600; }
.sp26 .capture-destination p { margin:6px 0 0; color:#c6d6df; font-size:16px; }
.sp26 .capture-footer { display:flex; align-items:center; gap:22px; padding:18px 22px; border:1px solid #516c814d; border-radius:14px; background:#0e2032; }
.slide.sp26 .capture-start.btn { background:linear-gradient(110deg,#f0d2a5,#cfac79); color:#182535; border-color:#e6c491; font-weight:700; min-width:225px; padding:14px 22px; font-size:17px; }
.slide.report-ui.sp26 .capture-start.btn:disabled { background:#20394c; color:#b9d6e4; border-color:#41627b; opacity:1; }
.sp26 .capture-progress { flex:1; display:flex; flex-direction:column; gap:9px; }
.sp26 .capture-status { color:#c7dce8; font-size:16px; }
.sp26 progress { appearance:none; height:4px; width:100%; border:0; background:#294154; border-radius:4px; overflow:hidden; }
.sp26 progress::-webkit-progress-bar { background:#294154; }
.sp26 progress::-webkit-progress-value { background:#96d3d7; }
.sp26 .capture-notes { color:#92aabd; font-size:13px; text-align:right; position:relative; line-height:1.6; }
.sp26 .capture-notes details { display:inline-block; margin:0 0 0 10px; padding:0; border:0; background:transparent; }
.slide.sp26 .capture-notes summary { cursor:pointer; color:#bfd4df; background:transparent; border:0; padding:0; font-size:13px; text-decoration:underline; text-underline-offset:4px; }
.sp26 .capture-details { position:absolute; bottom:36px; right:0; width:490px; padding:20px 24px; border:1px solid #7598ad; border-radius:12px; background:#112537; box-shadow:0 12px 40px #0008; z-index:5; text-align:left; font-size:14px; line-height:1.75; color:#c4d5e0; }
.sp26 .capture-details p { margin:8px 0; }
/* Presentation finish: one continuous workflow, with a warmer destination. */
.slide.report-ui.sp26 .capture-card { --capture-accent:#93cfd6; border-color:#4f6a805e; background:radial-gradient(ellipse at 0 0,#8ccbd608,transparent 65%),linear-gradient(150deg,#122538,#0d1c2c); box-shadow:inset 0 1px #ffffff06,0 8px 24px #030b141c; }
.slide.report-ui.sp26 .capture-card:nth-child(2) { background:radial-gradient(ellipse at 50% 0,#91d8e10b,transparent 65%),linear-gradient(150deg,#13283a,#0d1c2b); }
.slide.report-ui.sp26 .capture-card:last-child { --capture-accent:#e9c591; background:radial-gradient(ellipse at 100% 0,#e9c59109,transparent 65%),linear-gradient(150deg,#152637,#0d1c2b); }
.sp26 .capture-card::before { content:''; position:absolute; top:-1px; left:24px; right:24px; height:2px; background:linear-gradient(90deg,transparent,var(--capture-accent),transparent); opacity:.55; }
.sp26 .capture-head { border-bottom-color:#91b2c71b; }
.sp26 .capture-head h2 { font-size:23px; letter-spacing:.3px; }
.sp26 .capture-step { flex:none; color:var(--capture-accent); background:#102132; border-color:#8caec339; box-shadow:inset 0 1px #ffffff08; }
.sp26 .capture-card:not(:last-child)::after { top:30px; right:-25px; height:28px; line-height:24px; border:1px solid #536e855c; border-radius:50%; font-size:17px; background:#102132; }
.slide.report-ui.sp26 .capture-sliders .slider { border:1px solid #7595ac14; border-radius:10px; background:#08182735; }
.slide.report-ui.sp26 .capture-sliders .slider:hover { border-color:#80b9c447; background:#81bccb09; }
.sp26 .capture-sliders .sl-val { min-width:86px; text-align:right; color:#d9e8ef; background:transparent; box-shadow:none; }
.sp26 .capture-caption { color:#c0d3df; }
.sp26 .capture-total { padding:4px 0 12px; border-bottom:1px solid #8caec31c; }
.sp26 .capture-total strong { font-size:70px; letter-spacing:-2px; color:#f4d5aa; }
.sp26 .capture-total span { color:#a6bfd0; font-size:15px; }
.sp26 .capture-record { background:linear-gradient(100deg,#0b1e2e,#102638); border-color:#86b1c12b; }
.sp26 .capture-record:nth-child(2):not(.empty) { border-color:#91cdd86b; box-shadow:inset 2px 0 #94d3d9; }
.sp26 .capture-record:nth-child(3) { opacity:.8; }
.sp26 .capture-record:nth-child(4) { opacity:.6; }
.sp26 .capture-record.empty { opacity:.24; }
.sp26 .capture-code i { background:#63879b1f; }
.sp26 .capture-code i::after { box-shadow:inset 0 1px #ffffff25; }
.sp26 .capture-records.has-records .capture-code i::after { transition:transform .2s linear; }
@media(prefers-reduced-motion:reduce) { .sp26 .capture-records.has-records .capture-code i::after { transition:none; } }
.sp26 .capture-link { flex:1; min-height:16px; position:relative; display:grid; place-items:center; color:#d4b68b; }
.sp26 .capture-link::before { content:''; position:absolute; top:0; bottom:0; width:1px; background:linear-gradient(#91cdd822,#e6c18a77); }
.sp26 .capture-link::after { content:'↓'; z-index:1; background:#102132; font-size:18px; line-height:22px; width:22px; text-align:center; }
.sp26 .capture-destination { flex:none; position:relative; margin-top:0; border-color:#d8b7836b; background:radial-gradient(ellipse at 100% 0,#edc68c12,transparent 70%),linear-gradient(110deg,#e2bf8613,#112536); box-shadow:inset 3px 0 #dabb88; }
.sp26 .capture-destination strong { font-size:25px; letter-spacing:.4px; }
.sp26 .capture-destination p { color:#bacddb; font-size:15px; }
.sp26 .capture-destination .capture-model-icon { position:absolute; top:20px; right:18px; width:48px; height:48px; color:#e9c591; opacity:.65; margin:0; }
.sp26 .capture-model-icon svg { width:100%; height:100%; }
.sp26 .capture-footer { border-color:#536e8566; background:linear-gradient(110deg,#162b3d,#0d1f30); box-shadow:inset 0 1px #ffffff05; }
.slide.report-ui.sp26 .capture-start.btn:not(:disabled) { box-shadow:0 4px 18px #d7b78216,inset 0 1px #fff7; }
.slide.report-ui.sp26 .capture-start.btn:not(:disabled):hover { background:linear-gradient(110deg,#f7dfbc,#e3c18e); border-color:#f3d7ae; }
.sp26 .capture-status::before { content:''; display:inline-block; width:7px; height:7px; border-radius:50%; margin:0 9px 2px 0; background:#738ea2; }
.sp26.capture-running .capture-status::before { background:#a4e1e2; box-shadow:0 0 9px #91d6da65; }
.sp26.capture-running .capture-step { border-color:#94d3d982; }
.sp26.capture-running .capture-card:not(:last-child)::after { color:#c1eaeb; border-color:#94d3d969; }
.sp26.capture-complete .capture-status::before { background:#a7dfc5; }
.sp26.capture-complete progress::-webkit-progress-value { background:#a7dfc5; }
.sp26 progress { height:5px; background:#1e394b; }
.sp26 progress::-webkit-progress-value { background:linear-gradient(90deg,#6eacbf,#b6e2da); }
.sp26 .capture-notes summary:focus-visible { outline:2px solid #acdce0; outline-offset:5px; border-radius:3px; }
`;

function poseSlide(body) {
  const slide = body.closest('.slide');
  const v = HOME.slice();
  const data = [];   // {pose(顯示單位), db[8], worst}
  const cT = h('canvas', { role:'img', 'aria-label':'八通道端面：青色為 PIC 模場，金色為光纖光斑' });
  const cB = h('canvas', { role:'img', 'aria-label':'八通道相對光功率' });
  const T = fitCanvas(cT, () => draw()), B = fitCanvas(cB, () => draw());
  const cnt = h('strong', null, '0'), records = h('div', { class:'capture-records' });
  const status = h('div', { class:'capture-status', role:'status' }, '一組六軸姿態 ＋ 八通道功率 ＝ 一筆訓練資料');
  const progress = h('progress', { max:CAPTURE_COUNT, value:0, 'aria-label':'本批採集進度' });
  const sl = AX.map((a, i) => slider({ label: a.label, min: a.min, max: a.max, step: a.step, value: v[i], unit: a.unit, digits: a.digits, onInput: (x) => { v[i] = x; draw(); } }));
  // Keep the exact sampled pose after acquisition. Restore manual detents only
  // when that axis is actually operated, updating its power at the same time.
  sl.forEach((s, i) => {
    const input = s.el.querySelector('input');
    const manual = event => {
      if (input.disabled || input.step !== 'any') return;
      if (event.type === 'keydown' && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
      input.step = AX[i].step; s.set(v[i]);
    };
    input.addEventListener('pointerdown', manual);
    input.addEventListener('keydown', manual);
  });
  const compute = (vv) => { const ch = etaFA(toPose(vv)); const db = ch.map((c) => dBrel(c.e)); return { ch, db, worst: Math.min(...db) }; };

  function draw() {
    const { ch, db } = compute(v), pose = toPose(v);
    // 8 個通道的端面小圖：藍＝晶片耦合器模場（1/e²），橘＝FA 光束打在端面的光斑（偏移不放大，±4 µm）
    { const { ctx, w, h: H } = T; if (w) {
      ctx.clearRect(0, 0, w, H);
      const gap = 6, tw = (w - gap * (NCH - 1)) / NCH, th = Math.min(tw, H - 34), y0 = 4, R = 4;
      ch.forEach((c, k) => {
        const x0 = k * (tw + gap), sc = th / (2 * R), cx = x0 + tw / 2, cy = y0 + th / 2;
        const bg = ctx.createLinearGradient(0, y0, 0, y0 + th); bg.addColorStop(0, '#0a1828'); bg.addColorStop(1, '#112a3a');
        ctx.beginPath(); ctx.roundRect(x0, y0, tw, th, 6); ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = '#759aae40'; ctx.lineWidth = 1; ctx.stroke();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = '#8fb7cd18'; ctx.beginPath(); ctx.moveTo(cx, y0 + 5); ctx.lineTo(cx, y0 + th - 5); ctx.moveTo(x0 + 5, cy); ctx.lineTo(x0 + tw - 5, cy); ctx.stroke();
        ctx.strokeStyle = '#91d8e1'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, FA8.wChip[0] * sc, FA8.wChip[1] * sc, 0, 0, 7); ctx.stroke();
        const sp = facetSpot(c, pose), sx = cx + sp.cx * sc, sy = cy - sp.cy * sc;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sp.w * sc); g.addColorStop(0, `rgba(255,205,130,${0.25 + 0.65 * Math.min(1, sp.I0)})`); g.addColorStop(1, 'rgba(240,175,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sp.w * sc, 0, 7); ctx.fill();
        ctx.strokeStyle = '#e8bc80'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(sx, sy, sp.w * sc, 0, 7); ctx.stroke(); ctx.restore();
        ctx.font = '600 13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#adc8d8'; ctx.fillText(`CH ${k + 1}`, cx, y0 + th + 10);
      });
    } }
    // 柱高為相對功率，底部列 dB；零損耗時仍能看見完整八通道。
    { const { ctx, w, h: H } = B; if (w) {
      ctx.clearRect(0, 0, w, H);
      const m = { l:41, r:6, t:16, b:51 }, pw = w - m.l - m.r, ph = H - m.t - m.b, bw = pw / NCH, Y = e => m.t + (1 - e) * ph;
      ctx.font = '12px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const p of [0, .5, 1]) { ctx.strokeStyle = '#8daec124'; ctx.beginPath(); ctx.moveTo(m.l, Y(p)); ctx.lineTo(w - m.r, Y(p)); ctx.stroke(); ctx.fillStyle = '#91aebf'; ctx.fillText(`${p * 100}%`, m.l - 7, Y(p)); }
      db.forEach((d, k) => {
        const x = m.l + k * bw + bw * .2, wid = bw * .6, e = clamp(ch[k].e / PK, 0, 1), y = Y(e);
        ctx.fillStyle = '#80b7c70b'; ctx.beginPath(); ctx.roundRect(x, m.t, wid, ph, 5); ctx.fill();
        const grad = ctx.createLinearGradient(0, m.t, 0, Y(0)); grad.addColorStop(0, '#b2e1dc'); grad.addColorStop(1, '#2d748a');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.roundRect(x, y, wid, Y(0) - y, [Math.min(4, (Y(0) - y) / 2), Math.min(4, (Y(0) - y) / 2), 0, 0]); ctx.fill();
        ctx.fillStyle = '#c4eeeb'; ctx.fillRect(x + 3, y, wid - 6, 2);
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '12px system-ui'; ctx.fillStyle = '#a9c2d1'; ctx.fillText(`CH ${k + 1}`, x + wid / 2, H - 39);
        ctx.font = '600 13px system-ui'; ctx.fillStyle = colDb(d); ctx.fillText(d.toFixed(1), x + wid / 2, H - 20);
      });
      cB.setAttribute('aria-label', `八通道相對光功率，dB：${db.map(d => d.toFixed(2)).join('、')}`);
    } }
  }

  // 重用三列 DOM，只更新讀值，避免每批拆除整排造成閃動及額外排版。
  const code = (count, color) => {
    const bars = Array.from({ length:count }, () => h('i', { style:{ '--level':'.4', '--color':color } }));
    return { el:h('div', { class:'capture-code', 'aria-hidden':'true' }, bars), bars };
  };
  const rowViews = Array.from({ length:3 }, () => {
    const number = h('span', null, '—'), pose = code(6, '#91cdd8'), power = code(8, '#e6c18a');
    const el = h('div', { class:'capture-record empty', role:'img' }, number, pose.el, h('i', null, '→'), power.el);
    return { el, number, pose, power };
  });
  records.append(h('div', { class:'capture-record-head', 'aria-hidden':'true' }, h('span', null, '筆次'), h('span', null, '6 軸姿態'), h('span'), h('span', null, '8 通道功率')), ...rowViews.map(r => r.el));
  const setCode = (view, values) => view.bars.forEach((bar, i) => bar.style.setProperty('--level', clamp(values[i], 0, 1)));
  function renderRecords() {
    cnt.textContent = data.length.toLocaleString();
    records.classList.toggle('has-records', data.length > 0);
    const latest = data.slice(-3).reverse();
    rowViews.forEach((view, i) => {
      const r = latest[i];
      const description = r ? '第 ' + r.n + ' 筆；' + r.pose.map((x, j) => AX[j].label + ' ' + x.toFixed(AX[j].digits) + ' ' + AX[j].unit).join('，') + '；功率 ' + r.db.map(d => d.toFixed(2)).join('、') + ' dB' : '等待採集';
      view.el.classList.toggle('empty', !r); view.el.title = description; view.el.setAttribute('aria-label', description);
      view.number.textContent = r ? String(r.n).padStart(3, '0') : '—';
      setCode(view.pose, r ? r.pose.map((x, j) => (x - AX[j].min) / (AX[j].max - AX[j].min)) : Array(6).fill(.4));
      setCode(view.power, r ? r.db.map(d => 10 ** (d / 10)) : Array(8).fill(.4));
    });
  }
  const record = vv => { const { db, worst } = compute(vv); data.push({ n:data.length + 1, pose:vv.slice(), db, worst }); };
  let rs = 12345;
  const u = () => (rs = (rs * 16807) % 2147483647) / 2147483647, U = a => (u() * 2 - 1) * a;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let todo = 0, elapsed = 0, batch = [], ahead = [], fromPose = HOME.slice(), previousPose = HOME.slice();
  const makeBatch = count => Array.from({ length:Math.min(3, count) }, () => [U(.3), U(1.5), FA8.WD + U(2), U(.15), U(.15), U(.2)]);
  const drawPose = () => { sl.forEach((s, k) => s.set(v[k], true)); draw(); };
  function setBusy(busy) {
    slide.classList.toggle('capture-running', busy);
    if (busy) slide.classList.remove('capture-complete');
    bAuto.disabled = busy; bRec.disabled = busy; bHome.disabled = busy;
    sl.forEach((s, k) => {
      const input = s.el.querySelector('input'); input.disabled = busy;
      // Native range step snapping otherwise remains visible even at high FPS.
      input.step = 'any';
      if (!busy) s.set(v[k], true);
    });
    bAuto.textContent = busy ? '正在配對採集…' : `▶ 自動採集 ${CAPTURE_COUNT} 筆`;
  }
  // 每 0.2 秒記錄原本的 3 筆獨立隨機姿態；中間畫面只插值姿態，功率仍由 FA8 即時計算。
  // 過渡畫面不寫入資料集；100 筆約 6.8 秒，展示節奏不表示設備採樣率。
  const acq = loop(dt => {
    elapsed += dt;
    if (elapsed >= .2) {
      elapsed %= .2;
      batch.forEach(record); todo -= batch.length; v.splice(0, 6, ...batch.at(-1));
      progress.value = CAPTURE_COUNT - todo; renderRecords();
      if (todo <= 0) {
        drawPose(); acq.stop(); setBusy(false); slide.classList.add('capture-complete'); status.textContent = `本批 ${CAPTURE_COUNT} 筆完成 · 姿態與功率已逐筆配對`; return;
      }
      previousPose = fromPose; fromPose = batch.at(-1); batch = ahead; ahead = makeBatch(todo - batch.length);
      if (reducedMotion.matches) drawPose();
    }
    if (reducedMotion.matches) return;
    const target = batch.at(-1);
    // Follow the display's animation frames rather than dropping to 30 FPS.
    v.splice(0, 6, ...interpolateCapturePose(previousPose, fromPose, target, ahead.at(-1) || target, elapsed / .2)); drawPose();
  });
  const bRec = h('button', { type:'button', class:'btn', onclick:() => { record(v); renderRecords(); status.textContent = '已加入一筆 · 六軸姿態與八通道功率同步記錄'; } }, '＋ 記錄此姿態');
  const bAuto = h('button', { type:'button', class:'btn capture-start', onclick:() => { todo = CAPTURE_COUNT; elapsed = 0; previousPose = v.slice(); fromPose = v.slice(); batch = makeBatch(todo); ahead = makeBatch(todo - batch.length); progress.value = 0; setBusy(true); status.textContent = '改變姿態 → 讀取功率 → 配對入庫'; acq.start(); } }, `▶ 自動採集 ${CAPTURE_COUNT} 筆`);
  const bClr = h('button', { type:'button', class:'btn ghost', onclick:() => { acq.stop(); todo = 0; setBusy(false); slide.classList.remove('capture-complete'); data.length = 0; progress.value = 0; renderRecords(); status.textContent = '資料已清空 · 可重新採集'; } }, '清空');
  const bHome = h('button', { type:'button', class:'btn ghost', onclick:() => { HOME.forEach((x, i) => sl[i].set(x, true)); v.splice(0, 6, ...HOME); draw(); } }, '歸零');
  const head = (n, text) => h('div', { class:'capture-head' }, h('span', { class:'capture-step', 'aria-hidden':'true' }, n), h('h2', null, text));
  body.append(h('div', { class:'capture-layout' },
    h('section', { class:'card dark capture-card' }, head('01', '設定六軸姿態'),
      h('div', { class:'capture-sliders' }, sl.map(s => s.el)), h('div', { class:'capture-tools' }, bRec, bHome)),
    h('section', { class:'card dark capture-card' }, head('02', '讀取八通道功率'),
      h('div', { class:'capture-caption' }, 'PIC 端面', h('div', { class:'capture-legend' }, h('span', { style:{ '--dot':'#91d8e1' } }, 'PIC 模場'), h('span', { style:{ '--dot':'#e8bc80' } }, '光纖光斑'))),
      h('div', { class:'capture-facets' }, cT),
      h('div', { class:'capture-caption' }, '相對光功率', h('span', null, '同一姿態 · 同步配對')),
      h('div', { class:'capture-chart' }, cB), h('div', { class:'capture-chart-note' }, '100%＝標稱對準功率；底部數值為 dB')),
    h('section', { class:'card dark capture-card' }, head('03', '建立配對資料集'),
      h('div', { class:'capture-caption' }, '已採集', bClr), h('div', { class:'capture-total' }, cnt, h('span', null, '筆配對資料')),
      records, h('div', { class:'capture-link', 'aria-hidden':'true' }),
      h('div', { class:'capture-destination' }, h('span', null, '資料用途'), h('strong', null, '提供子計畫三'), h('p', null, '建立模型訓練所需資料'),
        h('span', { class:'capture-model-icon', 'aria-hidden':'true', html:'<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 14 24 8 40 14M8 14 24 24 40 14M8 34 24 24 40 34M8 34 24 40 40 34M24 8 24 40" stroke="currentColor" stroke-opacity=".45"/><g fill="#1d3040" stroke="currentColor"><circle cx="8" cy="14" r="3"/><circle cx="8" cy="34" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="24" cy="24" r="4"/><circle cx="24" cy="40" r="3"/><circle cx="40" cy="14" r="3"/><circle cx="40" cy="34" r="3"/></g></svg>' })))),
    h('div', { class:'capture-footer' }, bAuto, h('div', { class:'capture-progress' }, status, progress),
      h('div', { class:'capture-notes' }, '模擬採集示意 · 尚未真機驗證',
        h('details', null, h('summary', null, '模型設定'), h('div', { class:'capture-details' },
          h('b', null, '8 通道透鏡 FA → PIC'),
          h('p', null, 'FA8_Lensed_PIC v1.0；pitch 127 µm、WD 14 µm（假設）。理想 FA，無量測雜訊，旋轉中心在陣列中央。'),
          h('p', null, '自動採集範圍：X ±0.3、Y ±1.5、Z 相對 WD ±2 µm；θx、θy ±0.15°，θz ±0.2°。六軸獨立均勻隨機。'),
          h('p', null, '端面每格 ±4 µm；青色為 PIC 模場，金色為光斑。採集筆數僅保留於目前頁面工作階段；此處不執行訓練或傳送資料。'))))));
  body.prepend(h('style', null, CSS)); body.closest('.slide').classList.add('sp26');
  renderRecords(); draw();
  return { show() { draw(); }, hide() { acq.stop(); if (todo) status.textContent = '本批已停止 · 已採集 ' + (CAPTURE_COUNT - todo) + ' 筆'; todo = 0; setBusy(false); body.querySelector('details').open = false; } };
}

export function mount(sec) {
  sec.slide({ title:'姿態與光功率採集', sub:'' }, poseSlide);
}
