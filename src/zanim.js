// 三軸精對位動畫（光纖對光纖）：照進度報告影片 zsim_final_scheme.mp4（Z_alignment_sim/zsim_video_simple.m）的內容重畫，配色改成網頁的深色風格——
// 同一次模擬（export_zrun_web.m 匯出的 zrun.json：C 量間距、seed 7、相機以為 80 µm／實際 120.8 µm、每 4 步重對 XY），
// 同樣的版面（字幕、上視 ±62 µm、側視、功率條）、字幕與時間（粗動 3 s → 相機 4 s → 精對位 22 s → 完成 3 s），
// 另外在「找到 First Light」與「找到第一個平面（相機給的間距）的峰值」各停 HOLD 秒。
// 步驟 4 靠近、5 最終精修的運動畫成連續——繞圈沿圓弧走；一圈繞完直接接下一圈（圓心連續漂過去，不回圓心再射出）；
// 進出圈用 1/4 圈螺旋。前三步和影片一樣逐列跳。
import RUN from './zrun.json';

export const ZSTEPS = ['螺旋找光', '繞圈梯度', 'C 量間距', '靠近', '最終精修'];
export const ZCOL = ['#7fb2ff', '#38d39f', '#ffb020', '#ff7a59', '#ff4fa3'];
const T1 = 3, T2 = 4, T3 = 22, T4 = 3;                 // 影片：90、120、660、90 格（30 fps）
const HOLD = 1.5;                                      // 兩次停頓（秒）

export function buildZRun() {
  const L = RUN.L.map(([t, ph, x, y, zc, gap, db]) => ({ t, ph, x, y, zc, z: gap, db: db === -999 ? null : db }));
  const i0 = L.findIndex((r) => r.ph >= 4);
  // 前三步：每列一個點，位置逐列跳（同影片）
  const P = L.slice(0, i0).map((r) => ({ t: r.t, x: r.x, y: r.y, z: r.z, lerp: false }));
  // 步驟 4、5：連續路徑。關鍵點＝位置有變的列（抵達時間＝該列時間）
  const K = [{ ...L[i0 - 1], meas: true }];
  for (let i = i0; i < L.length; i++) {
    const r = L[i], q = K[K.length - 1];
    if (Math.hypot(r.x - q.x, r.y - q.y) + Math.abs(r.z - q.z) > 1e-9) K.push({ ...r, meas: false });
    if (r.db !== null) K[K.length - 1].meas = true;
  }
  // 找圓：後面連續 ≥ 8 個關鍵點到它的距離相同 → 它是圓心，那些點在它的圓上
  const isHub = K.map(() => false), circ = K.map(() => null), d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (let j = 0; j < K.length - 8; j++) {
    const c = K[j], r = d2(K[j + 1], c);
    if (r < 0.5 || r > 15) continue;
    let n = 1; while (j + 1 + n < K.length && Math.abs(d2(K[j + 1 + n], c) - r) < 1e-3 && Math.abs(K[j + 1 + n].z - c.z) < 1e-9) n++;
    if (n >= 8) { isHub[j] = true; for (let m = j + 1; m <= j + n; m++) circ[m] = c; }
  }
  const ease = (u) => u * u * (3 - 2 * u), ang = (p, c) => Math.atan2(p.y - c.y, p.x - c.x), N = 16;
  const seg = (a, b, f) => { for (let k = 1; k <= N; k++) { const u = k / N, p = f(u); P.push({ t: a.t + (b.t - a.t) * u, x: p.x, y: p.y, z: a.z + (b.z - a.z) * u, lerp: true }); } };
  const arc = (a, b, h1, h2) => {                                 // 沿圓弧（圓心可同時從 h1 漂到 h2）
    const ra = d2(a, h1), rb = d2(b, h2), t0 = ang(a, h1); let d = ang(b, h2) - t0; while (d <= 0) d += 2 * Math.PI;
    seg(a, b, (u) => ({ x: h1.x + (h2.x - h1.x) * u + (ra + (rb - ra) * u) * Math.cos(t0 + d * u), y: h1.y + (h2.y - h1.y) * u + (ra + (rb - ra) * u) * Math.sin(t0 + d * u) }));
  };
  for (let j = 0; j < K.length - 1; j++) {
    const a = K[j], b = K[j + 1];
    if (circ[j] && circ[j + 1] === circ[j]) arc(a, b, circ[j], circ[j]);                       // 圓上 → 圓上
    else if (circ[j] && isHub[j + 1] && !b.meas && circ[j + 2] === b) { arc(a, K[j + 2], circ[j], b); j++; }   // 一圈接下一圈：不回圓心
    else if (circ[j]) {                                                                                // 圓上 → 新圓心：1/4 圈螺旋漸入
      const h = circ[j], ra = d2(a, h), t0 = ang(a, h);
      seg(a, b, (u) => { const e = ease(u), rr = ra * (1 - e), th = t0 + (Math.PI / 2) * u; return { x: h.x + (b.x - h.x) * e + rr * Math.cos(th), y: h.y + (b.y - h.y) * e + rr * Math.sin(th) }; });
    } else if (circ[j + 1] === a) {                                                                    // 圓心 → 圓上：1/4 圈螺旋漸出
      const rb = d2(b, a), t1 = ang(b, a);
      seg(a, b, (u) => { const rr = rb * ease(u), th = t1 - (Math.PI / 2) * (1 - u); return { x: a.x + rr * Math.cos(th), y: a.y + rr * Math.sin(th) }; });
    } else seg(a, b, (u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }));               // 其他（Z 靠近）：直線
  }
  const est = Array.isArray(RUN.est[0]) ? RUN.est : [RUN.est];
  const ev = {
    total: T1 + T2 + T3 + 2 * HOLD + T4, simTotal: RUN.total, gTrue0: RUN.gTrue0, gapErr: RUN.gapErr, xyRes: RUN.xyRes,
    holds: [Math.max(...L.filter((r) => r.ph === 1).map((r) => r.t)), Math.max(...L.filter((r) => r.ph === 2).map((r) => r.t))],   // 停頓點：步驟 1、2 的最後一列
    start: { x: -RUN.cx, y: -RUN.cy }, z1: L.find((r) => r.ph === 3).zc, est,
  };
  return { L, P, ev };
}

const last = (arr, t) => { let lo = 0, hi = arr.length - 1; if (arr[0].t > t) return 0; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m].t <= t) lo = m; else hi = m - 1; } return lo; };

// 網頁深色配色
const C = {
  ink: '#dfe8fa', muted: '#93a6c6', panel: '#081120', edge: 'rgba(140,170,230,.35)', grid: 'rgba(140,170,230,.12)',
  box: '#7fb2ff', fixF: 'rgba(160,170,190,.35)', fixE: '#aeb8cb', mvF: 'rgba(70,140,255,.35)', mvE: '#5aa0ff', trail: 'rgba(127,178,255,.9)',
  fiber: '#5d6b82', ghost: '#ffd29a', target: '#38d39f', accent: '#ffb86b',
};

// 時間 → 狀態（模擬時間 × 22/7.28 播放，兩個停頓點各停 HOLD 秒）。cur＝移動光纖核心（µm，z＝間距）；db＝最近一次量到的功率
export const ZT = { T1, T2, T3, T4, HOLD, run: RUN };
export function zState(run, t) {
  const { L, P, ev } = run;
  let stage = t < T1 ? 1 : t < T1 + T2 ? 2 : 3, tn = 0, k = 0, cur = null, ip = 0, done = false, hold = -1;
  if (stage === 3) {
    const r = RUN.total / T3; let tau = t - T1 - T2;
    for (let i = 0; i < 2 && hold < 0; i++) { const d = ev.holds[i] / r; if (tau >= d) { if (tau < d + HOLD) hold = i; else tau -= HOLD; } }
    tn = hold >= 0 ? ev.holds[hold] : RUN.total * Math.min(tau / T3, 1); done = hold < 0 && tau > T3;
    k = last(L, tn); ip = last(P, tn);
    const a = P[ip], b = P[ip + 1];
    cur = b && b.lerp ? (() => { const u = (tn - a.t) / (b.t - a.t || 1); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u }; })() : { x: a.x, y: a.y, z: a.z };
  }
  const ph = stage === 3 ? L[k].ph : 0;
  let db = null; if (stage === 3) for (let i = k; i >= 0; i--) if (L[i].db !== null) { db = L[i].db; break; }
  return { stage, tn, k, cur, ip, done, hold, ph, db };
}

// 畫面：照影片 1600×900 的版面，等比縮放置中
export function drawZ(g, run, t) {
  const { ctx, w: W, h: H } = g; if (!W) return;
  const VW = 1600, VH = 900, sc = Math.min(W / VW, H / VH);
  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate((W - VW * sc) / 2, (H - VH * sc) / 2); ctx.scale(sc, sc);
  const bg = ctx.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#0b1424'); bg.addColorStop(1, '#060b16'); ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);
  const FN = 'system-ui, "Microsoft JhengHei", sans-serif', pt = (s, b) => `${b ? 700 : 400} ${s * 1.333}px ${FN}`;
  const INK = C.ink, { L, P, ev } = run, w0 = RUN.w0, cx = RUN.cx, cy = RUN.cy, standoff = RUN.standoff;
  const { stage, tn, k, cur, ip, done, hold, ph } = zState(run, t);
  // ---- 座標軸工具（MATLAB 的 Position 是 [左 下 寬 高]，正規化）----
  const axes = (pos, xl, yl, square) => {
    let x = pos[0] * VW, y = VH - (pos[1] + pos[3]) * VH, w = pos[2] * VW, h = pos[3] * VH;
    if (square) { const s = Math.min(w, h); x += (w - s) / 2; y += (h - s) / 2; w = h = s; }
    return { x, y, w, h, X: (v) => x + ((v - xl[0]) / (xl[1] - xl[0])) * w, Y: (v) => y + h - ((v - yl[0]) / (yl[1] - yl[0])) * h };
  };
  const frame = (A, xt, yt, grid, title, xlabel) => {
    ctx.lineWidth = 1; ctx.fillStyle = C.panel; ctx.fillRect(A.x, A.y, A.w, A.h);
    if (grid) { ctx.strokeStyle = C.grid; ctx.beginPath(); for (const v of xt) { ctx.moveTo(A.X(v), A.y); ctx.lineTo(A.X(v), A.y + A.h); } for (const v of yt) { ctx.moveTo(A.x, A.Y(v)); ctx.lineTo(A.x + A.w, A.Y(v)); } ctx.stroke(); }
    ctx.strokeStyle = C.edge; ctx.strokeRect(A.x, A.y, A.w, A.h);
    ctx.fillStyle = C.muted; ctx.font = pt(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of xt) { ctx.beginPath(); ctx.moveTo(A.X(v), A.y + A.h); ctx.lineTo(A.X(v), A.y + A.h - 6); ctx.stroke(); ctx.fillText(String(v), A.X(v), A.y + A.h + 5); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of yt) { ctx.beginPath(); ctx.moveTo(A.x, A.Y(v)); ctx.lineTo(A.x + 6, A.Y(v)); ctx.stroke(); ctx.fillText(String(v), A.x - 6, A.Y(v)); }
    ctx.fillStyle = '#fff'; ctx.font = pt(13, true); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(title, A.x + A.w / 2, A.y - 6);
    if (xlabel) { ctx.fillStyle = C.muted; ctx.font = pt(11); ctx.textBaseline = 'top'; ctx.fillText(xlabel, A.x + A.w / 2, A.y + A.h + 26); }
  };
  const text = (A, x, y, s, size, color, bold) => { ctx.font = pt(size, bold); ctx.fillStyle = color || INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, A.X(x), A.Y(y)); };
  const circle = (A, x, y, fill, edge) => { ctx.beginPath(); ctx.ellipse(A.X(x), A.Y(y), A.X(x + w0) - A.X(x), A.Y(y) - A.Y(y + w0), 0, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); };
  const rect = (A, x, y, w, h, fill, edge, dash) => { const px = A.X(x), py = A.Y(y + h), pw = A.X(x + w) - px, ph2 = A.Y(y) - py; ctx.setLineDash(dash ? [8, 6] : []); if (fill) { ctx.fillStyle = fill; ctx.fillRect(px, py, pw, ph2); } ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, ph2); ctx.setLineDash([]); };
  // ---- 上視 ----
  const ticks = (a, b, s) => { const r = []; for (let v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) r.push(v); return r; };
  const A1 = axes([0.04, 0.07, 0.42, 0.72], [-62, 62], [-62, 62], true);
  frame(A1, ticks(-62, 62, 20), ticks(-62, 62, 20), true, '從上面看：兩根光纖的核心（圓）要重疊才有光');
  ctx.save(); ctx.beginPath(); ctx.rect(A1.x, A1.y, A1.w, A1.h); ctx.clip();
  rect(A1, -40, -40, 80, 80, null, C.box, true);
  circle(A1, cx, cy, C.fixF, C.fixE);
  if (stage === 3) {                                                   // 軌跡
    ctx.strokeStyle = C.trail; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(A1.X(P[0].x), A1.Y(P[0].y));
    for (let i = 1; i <= ip; i++) ctx.lineTo(A1.X(P[i].x), A1.Y(P[i].y));
    ctx.lineTo(A1.X(cur.x), A1.Y(cur.y)); ctx.stroke();
  }
  if (stage >= 2) { const m = stage === 3 ? cur : { x: 0, y: 0 }; circle(A1, m.x, m.y, C.mvF, C.mvE); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(A1.X(m.x), A1.Y(m.y), 3, 0, 7); ctx.fill(); }
  ctx.restore();
  text(A1, -60, -58, '藍虛線：相機對位後的誤差範圍 ±40 µm', 10, C.box);
  text(A1, cx + 7, cy - 9, '固定光纖核心', 11, C.fixE);
  text(A1, -60, 56, '藍圓 = 移動光纖核心', 11, C.mvE);
  const off = stage === 2 ? `核心偏差 ${Math.hypot(cx, cy).toFixed(0)} µm（相機看不出來這麼細）` : stage === 3 ? `核心偏差 ${Math.hypot(cur.x - cx, cur.y - cy).toFixed(1)} µm` : '';
  text(A1, -60, 50, off, 11);
  // ---- 側視 ----
  const A2 = axes([0.52, 0.40, 0.45, 0.38], [-90, 190], [-22, 22]);
  frame(A2, ticks(-90, 190, 50), [], false, '從側面看：兩根光纖端面之間的距離（間距）', '← 往固定光纖靠近');
  ctx.save(); ctx.beginPath(); ctx.rect(A2.x, A2.y, A2.w, A2.h); ctx.clip();
  rect(A2, -90, -9, 90, 18, C.fiber, C.fixE);
  text(A2, -85, 0, '固定光纖', 11, '#fff');
  ctx.strokeStyle = C.target; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(A2.X(10), A2.Y(-18)); ctx.lineTo(A2.X(10), A2.Y(18)); ctx.stroke();
  text(A2, 12, 16, '目標 10 µm', 11, C.target);
  if (stage >= 2) { rect(A2, standoff, -9, 100, 18, null, C.ghost, true); text(A2, standoff + 2, -14, '相機以為在這', 10, C.ghost); }
  const gMv = stage === 1 ? 190 - (190 - RUN.gTrue0) * Math.min(t / (70 / 30), 1) : stage === 2 ? RUN.gTrue0 : cur.z;
  rect(A2, gMv, -9, 100, 18, C.mvE, '#9fc8ff');
  ctx.restore();
  const gapTxt = stage === 2 ? `實際間距 ${RUN.gTrue0.toFixed(0)} µm` : stage === 3 ? `實際間距 ${cur.z.toFixed(1)} µm` : '';
  text(A2, 0, -19, gapTxt, 13, INK, true);
  // ---- 功率 ----
  const A3 = axes([0.52, 0.10, 0.45, 0.20], [-50, 0], [0, 1]);
  frame(A3, ticks(-50, 0, 5), [], false, '收到的光功率（越右邊越亮）', 'dB');
  let db = null; if (stage === 3) for (let i = k; i >= 0; i--) if (L[i].db !== null) { db = L[i].db; break; }
  if (db !== null) { const x0 = A3.X(-50), x1 = A3.X(Math.max(db, -50)), gr = ctx.createLinearGradient(x0, 0, A3.X(0), 0); gr.addColorStop(0, '#c2410c'); gr.addColorStop(1, C.accent); ctx.fillStyle = gr; ctx.fillRect(x0, A3.Y(0.9), x1 - x0, A3.Y(0.1) - A3.Y(0.9)); }
  text(A3, -48, 0.5, stage === 2 ? '（還沒有光）' : db !== null ? `${db.toFixed(1)} dB` : '', 16, '#fff', true);
  // ---- 字幕 ----
  let cap;
  if (stage === 1) cap = ['階段一：粗動滑軌把移動光纖送到相機看得到的地方', '（這時沒有光訊號，只是大概移過來）'];
  else if (stage === 2) cap = ['階段二：相機看兩根光纖，把位置對到「誤差」XY ±40 µm、間距 ±50 µm 以內', `為了不撞到，先停在相機認為的 ${standoff} µm（實際是 ${RUN.gTrue0.toFixed(0)} µm，只是演算法不知道）`];
  else if (done) cap = [`完成：間距誤差 ${RUN.gapErr >= 0 ? '+' : ''}${RUN.gapErr.toFixed(2)} µm，核心偏差 ${RUN.xyRes.toFixed(2)} µm，全程 ${RUN.total.toFixed(1)} 秒`, '（光功率已接近最大值）'];
  else if (ph === 1) cap = ['3.1 還沒看到光。移動光纖在 XY 平面畫螺旋，一邊走一邊看光功率，直到出現光'];
  else if (ph === 2) cap = ['3.2 有光了。繞小圈量光強度，往比較亮的方向走，直到兩個核心重疊'];
  else if (ph === 3) cap = [L[k].zc > ev.z1 + 1 ? '3.3（續）退後 30 µm，再繞小圈、大圈各一次。光斑變寬多少，就能反推出現在離固定光纖多遠' : '3.3 量間距：繞一個小圈、一個大圈，比較兩圈的平均亮度差，就知道光斑有多寬（離得越遠，光斑越寬）'];
  else if (ph === 4) { const e = ev.est.filter((r) => r[0] <= tn), gh = e.length ? e[e.length - 1][1] : standoff; cap = [`3.4 算出間距約 ${gh.toFixed(0)} µm（相機以為 ${standoff} µm）。每次前進 5 µm，每 4 步（約 20 µm）重新對齊一次核心`]; }
  else cap = ['3.5 到了目標 10 µm，最後再微調核心對齊'];
  ctx.font = pt(20); ctx.fillStyle = done ? C.target : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = []; for (const s of cap) { let l = ''; for (const ch of s) { if (ctx.measureText(l + ch).width > 0.94 * VW - 20) { lines.push(l); l = ''; } l += ch; } lines.push(l); }
  const lh = 20 * 1.333 * 1.25, cy0 = VH - (0.84 + 0.075) * VH;
  lines.forEach((s, i) => ctx.fillText(s, VW / 2, cy0 + (i - (lines.length - 1) / 2) * lh));
  // ---- 停頓時的提示（上視圖上方）----
  if (hold >= 0) {
    const msg = hold === 0 ? '找到 First Light！' : '找到第一個平面的峰值：核心對準 XY';
    ctx.font = pt(20, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mx = A1.x + A1.w / 2, my = A1.y + A1.h * 0.14, tw = ctx.measureText(msg).width + 56;
    ctx.fillStyle = 'rgba(255,184,107,.94)'; ctx.beginPath(); ctx.roundRect(mx - tw / 2, my - 34, tw, 68, 34); ctx.fill();
    ctx.fillStyle = '#1a1206'; ctx.fillText(msg, mx, my);
  }
  ctx.restore();
  return { ph: stage === 3 ? ph - 1 : -1, st: tn };
}
