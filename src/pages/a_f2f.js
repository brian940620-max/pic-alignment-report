// 分頁 ② PIC 邊緣耦合的三張（由 main.js 的 compose 與 b_edge.js 交錯排列）：
//   1) 同一套 Z 軸模場：透鏡只是放在第幾層（四種情況的 w(z)，三層對齊）
//   2) PIC 的模場只是另一組高斯參數（模場圖庫＋重疊效率）
//   3) 結論：光纖對光纖到 PIC 的模場可以無縫銜接，難點是實機驗證
import { h, segmented, fitCanvas, fmtDb, fmtPct } from '../ui.js';
import { eta, lossDb, tolerance1dB } from '../physics.js';
import { CASES, CASE_IDS, F2F, LAYER_NAMES, W_SMF, zR } from '../optics3.js';
import { tex } from '../tex.js';

const CSS = `
.ff-eq { font-family: "Cambria Math", "Times New Roman", serif; font-size: 21px; color:#fff; background:rgba(255,255,255,.05); border:1px solid rgba(140,170,230,.25); border-radius:10px; padding:8px 14px; margin:6px 0; }
.ff-eq small { display:block; font-family: var(--font); font-size:13.5px; color:var(--stage-muted); margin-top:2px; }
.ff-map { display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:14.5px; color:#dfe8fa; } .ff-map b { display:block; font-size:14px; }
.ff-eq .tex { padding:2px 0; }
.ff-tb { width:100%; border-collapse:collapse; font-size:14.5px; }
.ff-tb th, .ff-tb td { padding:5px 8px; border-bottom:1px solid rgba(140,170,230,.18); text-align:left; }
.ff-tb th { color:#ffb86b; font-weight:600; } .ff-tb tr.on td { background:rgba(255,138,61,.14); color:#fff; }
.ff-flow { display:grid; grid-template-columns: 1fr 56px 1fr 56px 1fr; align-items:stretch; flex:none; }
.ff-step { border-radius:16px; padding:18px 20px; color:#fff; position:relative; overflow:hidden; border:1px solid rgba(255,255,255,.18); }
.ff-step::after { content:''; position:absolute; inset:0; background:radial-gradient(400px 160px at 0% 0%, rgba(255,255,255,.18), transparent 60%); pointer-events:none; }
.ff-step .no { font-size:15px; letter-spacing:2px; opacity:.85; } .ff-step h2 { color:#fff; font-size:25px; margin:4px 0 8px; }
.ff-step .tol { font-family:var(--mono); font-size:30px; font-weight:700; } .ff-step ul { margin:8px 0 0; padding-left:20px; font-size:15.5px; line-height:1.55; }
.ff-arrow { display:flex; align-items:center; justify-content:center; font-size:40px; color:#ffb86b; text-shadow:0 0 16px #ff8a3d; }
.ff-two { display:grid; grid-template-columns:1fr 1fr 1.15fr; gap:12px; }
.ff-two h3 { font-size:19px; } .ff-two li { margin:3px 0; }
`;

const BEAM = 'rgba(255,138,61,';
const ROWS = [F2F, ...CASE_IDS.map((id) => CASES[id])];

export function mount(sec) {
  let cssDone = false;
  const css = (body) => { body.closest('.slide').classList.add('edge-ui'); if (!cssDone) { body.append(h('style', null, CSS)); cssDone = true; } };

  // ============ 1. 同一套 Z 軸模場 ============
  sec.slide({ title: '透鏡只是放在第幾層：同一條高斯光束', sub: '' }, (body) => {
    css(body);
    let sel = 'f2f';
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block', cursor: 'pointer' } });
    const tb = h('tbody');
    const g = fitCanvas(cv, () => draw());
    const rowY = [];
    function draw() {
      const { ctx, w: W, h: H } = g;
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      const L = 190, R = W - 18, top = 58, rh = (H - top - 8) / ROWS.length;
      // 層的欄位（所有列對齊）：光纖內 | 第 1 層 | 第 2 層 | 第 3 層 | 晶片內
      const X1 = L + (R - L) * 0.16, X3 = L + (R - L) * 0.78;
      ctx.font = '600 14px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      [[X1, 0], [(X1 + X3) / 2, 1], [X3, 2]].forEach(([x, n]) => {
        ctx.strokeStyle = 'rgba(140,170,230,.35)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, top - 12); ctx.lineTo(x, H - 4); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ffb86b'; ctx.fillText(LAYER_NAMES[n], x, 8);
      });
      ctx.fillStyle = '#93a6c6'; ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif';
      ctx.fillText('光纖內', (L + X1) / 2, 30); ctx.fillText('自由空間（間隙）', (X1 + X3) / 2, 30); ctx.fillText('接收端', (X3 + R) / 2, 30);
      rowY.length = 0;
      ROWS.forEach((c, i) => {
        const y0 = top + i * rh, cy = y0 + rh / 2, on = c.id === sel;
        rowY.push({ id: c.id, y0, y1: y0 + rh });
        if (on) { ctx.fillStyle = 'rgba(255,138,61,.08)'; ctx.beginPath(); ctx.roundRect(6, y0 + 3, W - 12, rh - 6, 10); ctx.fill(); }
        // 左側名稱
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = on ? '#fff' : '#c8d5ec'; ctx.font = `${on ? 700 : 600} 16px system-ui, "Microsoft JhengHei", sans-serif`;
        ctx.fillText(c.id === 'f2f' ? '光纖對光纖' : `${c.tag}．${c.name}`.replace('一般光纖＋固定透鏡', '光纖＋固定透鏡'), 16, cy - 10);
        ctx.fillStyle = '#93a6c6'; ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif';
        ctx.fillText(c.id === 'f2f' ? '我的 Z 軸模場（無透鏡）' : `透鏡在第 ${c.layer} 層`, 16, cy + 12);
        // z → x（分段線性，讓層對齊）
        const zIn = -80, zOut = c.zc + 90;
        const X = (z) => (z < 0 ? L + (X1 - L) * (z - zIn) / -zIn : z <= c.zc ? X1 + (X3 - X1) * (z / c.zc) : X3 + (R - X3) * (z - c.zc) / (zOut - c.zc));
        const amp = rh * 0.36, Y = (w) => amp * (w / (w + 9));
        // 光纖、接收端底色
        ctx.fillStyle = 'rgba(150,190,255,.07)'; ctx.fillRect(L, cy - amp - 4, X1 - L, 2 * amp + 8);
        ctx.fillStyle = c.id === 'f2f' ? 'rgba(150,190,255,.07)' : 'rgba(80,190,255,.10)'; ctx.fillRect(X3, cy - amp - 4, R - X3, 2 * amp + 8);
        // 光束（發光帶）
        const pts = []; for (let k = 0; k <= 260; k++) { const z = zIn + (zOut - zIn) * (k / 260); pts.push([X(z), Y(c.w(z))]); }
        for (const [f, a] of [[1.6, 0.10], [1.0, 0.32], [0.45, 0.7]]) {
          ctx.beginPath(); pts.forEach(([x, yy], k) => (k ? ctx.lineTo(x, cy - yy * f) : ctx.moveTo(x, cy - yy * f)));
          for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k][0], cy + pts[k][1] * f);
          ctx.closePath(); ctx.fillStyle = BEAM + (on ? a : a * 0.7) + ')'; ctx.fill();
        }
        ctx.strokeStyle = '#ff9a4d'; ctx.lineWidth = 1.3;
        for (const sgn of [-1, 1]) { ctx.beginPath(); pts.forEach(([x, yy], k) => (k ? ctx.lineTo(x, cy + sgn * yy) : ctx.moveTo(x, cy + sgn * yy))); ctx.stroke(); }
        // 透鏡
        if (c.lensZ != null) {
          const lx = X(c.lensZ), lh = amp * 1.05;
          ctx.save(); ctx.shadowColor = '#ffd29a'; ctx.shadowBlur = 14;
          ctx.fillStyle = 'rgba(255,226,170,.55)'; ctx.strokeStyle = '#ffe2aa'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(lx, cy, 7, lh, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        // 光腰
        const wx = X(c.zWaist);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(wx, cy, 3.2, 0, 7); ctx.fill();
        // 右側：接收端名稱
        ctx.textAlign = 'right'; ctx.fillStyle = '#9fd8ff'; ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif';
        ctx.fillText(c.id === 'f2f' ? '接收光纖 w₀=5.2 µm' : 'PIC：SSC w≈1.5 µm', R - 4, y0 + 14);
      });
    }
    cv.addEventListener('click', (ev) => {
      const r = cv.getBoundingClientRect(), y = (ev.clientY - r.top) * (cv.clientHeight / r.height);
      const hit = rowY.find((k) => y >= k.y0 && y < k.y1); if (hit) { sel = hit.id; draw(); fillTb(); }
    });
    function fillTb() {
      tb.replaceChildren(...ROWS.map((c) => h('tr', { class: c.id === sel ? 'on' : '' },
        h('td', null, h('button', { class: 'edge-case', type: 'button', 'aria-pressed': String(c.id === sel), onclick: () => { sel = c.id; draw(); fillTb(); tb.querySelectorAll('button')[ROWS.indexOf(c)].focus(); } }, c.id === 'f2f' ? '光纖對光纖' : `${c.tag} ${c.name}`)), h('td', null, c.lensZ == null ? '—' : `第 ${c.layer} 層`),
        h('td', null, c.id === 'f2f' ? '5.2 µm，在端面' : `1.5 µm，端面${c.id === 'chiplens' ? '內' : '上'}`))));
    }
    fillTb();
    const zr = zR(W_SMF);
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.6fr 1fr' } },
      h('div', { class: 'card dark', style: { padding: '8px 10px' } }, cv),
      h('div', { class: 'card dark col', style: { gap: '6px' } },
        h('h3', { style: { margin: 0, fontSize: '18px' } }, '光束怎麼走：每一段都是同一條式子'),
        h('div', { class: 'ff-eq' }, tex('w(z)=w_0\\sqrt{1+\\left(\\frac{z-z_w}{z_R}\\right)^{2}},\\qquad z_R=\\frac{\\pi n w_0^2}{\\lambda}', 'sm'), h('small', null, `光纖 w₀ = 5.2 µm 時 z_R = ${zr.toFixed(1)} µm；z_w＝光腰位置（耦合效率式見 ① 第 3 頁）`)),
        h('div', { style: { fontSize: '15.5px', lineHeight: 1.6 } },
          h('b', { style: { color: '#ffb86b' } }, '透鏡＝在某一層換一組（w₀、光腰位置）'), '。薄透鏡只改波前曲率、不改當下的光束半徑，透鏡之後仍是同一條 w(z)。所以光纖＋透鏡、透鏡光纖、PIC 上有透鏡，',
          h('b', null, '模型都不用重寫'), '，只差透鏡放在第幾層。'),
        h('div', { class: 'edge-hint' }, '選擇下方情況，對照左側光路'),
        h('table', { class: 'ff-tb' }, h('thead', null, h('tr', null, h('th', null, '情況'), h('th', null, '透鏡'), h('th', null, '光腰'))), tb))));
    return { show() { g.apply(); draw(); } };
  });

  // ============ 2. PIC 模場只是另一組高斯參數 ============
  const MODES = [
    { id: 'smf', name: 'SMF-28 光纖', wx: 5.2, wy: 5.2, side: 'f', note: 'MFD 10.4 µm（1550 nm）' },
    { id: 'lens', name: '透鏡光纖光點', wx: 1.5, wy: 1.5, side: 'f', note: '熱點 2–4 µm（Marchetti 2019）' },
    { id: 'ssc', name: 'PIC：SSC', wx: 1.5, wy: 1.5, side: 'c', note: '約 3×3 µm（Carroll 2016）' },
    { id: 'si', name: 'PIC：矽線波導（無 SSC）', wx: 0.30, wy: 0.22, side: 'c', note: '450×220 nm 截面（示意）' },
  ];
  sec.slide({ title: 'PIC 的光模場：只是換一組高斯參數', sub: '' }, (body) => {
    css(body);
    let src = 'smf', dst = 'ssc';
    const cv = h('canvas', { style: { width: '100%', height: '100%', display: 'block' } });
    const g = fitCanvas(cv, () => draw());
    const out = h('div');
    const segF = segmented(MODES.filter((m) => m.side === 'f').map((m) => ({ id: m.id, label: m.name })), src, (id) => { src = id; draw(); });
    const segC = segmented(MODES.filter((m) => m.side === 'c').map((m) => ({ id: m.id, label: m.name })), dst, (id) => { dst = id; draw(); });
    segC.el.style.flexDirection = 'column'; segF.el.style.flexDirection = 'column';
    function draw() {
      const { ctx, w: W, h: H } = g;
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      // 上：四個模場的 2D 強度圖（同比例：視窗 ±7 µm）
      const n = MODES.length, tile = Math.min((W - 20) / n - 10, H * 0.5), hw = 7, s = tile / (2 * hw);
      MODES.forEach((m, i) => {
        const x0 = 10 + i * (tile + 10 + ((W - 20) - n * (tile + 10)) / n), y0 = 34;
        const pick = m.id === src || m.id === dst;
        const img = ctx.createImageData(Math.round(tile * 1), Math.round(tile * 1));
        const N = img.width;
        for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
          const ux = (xx / N - 0.5) * 2 * hw, uy = (yy / N - 0.5) * 2 * hw;
          const I = Math.exp(-2 * (ux * ux / (m.wx * m.wx) + uy * uy / (m.wy * m.wy)));
          const k = (yy * N + xx) * 4, warm = m.side === 'f';
          img.data[k] = warm ? 20 + 235 * Math.min(1, I * 1.3) : 10 + 90 * I;
          img.data[k + 1] = warm ? 14 + 150 * I : 18 + 190 * I;
          img.data[k + 2] = warm ? 30 + 40 * I : 40 + 215 * I;
          img.data[k + 3] = 255;
        }
        // 用離屏畫布縮放到裝置像素
        const oc = document.createElement('canvas'); oc.width = N; oc.height = N; oc.getContext('2d').putImageData(img, 0, 0);
        ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, tile, tile, 10); ctx.clip(); ctx.drawImage(oc, x0, y0, tile, tile); ctx.restore();
        ctx.strokeStyle = pick ? '#ffb86b' : 'rgba(140,170,230,.3)'; ctx.lineWidth = pick ? 3 : 1; ctx.beginPath(); ctx.roundRect(x0, y0, tile, tile, 10); ctx.stroke();
        ctx.fillStyle = pick ? '#fff' : '#c8d5ec'; ctx.font = `${pick ? 700 : 600} 15px system-ui, "Microsoft JhengHei", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(m.name, x0 + tile / 2, y0 - 6);
        ctx.fillStyle = '#93a6c6'; ctx.font = '13px system-ui, sans-serif'; ctx.textBaseline = 'top';
        ctx.fillText(`w = ${m.wx}${m.wy !== m.wx ? ' × ' + m.wy : ''} µm`, x0 + tile / 2, y0 + tile + 6);
        // 比例尺 5 µm
        if (i === 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + tile - 10); ctx.lineTo(x0 + 8 + 5 * s, y0 + tile - 10); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('5 µm', x0 + 8, y0 + tile - 13); }
      });
      // 下：水平方向剖面（同一張圖，看出都是高斯，只是寬度不同）
      const py0 = 34 + tile + 66, ph = H - py0 - 30, px0 = 50, pw = W - 70, xr = 9;
      const X = (u) => px0 + ((u + xr) / (2 * xr)) * pw, Y = (v) => py0 + ph - v * ph;
      ctx.strokeStyle = 'rgba(140,170,230,.25)'; ctx.lineWidth = 1;
      for (let u = -8; u <= 8; u += 2) { ctx.beginPath(); ctx.moveTo(X(u), py0); ctx.lineTo(X(u), py0 + ph); ctx.stroke(); }
      ctx.fillStyle = '#93a6c6'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let u = -8; u <= 8; u += 4) ctx.fillText(`${u}`, X(u), py0 + ph + 4);
      ctx.fillText('x（µm）', X(0), py0 + ph + 17);
      for (const m of MODES) {
        const pick = m.id === src || m.id === dst, warm = m.side === 'f';
        ctx.strokeStyle = pick ? (warm ? '#ff9a4d' : '#4fc3ff') : (warm ? 'rgba(255,154,77,.25)' : 'rgba(79,195,255,.25)'); ctx.lineWidth = pick ? 3 : 1.4;
        ctx.beginPath(); for (let k = 0; k <= 300; k++) { const u = -xr + (2 * xr * k) / 300, v = Math.exp(-2 * u * u / (m.wx * m.wx)); k ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)); } ctx.stroke();
      }
      ctx.fillStyle = '#c8d5ec'; ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('水平剖面 I(x) = exp(−2x² / w²)：全部都是同一個形狀，只有寬度 w 不同', px0, py0 - 22);
      // 重疊效率
      const a = MODES.find((m) => m.id === src), b = MODES.find((m) => m.id === dst);
      const e = eta({ wf: a.wx, WD: 0, wgx: b.wx, wgy: b.wy }, { dx: 0, dy: 0, gap: 0, tx: 0, ty: 0 });
      const sig = (b.wx / a.wx) ** 2;
      const tol = tolerance1dB({ wf: a.wx, WD: 0, wgx: b.wx, wgy: b.wy }, 'x');
      const ex = (2 * a.wx * b.wx) / (a.wx ** 2 + b.wx ** 2), ey = (2 * a.wy * b.wy) / (a.wy ** 2 + b.wy ** 2);
      const r2 = (v) => +v.toFixed(2);
      out.replaceChildren(
        h('div', { class: 'ff-map' },
          h('div', null, h('b', { style: { color: '#ff9a4d' } }, '光纖側 ', a.name), h('div', { html: `w<sub>1x</sub> = ${r2(a.wx)} µm、w<sub>1y</sub> = ${r2(a.wy)} µm` })),
          h('div', null, h('b', { style: { color: '#4fc3ff' } }, '晶片側 ', b.name), h('div', { html: `w<sub>2x</sub> = ${r2(b.wx)} µm、w<sub>2y</sub> = ${r2(b.wy)} µm` }))),
        tex(`\\eta_x=\\frac{2(${r2(a.wx)})(${r2(b.wx)})}{${r2(a.wx)}^2+${r2(b.wx)}^2}=${ex.toFixed(3)},\\quad \\eta_y=${ey.toFixed(3)}`, 'sm'),
        h('div', { class: 'kpi' }, h('div', { class: 'lab', style: { color: 'var(--stage-muted)', fontSize: '15px' } }, `${a.name} → ${b.name}`),
          h('div', { class: 'big', style: { color: e > 0.8 ? '#69db7c' : e > 0.4 ? '#ffd43b' : '#ff6b6b', fontSize: '50px' } }, fmtPct(e)),
          h('div', { style: { color: 'var(--stage-muted)' } }, `模場失配 ${fmtDb(lossDb(e))}　σ = (w₂/w₁)² = ${sig.toFixed(sig < 0.1 ? 4 : 2)}　1 dB 橫向容差 ±${tol.toFixed(2)} µm`)));
    }
    body.append(h('div', { class: 'grid grow', style: { gridTemplateColumns: '1.7fr 1fr' } },
      h('div', { class: 'card dark', style: { padding: '10px 12px' } }, cv),
      h('div', { class: 'card dark col', style: { gap: '8px' } },
        h('div', { class: 'ff-eq' }, tex('E(x,y)\\propto\\exp\\!\\left(-\\frac{x^2}{w_x^2}-\\frac{y^2}{w_y^2}\\right)', 'sm'), h('small', null, '光纖、透鏡光纖的光點、PIC 的 SSC 與波導模態：都用這一個式子，只差 (w_x, w_y)')),
        h('div', { class: 'ff-eq' }, tex('\\eta=\\eta_x\\,\\eta_y,\\qquad \\eta_x=\\frac{2\\,w_{1x}w_{2x}}{w_{1x}^2+w_{2x}^2}', 'sm'), h('small', null, '已對準時的重疊效率；下標 1＝光纖側、2＝晶片側（就是 ① 第 3 頁光腰處的峰值）')),
        h('div', { class: 'grid g2', style: { gap: '10px' } }, h('div', null, h('div', { class: 'small muted' }, '光纖側'), segF.el), h('div', null, h('div', { class: 'small muted' }, '晶片側'), segC.el)),
        out,
        h('div', { style: { fontSize: '15px', lineHeight: 1.55, marginTop: 'auto' } }, '光纖對光纖是 w₁ = w₂ = 5.2 µm（σ = 1）的特例；換成 PIC，只是把 (w_x, w_y) 換成 SSC 或耦合器的值，Z 軸傳播與對位方法都不用改。'))));
    return { show() { g.apply(); draw(); } };
  });

  // ============ 3. 結論 ============
  sec.slide({ title: '結論：光纖對光纖到 PIC 的模場可以無縫銜接，難點是實機驗證', sub: '' }, (body) => {
    css(body);
    const tF = tolerance1dB({ wf: 5.2, WD: 0, wgx: 5.2, wgy: 5.2 }, 'x');
    const tP = tolerance1dB({ wf: 1.5, WD: 30, wgx: 1.5, wgy: 1.5 }, 'x');
    const step = (no, title, tol, bg, items) => h('div', { class: 'ff-step', style: { background: bg } },
      h('div', { class: 'no' }, no), h('h2', null, title), h('div', { class: 'tol' }, tol), h('ul', null, items.map((t) => h('li', null, t))));
    body.append(
      h('div', { class: 'ff-flow' },
        step('STEP 1', '光纖對光纖', `±${tF.toFixed(1)} µm`, 'linear-gradient(140deg,#1e4f8f,#163764)',
          ['兩端都是 SMF-28，σ = 1', '已完成：Z 軸模場、三軸／五軸對位演算法、相機 ML 粗對位（模擬）', '兩端都能拍光斑，模型可以直接驗證']),
        h('div', { class: 'ff-arrow' }, '➜'),
        step('STEP 2', '換參數，不換方法', '透鏡在第幾層', 'linear-gradient(140deg,#7a4a12,#5a3008)',
          ['透鏡光纖：第 1 層', '光纖＋固定透鏡：第 2 層', 'PIC 上有透鏡：第 3 層', '接收端換成 SSC 的 (w_x, w_y)']),
        h('div', { class: 'ff-arrow' }, '➜'),
        step('STEP 3', 'PIC 邊緣耦合', `±${tP.toFixed(2)} µm`, 'linear-gradient(140deg,#a33d0b,#6b2205)',
          ['光點約 3 µm，容差縮小約 ' + (tF / tP).toFixed(1) + ' 倍', '同一套找光、繞圈梯度、光斑寬度量間距', '同一台平台，換夾具與晶片吸盤'])),
      h('div', { class: 'ff-two grow' },
        h('div', { class: 'card' }, h('h3', null, '不變的'), h('ul', { style: { paddingLeft: '20px', margin: 0, fontSize: '16px' } },
          h('li', null, '高斯光束沿 Z 傳播＋模場重疊積分'), h('li', null, '對位演算法：First Light、繞圈梯度、光斑寬度量間距（C）'), h('li', null, '三階段流程：粗動 → 相機＋ML → 壓電精對位'), h('li', null, '平台硬體（報價機台）'))),
        h('div', { class: 'card' }, h('h3', null, '要換的'), h('ul', { style: { paddingLeft: '20px', margin: 0, fontSize: '16px' } },
          h('li', null, '光腰大小與位置（透鏡放第幾層）'), h('li', null, '接收端模場 (w_x, w_y)，可能是橢圓'), h('li', null, '容差變緊、步長與繞圈半徑要縮小'), h('li', null, '相機 ML 要用 PIC 影像重訓'))),
        h('div', { class: 'card', style: { borderLeft: '6px solid #e8590c' } }, h('h3', null, '為什麼不直接從 PIC 開始'), h('ul', { style: { paddingLeft: '20px', margin: 0, fontSize: '16px' } },
          h('li', null, '光進了晶片就看不到：功率低時分不出是沒對準，還是 SSC、端面或波導本身的損耗'),
          h('li', null, '光纖對光纖兩端都能量，可以先把模型、平台、演算法各自驗證過'),
          h('li', null, '容差寬約 ' + (tF / tP).toFixed(1) + ' 倍，先把整套流程跑通，再縮到 PIC 的容差'),
          h('li', null, '晶片端面怕撞、樣品少；光纖便宜，可以多做實驗')))));
  });
}
