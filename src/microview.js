// 微觀視圖：側視（Z 向右、X 向上）與端面視（X、Y）。長度單位 µm，傾角 rad。
// g 是 fitCanvas 回傳物件；p 是光學參數（physics.js）；pose={dx,dy,gap,tx,ty}。
import { beamAt, eta } from './physics.js';

// 深色「顯微鏡」配色：光束用加色混合發光
const C = {
  ink: '#e8eefb', muted: '#93a6c6', line: 'rgba(140,170,230,.16)', chip: '#18202f', chipDark: '#5d7aa6',
  glass: '#e9edf3', glassEdge: 'rgba(190,215,255,.75)', beam: '#ff8a3d', wg: '#38bdf8', ok: '#69db7c',
};
function bg(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1424'); g.addColorStop(1, '#060b16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function niceStep(span) {
  const raw = span / 6, pow = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 5, 10].map((f) => f * pow).find((s) => s >= raw) || raw;
}
const fmtUm = (v) => (v >= 1000 ? `${v / 1000} mm` : v >= 1 ? `${+v.toFixed(2)} µm` : `${+(v * 1000).toFixed(1)} nm`);

// ---- 側視圖 -------------------------------------------------------------
// o：{zmin, zmax, xhw, lens(bool), eta, labels(bool)}
export function drawSide(g, p, pose, o) {
  const { ctx, w: W, h: H } = g;
  ctx.clearRect(0, 0, W, H);
  const zspan = o.zmax - o.zmin;
  const sc = Math.min(W / zspan, H / (2 * o.xhw));
  const x0 = (W - zspan * sc) / 2;
  const PX = (z) => x0 + (z - o.zmin) * sc;
  const PY = (x) => H / 2 - x * sc;
  const eta0 = o.eta ?? eta(p, pose);
  bg(ctx, W, H);

  // 晶片與端面
  const fx = PX(0);
  { const cg = ctx.createLinearGradient(fx, 0, W, 0); cg.addColorStop(0, '#1f2a3d'); cg.addColorStop(1, '#141b28'); ctx.fillStyle = cg; ctx.fillRect(fx, 0, W - fx, H); }
  // 質感：波導周圍的氧化矽包層略亮偏藍、外側是矽（深灰帶拋光細紋）；端面是拋光面，邊緣一道亮線
  { const ct = PY(p.wgx + 4), cb = PY(-p.wgx - 3);
    const og = ctx.createLinearGradient(0, ct, 0, cb); og.addColorStop(0, 'rgba(150,180,230,.10)'); og.addColorStop(0.5, 'rgba(150,180,230,.17)'); og.addColorStop(1, 'rgba(150,180,230,.10)');
    ctx.fillStyle = og; ctx.fillRect(fx, ct, W - fx, cb - ct);
    ctx.fillStyle = 'rgba(8,11,16,.35)'; ctx.fillRect(fx, 0, W - fx, Math.max(0, ct)); ctx.fillRect(fx, cb, W - fx, H - cb);
    ctx.strokeStyle = 'rgba(190,205,230,.05)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let y = 3; y < H; y += 7) if (y < ct || y > cb) { ctx.moveTo(fx, y); ctx.lineTo(W, y); }
    ctx.stroke(); }
  ctx.strokeStyle = C.chipDark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H); ctx.stroke();
  ctx.strokeStyle = 'rgba(205,220,245,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx + 1.5, 0); ctx.lineTo(fx + 1.5, H); ctx.stroke();
  // 波導模態帶（±場半徑）
  const wgTop = PY(p.wgx), wgBot = PY(-p.wgx);
  ctx.fillStyle = 'rgba(56,189,248,.16)'; ctx.fillRect(fx, wgTop, W - fx, wgBot - wgTop);
  const glow = Math.min(1, Math.sqrt(Math.max(eta0, 0)));
  ctx.save(); ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 24 * glow; ctx.fillStyle = `rgba(255,150,70,${0.06 + 0.7 * glow})`; ctx.fillRect(fx, wgTop, W - fx, wgBot - wgTop); ctx.restore();
  ctx.strokeStyle = C.wg; ctx.lineWidth = 1.5; ctx.strokeRect(fx, wgTop, W - fx, wgBot - wgTop);

  // 光束（沿光纖光軸）
  const th = pose.tx, cs = Math.cos(th), sn = Math.sin(th);
  const zt = -pose.gap, xt = pose.dx;                 // 光纖端面中心
  const uEnd = pose.gap / cs;
  const pts = [];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const u = (uEnd * i) / N;
    const { w } = beamAt(p, u - p.WD);
    const cz = zt + u * cs, cx = xt + u * sn;
    pts.push([cz - w * sn, cx + w * cs, cz + w * sn, cx - w * cs]);
  }
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(PX(q[0]), PY(q[1])) : ctx.moveTo(PX(q[0]), PY(q[1]))));
  for (let i = N; i >= 0; i--) ctx.lineTo(PX(pts[i][2]), PY(pts[i][3]));
  ctx.closePath(); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 18; ctx.fillStyle = 'rgba(255,110,30,.30)'; ctx.fill(); ctx.restore();
  // 內層較亮（0.6 w）
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = (uEnd * i) / N, { w } = beamAt(p, u - p.WD), ww = 0.6 * w;
    const cz = zt + u * cs, cx = xt + u * sn;
    const a = [PX(cz - ww * sn), PY(cx + ww * cs)]; i ? ctx.lineTo(a[0], a[1]) : ctx.moveTo(a[0], a[1]);
  }
  for (let i = N; i >= 0; i--) {
    const u = (uEnd * i) / N, { w } = beamAt(p, u - p.WD), ww = 0.6 * w;
    const cz = zt + u * cs, cx = xt + u * sn;
    ctx.lineTo(PX(cz + ww * sn), PY(cx - ww * cs));
  }
  ctx.closePath(); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,120,.55)'; ctx.fill(); ctx.restore();
  // 包絡線
  ctx.strokeStyle = C.beam; ctx.lineWidth = 1.5;
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(PX(q[0]), PY(q[1])) : ctx.moveTo(PX(q[0]), PY(q[1])))); ctx.stroke();
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(PX(q[2]), PY(q[3])) : ctx.moveTo(PX(q[2]), PY(q[3])))); ctx.stroke();
  // 光軸
  ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(232,89,12,.7)'; ctx.beginPath();
  ctx.moveTo(PX(zt), PY(xt)); ctx.lineTo(PX(zt + uEnd * cs), PY(xt + uEnd * sn)); ctx.stroke(); ctx.setLineDash([]);

  // 光纖本體（以端面中心為原點旋轉）
  ctx.save();
  ctx.translate(PX(zt), PY(xt)); ctx.rotate(-th);
  const lensTip = o.lens !== false && p.WD > 5;
  // 透鏡光纖：出光口要蓋住尖端的光束（光腰在 WD 外，往回推到尖端時 w 比焦點大很多），取 1.25 w(尖端)
  const wTip = beamAt(p, -p.WD).w, coreHalf = 2.6;
  const taperL = lensTip ? Math.min(90, p.WD * 3) : 0, tipHalf = lensTip ? 1.25 * wTip : 62.5, baseHalf = 62.5;
  const grad = ctx.createLinearGradient(0, -baseHalf * sc, 0, baseHalf * sc);
  grad.addColorStop(0, 'rgba(210,228,255,.30)'); grad.addColorStop(0.5, 'rgba(160,190,240,.14)'); grad.addColorStop(1, 'rgba(110,140,200,.26)');
  ctx.fillStyle = grad; ctx.strokeStyle = C.glassEdge; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -tipHalf * sc); ctx.lineTo(-taperL * sc, -baseHalf * sc); ctx.lineTo(-2000 * sc, -baseHalf * sc);
  ctx.lineTo(-2000 * sc, baseHalf * sc); ctx.lineTo(-taperL * sc, baseHalf * sc); ctx.lineTo(0, tipHalf * sc);
  if (lensTip) ctx.quadraticCurveTo(tipHalf * 0.9 * sc, 0, 0, -tipHalf * sc); else ctx.closePath();
  ctx.fill();
  // 玻璃圓柱的反光：上緣一道細亮線、下緣一道淡的（沿錐形段收到尖端）
  ctx.save(); ctx.clip();
  for (const [k, a, lw] of [[-0.62, 0.32, 2], [0.7, 0.12, 1.5]]) {
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = lw; ctx.beginPath();
    ctx.moveTo(-2000 * sc, k * baseHalf * sc); ctx.lineTo(-taperL * sc, k * baseHalf * sc); ctx.lineTo(0, k * tipHalf * sc); ctx.stroke();
  }
  ctx.restore();
  // 外框只描兩側（透鏡曲面不描邊）
  ctx.beginPath();
  ctx.moveTo(0, -tipHalf * sc); ctx.lineTo(-taperL * sc, -baseHalf * sc); ctx.lineTo(-2000 * sc, -baseHalf * sc);
  ctx.moveTo(0, tipHalf * sc); ctx.lineTo(-taperL * sc, baseHalf * sc); ctx.lineTo(-2000 * sc, baseHalf * sc);
  if (!lensTip) { ctx.moveTo(0, -tipHalf * sc); ctx.lineTo(0, tipHalf * sc); }
  ctx.stroke();
  // 纖芯；透鏡光纖在錐形段裡從纖芯擴到尖端的光束寬度
  ctx.fillStyle = 'rgba(255,140,60,.28)'; ctx.beginPath();
  ctx.moveTo(-2000 * sc, -coreHalf * sc); ctx.lineTo(-taperL * sc, -coreHalf * sc); ctx.lineTo(0, -(lensTip ? wTip : coreHalf) * sc);
  ctx.lineTo(0, (lensTip ? wTip : coreHalf) * sc); ctx.lineTo(-taperL * sc, coreHalf * sc); ctx.lineTo(-2000 * sc, coreHalf * sc); ctx.closePath(); ctx.fill();
  ctx.restore();

  // 光腰標記
  const sWaistZ = zt + p.WD * cs, sWaistX = xt + p.WD * sn;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(PX(sWaistZ), PY(sWaistX) - 16); ctx.lineTo(PX(sWaistZ), PY(sWaistX) + 16); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(PX(sWaistZ), PY(sWaistX), 3.5, 0, 7); ctx.fill();

  // 端面上的光點與重疊
  const atF = beamAt(p, pose.gap - p.WD);
  const cxF = pose.dx + pose.gap * pose.tx;
  ctx.strokeStyle = C.beam; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(fx - 1, PY(cxF + atF.w)); ctx.lineTo(fx - 1, PY(cxF - atF.w)); ctx.stroke();
  const lo = Math.max(cxF - atF.w, -p.wgx), hi = Math.min(cxF + atF.w, p.wgx);
  if (hi > lo) { ctx.strokeStyle = C.ok; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(fx + 3, PY(hi)); ctx.lineTo(fx + 3, PY(lo)); ctx.stroke(); }

  // 比例尺
  if (o.scale !== false) {
    const st = niceStep(zspan * 0.4);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, H - 16); ctx.lineTo(14 + st * sc, H - 16); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(fmtUm(st), 14, H - 20);
  }
  if (o.labels !== false) {
    ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.wg; ctx.textAlign = 'right'; ctx.fillText('PIC 晶片（波導模態＝藍色帶）', W - 10, 8);
    ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.fillText(lensTip ? '透鏡光纖' : '平切光纖', 10, 8);
    // 光腰標籤
    ctx.fillStyle = C.ink; ctx.textAlign = 'center';
    const lx = PX(sWaistZ), ly = PY(sWaistX) + 20;
    if (lx > 40 && lx < W - 40) ctx.fillText('光腰（焦點）', lx, Math.min(H - 40, ly));
  }
  return { PX, PY, sc };
}

// ---- 端面視圖 ------------------------------------------------------------
// o：{hw（視窗半寬 µm）, trail:[{x,y}], labels, ring}
export function drawFacet(g, p, pose, o) {
  const { ctx, w: W, h: H } = g;
  ctx.clearRect(0, 0, W, H);
  const hw = o.hw;
  const sc = Math.min(W, H) / (2 * hw);
  const PX = (x) => W / 2 + x * sc, PY = (y) => H / 2 - y * sc;
  bg(ctx, W, H);
  // 格線
  const st = niceStep(hw * 2);
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  for (let v = -Math.floor(hw / st) * st; v <= hw; v += st) {
    ctx.beginPath(); ctx.moveTo(PX(v), 0); ctx.lineTo(PX(v), H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, PY(v)); ctx.lineTo(W, PY(v)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(140,170,230,.4)'; ctx.beginPath(); ctx.moveTo(PX(0), 0); ctx.lineTo(PX(0), H); ctx.moveTo(0, PY(0)); ctx.lineTo(W, PY(0)); ctx.stroke();

  // 軌跡
  if (o.trail && o.trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
    o.trail.forEach((q, i) => (i ? ctx.lineTo(PX(q.x), PY(q.y)) : ctx.moveTo(PX(q.x), PY(q.y)))); ctx.stroke();
  }
  // 光點
  const { w } = beamAt(p, pose.gap - p.WD);
  const cx = pose.dx + pose.gap * pose.tx, cy = pose.dy + pose.gap * pose.ty;
  const grd = ctx.createRadialGradient(PX(cx), PY(cy), 0, PX(cx), PY(cy), Math.max(2, w * sc));
  grd.addColorStop(0, 'rgba(255,235,190,.95)'); grd.addColorStop(0.5, 'rgba(255,130,50,.55)'); grd.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(PX(cx), PY(cy), Math.max(2, w * sc), 0, 7); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = C.beam; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.beam; ctx.beginPath(); ctx.arc(PX(cx), PY(cy), 3, 0, 7); ctx.fill();
  // 波導模態（橢圓）
  ctx.strokeStyle = C.wg; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(56,189,248,.18)';
  ctx.beginPath(); ctx.ellipse(PX(0), PY(0), Math.max(1.5, p.wgx * sc), Math.max(1.5, p.wgy * sc), 0, 0, 7); ctx.fill(); ctx.stroke();

  // 比例尺與標籤
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, H - 14); ctx.lineTo(12 + st * sc, H - 14); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.font = '12px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(fmtUm(st), 12, H - 18);
  if (o.labels !== false) {
    ctx.textBaseline = 'top'; ctx.font = '13px system-ui, "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = C.wg; ctx.textAlign = 'left'; ctx.fillText('● 波導模態', 10, 8);
    ctx.fillStyle = C.beam; ctx.fillText('● 光纖光點（端面上）', 10, 26);
  }
  return { PX, PY, sc };
}

// 功率計：對數長條（−60…0 dB）
export function drawMeter(g, db, opts = {}) {
  const { ctx, w: W, h: H } = g;
  ctx.clearRect(0, 0, W, H);
  const lo = opts.lo ?? -60, hi = 0;
  const t = Math.max(0, Math.min(1, (db - lo) / (hi - lo)));
  const bx = 8, by = H / 2 - 9, bw = W - 16, bh = 18;
  ctx.fillStyle = '#e8ecf3'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.fill();
  const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grd.addColorStop(0, '#c92a2a'); grd.addColorStop(0.5, '#f0a030'); grd.addColorStop(1, '#2f9e44');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(2, bw * t), bh, 9); ctx.fill();
  ctx.fillStyle = '#5b6678'; ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  for (let v = lo; v <= hi; v += 10) { const x = bx + ((v - lo) / (hi - lo)) * bw; ctx.fillText(`${v}`, x, by + bh + 3); }
}
