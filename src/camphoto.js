// 上視／側視相機的「照片」（示意，依當下姿態即時畫）：暗場風格，比照 ML_vision_sim/render_corrected_photos.py 的 (c)(d)。
// 水平軸＝光軸（晶片端面固定在畫面 62% 處，光纖從左邊來）；垂直軸＝X（上視）或 Y（側視），往上為正。單位 µm。
// kind：'sm'＝單根透鏡光纖，'fa'＝8 通道光纖陣列（127 µm 間距，玻璃塊 1700 µm 寬、基板 1000＋蓋板 500 µm）。
const grainCache = new Map();
function grain(w, h) {
  const key = w + 'x' + h; if (grainCache.has(key)) return grainCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), im = x.createImageData(w, h);
  for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 70; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); grainCache.set(key, c); return c;
}

// opts：{ view:'top'|'side', kind, pose:{dx,dy,gap,tx,ty,tz}, fov（µm，畫面寬）, ml:{u,v,label}|null, flash:0–1, title }
export function drawCamPhoto(g, opts) {
  const { ctx, w: W, h: H } = g; if (!W) return;
  const { view, kind = 'sm', pose, fov = 1400 } = opts;
  const s = W / fov, fx = W * 0.62, top = view === 'top';
  const lat = top ? pose.dx : pose.dy, ang = top ? pose.tx : pose.ty;
  ctx.save(); ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, W, H);
  ctx.translate(fx, H / 2); ctx.scale(s, -s);
  const px = 1 / s;
  // ---- 晶片 ----
  if (top) {
    ctx.fillStyle = '#5f6b5d'; ctx.fillRect(0, -4000, 4000, 8000);
    ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let v = -3000; v < 3000; v += 37) ctx.fillRect(0, v, 4000, 0.4 * px);
    ctx.strokeStyle = 'rgba(230,240,255,.55)'; ctx.lineWidth = 1.5 * px; ctx.beginPath(); ctx.moveTo(0, -4000); ctx.lineTo(0, 4000); ctx.stroke();
    const wgs = kind === 'fa' ? Array.from({ length: 8 }, (_, k) => (k - 3.5) * 127) : [0];
    for (const v of wgs) {
      ctx.strokeStyle = 'rgba(25,30,45,.9)'; ctx.lineWidth = 2.2 * px; ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(4000, v); ctx.stroke();
      ctx.fillStyle = 'rgba(70,80,120,.95)'; ctx.fillRect(0, v - 3, 60, 6);                  // SSC 段
    }
    ctx.fillStyle = '#c9a54a'; for (const v of kind === 'fa' ? [-760, -620, 620, 760] : [-380, 380]) ctx.fillRect(330, v - 40, 80, 80);   // 金屬墊
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3 * px; for (const v of [-560, 560]) { ctx.beginPath(); ctx.moveTo(120, v - 22); ctx.lineTo(120, v + 22); ctx.moveTo(98, v); ctx.lineTo(142, v); ctx.stroke(); }
  } else {
    const gr = ctx.createLinearGradient(0, -725, 0, 8); gr.addColorStop(0, '#2c2f36'); gr.addColorStop(1, '#6d7380');
    ctx.fillStyle = gr; ctx.fillRect(0, -725, 4000, 733);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let v = -720; v < 0; v += 11) ctx.fillRect(0, v, 4000, 0.6 * px);
    ctx.fillStyle = 'rgba(160,190,230,.55)'; ctx.fillRect(0, -3, 4000, 11);                    // BOX＋包層
    ctx.fillStyle = 'rgba(255,140,60,.9)'; ctx.fillRect(0, -0.8, 60, 1.6 + 1.5 * px);          // 波導位置
  }
  // ---- 光纖（或陣列）----
  ctx.save(); ctx.translate(-pose.gap, lat); ctx.rotate(ang);
  const edge = (y0, y1, x0, x1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  if (kind === 'sm') {
    // 透鏡光纖：125 µm 本體 → 170 µm 錐 → 半徑 22 µm 的圓頂
    ctx.beginPath(); ctx.moveTo(-6000, 62.5); ctx.lineTo(-170, 62.5); ctx.quadraticCurveTo(-60, 30, -14, 22); ctx.arc(-22, 0, 22, Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35, true);
    ctx.quadraticCurveTo(-60, -30, -170, -62.5); ctx.lineTo(-6000, -62.5); ctx.closePath();
    ctx.fillStyle = 'rgba(60,72,90,.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(225,235,250,.9)'; ctx.lineWidth = 1.4 * px; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,215,240,.35)'; ctx.lineWidth = 0.8 * px; edge(4.5, 4.5, -6000, -40); edge(-4.5, -4.5, -6000, -40);
    // V 型槽夾具（左側遠處）
    ctx.fillStyle = '#3a3e45'; ctx.fillRect(-6000, -500, 6000 - 900, 1000);
    ctx.fillStyle = '#050608'; ctx.fillRect(-6000, -70, 6000 - 900, 140);
    ctx.fillStyle = 'rgba(60,72,90,.55)'; ctx.fillRect(-6000, -62.5, 6000 - 900, 125);
  } else if (top) {
    ctx.fillStyle = 'rgba(120,150,160,.55)'; ctx.fillRect(-4000, -850, 4000, 1700);
    ctx.strokeStyle = 'rgba(225,240,250,.85)'; ctx.lineWidth = 1.4 * px; ctx.strokeRect(-4000, -850, 4000, 1700);
    for (let k = 0; k < 8; k++) { const v = (k - 3.5) * 127; ctx.strokeStyle = 'rgba(225,240,250,.6)'; ctx.lineWidth = 0.9 * px; edge(v + 62.5, v + 62.5, -4000, 0); edge(v - 62.5, v - 62.5, -4000, 0); ctx.strokeStyle = 'rgba(255,190,90,.5)'; edge(v, v, -4000, 0); }
  } else {
    ctx.fillStyle = 'rgba(70,85,95,.75)'; ctx.fillRect(-4000, -1000, 4000, 1000); ctx.fillStyle = 'rgba(95,115,125,.6)'; ctx.fillRect(-4000, 0, 4000, 500);
    ctx.strokeStyle = 'rgba(225,240,250,.85)'; ctx.lineWidth = 1.4 * px; ctx.strokeRect(-4000, -1000, 4000, 1500); edge(0, 0, -4000, 0);
    ctx.strokeStyle = 'rgba(255,190,90,.9)'; ctx.lineWidth = 2 * px; edge(0, 0, -4000, 0);
  }
  ctx.restore();
  ctx.restore();
  // ---- 顆粒、暗角 ----
  ctx.save(); ctx.globalAlpha = 0.08; ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grain(Math.round(W), Math.round(H)), 0, 0); ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // ---- ML 標記：估計的尖端位置 ----
  if (opts.ml) {
    const u = fx + opts.ml.u * s, v = H / 2 - opts.ml.v * s;
    ctx.strokeStyle = '#5fd4ff'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(u, v, 14, 0, 7); ctx.moveTo(u - 24, v); ctx.lineTo(u + 24, v); ctx.moveTo(u, v - 24); ctx.lineTo(u, v + 24); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '600 12.5px system-ui, "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(opts.ml.label).width + 12, lx = Math.min(W - tw - 6, u + 20), ly = Math.max(22, v - 18);
    ctx.fillStyle = 'rgba(5,20,35,.85)'; ctx.fillRect(lx, ly - 18, tw, 20); ctx.fillStyle = '#5fd4ff'; ctx.fillText(opts.ml.label, lx + 6, ly);
  }
  // ---- 比例尺、標題 ----
  const bar = fov > 1800 ? 500 : 200, bw = bar * s;
  ctx.fillStyle = '#fff'; ctx.fillRect(W - bw - 14, H - 18, bw, 3); ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`${bar} µm`, W - bw / 2 - 14, H - 21);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '700 13px system-ui, "Microsoft JhengHei", sans-serif'; ctx.fillStyle = 'rgba(5,10,20,.75)';
  const t = opts.title || (top ? '上視相機' : '側視相機'); ctx.fillRect(6, 6, ctx.measureText(t).width + 14, 21); ctx.fillStyle = '#e6eefc'; ctx.fillText(t, 13, 10);
  if (opts.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * opts.flash})`; ctx.fillRect(0, 0, W, H); }
}
