// Presentation renderer for 2-3's lensed-fiber experiment.
// Coordinates and radii use the same paraxial model as physics.js. Animated
// wavefronts convey propagation only; they never modulate the measured eta.
import { beamAt } from './physics.js';

const TAU = Math.PI * 2;
function background(ctx, w, h) {
  const g = ctx.createRadialGradient(w * .56, h * .45, 0, w * .56, h * .45, w * .8);
  g.addColorStop(0, '#132b40'); g.addColorStop(.55, '#0b192b'); g.addColorStop(1, '#060e1a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function scaleBar(ctx, x, y, pixels, microns) {
  ctx.strokeStyle = '#d6e7ef'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y); ctx.lineTo(x + pixels, y); ctx.lineTo(x + pixels, y - 3); ctx.stroke();
  ctx.fillStyle = '#bed2df'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(`${microns} µm`, x, y - 6);
}
function step(span) {
  const raw = span / 6, p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(n => n * p).find(n => n >= raw) || raw;
}

const sideFrames = new WeakMap();
export function drawOpticalSide(g, p, pose, o) {
  const { ctx, w: W, h: H } = g; if (!W || !H) return;
  const key = JSON.stringify([p, pose, o.zmin, o.zmax, o.xhw, o.eta, W, H, g.canvas.width, g.canvas.height]);
  let cached = sideFrames.get(g.canvas);
  if (!cached || cached.key !== key) {
    const canvas = cached?.canvas || document.createElement('canvas');
    canvas.width = g.canvas.width; canvas.height = g.canvas.height;
    const paint = canvas.getContext('2d'); paint.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    paintOpticalSide({ ...g, ctx: paint }, p, pose, o);
    cached = { key, canvas }; sideFrames.set(g.canvas, cached);
  }
  ctx.drawImage(cached.canvas, 0, 0, W, H);
  if (!o.flow) return;
  const span = o.zmax - o.zmin, sc = Math.min(W / span, H / (2 * o.xhw));
  const left = (W - span * sc) / 2, X = z => left + (z - o.zmin) * sc, Y = x => H / 2 - x * sc;
  ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, X(-pose.gap)), 0, Math.max(0, X(0) - Math.max(0, X(-pose.gap))), H); ctx.clip();
  for (let i = 0; i < 8; i++) {
    const t = (i / 8 + o.time * .17) % 1, u = t * pose.gap, x = X(-pose.gap + u), y = Y(pose.dx + u * pose.tx), r = beamAt(p, u - p.WD).w * sc * .85;
    ctx.strokeStyle = `rgba(255,225,175,${.22 * Math.sin(Math.PI * t)})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 3, y - r); ctx.quadraticCurveTo(x + 5, y, x - 3, y + r); ctx.stroke();
  }
  ctx.restore();
}

function paintOpticalSide(g, p, pose, o) {
  const { ctx, w: W, h: H } = g; if (!W || !H) return;
  const span = o.zmax - o.zmin, sc = Math.min(W / span, H / (2 * o.xhw));
  const left = (W - span * sc) / 2, X = z => left + (z - o.zmin) * sc, Y = x => H / 2 - x * sc;
  const fx = X(0), tip = X(-pose.gap), cy = Y(pose.dx), glow = Math.sqrt(Math.max(0, o.eta));
  background(ctx, W, H);

  // Quiet stage reference, not extra optical data.
  ctx.strokeStyle = '#698aa318'; ctx.lineWidth = 1;
  for (let y = 24; y < H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.setLineDash([4, 7]); ctx.strokeStyle = '#b4d9e729';
  ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(fx, Y(0)); ctx.stroke(); ctx.setLineDash([]);

  // Polished chip facet and a luminous SSC section. The blue band is ±wgx.
  const chip = ctx.createLinearGradient(fx, 0, W, H);
  chip.addColorStop(0, '#3a5269'); chip.addColorStop(.15, '#21394f'); chip.addColorStop(1, '#111f32');
  ctx.fillStyle = chip; ctx.fillRect(fx, 0, W - fx, H);
  ctx.fillStyle = '#9bcbe614'; ctx.fillRect(fx, Y(p.wgx + 3), W - fx, (2 * p.wgx + 6) * sc);
  ctx.strokeStyle = '#9abdd093'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H); ctx.stroke();
  const wg = ctx.createLinearGradient(0, Y(p.wgx), 0, Y(-p.wgx));
  wg.addColorStop(0, '#318cb533'); wg.addColorStop(.5, '#83dcf288'); wg.addColorStop(1, '#318cb533');
  ctx.fillStyle = wg; ctx.fillRect(fx, Y(p.wgx), W - fx, 2 * p.wgx * sc);
  ctx.strokeStyle = '#73c5e294'; ctx.lineWidth = 1; ctx.strokeRect(fx, Y(p.wgx), W - fx, 2 * p.wgx * sc);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const guided = ctx.createLinearGradient(0, Y(p.wgx), 0, Y(-p.wgx));
  guided.addColorStop(0, 'rgba(255,184,105,0)'); guided.addColorStop(.5, `rgba(255,224,174,${.78 * glow})`); guided.addColorStop(1, 'rgba(255,184,105,0)');
  ctx.fillStyle = guided; ctx.fillRect(fx, Y(p.wgx), W - fx, 2 * p.wgx * sc); ctx.restore();

  // Gaussian intensity: exact w(z) and center x(z), same units. A cached
  // texture avoids both visible layer bands and re-rasterizing every frame.
  const samples = Array.from({ length: 81 }, (_, i) => {
    const u = pose.gap * i / 80;
    return { x: X(-pose.gap + u), y: Y(pose.dx + u * pose.tx), r: beamAt(p, u - p.WD).w * sc };
  });
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, fx), H); ctx.clip();
  const texture = document.createElement('canvas'); texture.width = Math.ceil(W / 2); texture.height = Math.ceil(H / 2);
  const tc = texture.getContext('2d'), pixels = tc.createImageData(texture.width, texture.height);
  for (let x = 0; x < texture.width; x++) {
    const z = o.zmin + (x * W / texture.width - left) / sc, u = z + pose.gap;
    if (u < 0 || u > pose.gap) continue;
    const center = Y(pose.dx + u * pose.tx), radius = beamAt(p, u - p.WD).w * sc;
    for (let y = 0; y < texture.height; y++) {
      const q = (y * H / texture.height - center) / radius, k = (y * texture.width + x) * 4;
      pixels.data[k] = 255; pixels.data[k + 1] = 208; pixels.data[k + 2] = 137; pixels.data[k + 3] = 190 * Math.exp(-2 * q * q);
    }
  }
  tc.putImageData(pixels, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(texture, 0, 0, W, H);
  // Thin 1/e² envelope is a spatial reference; flow marks stay inside it.
  ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#f0bc765c'; ctx.lineWidth = 1;
  for (const sign of [-1, 1]) { ctx.beginPath(); samples.forEach((q, i) => i ? ctx.lineTo(q.x, q.y + sign * q.r) : ctx.moveTo(q.x, q.y + sign * q.r)); ctx.stroke(); }
  ctx.restore();

  // Smooth glass section; the outer silhouette is illustrative, while the
  // aperture location, beam width, focus and scale bar remain in microns.
  ctx.save(); ctx.translate(tip, cy); ctx.rotate(-Math.atan(pose.tx));
  const nose = beamAt(p, -p.WD).w * sc * 1.12, body = Math.max(nose * 1.4, 19 * sc), taper = 34 * sc;
  const path = new Path2D();
  path.moveTo(-W * 2, -body); path.lineTo(-taper, -body);
  path.bezierCurveTo(-taper * .48, -body, -taper * .32, -nose, -nose * .25, -nose);
  path.bezierCurveTo(nose * .1, -nose * .65, nose * .1, nose * .65, -nose * .25, nose);
  path.bezierCurveTo(-taper * .32, nose, -taper * .48, body, -taper, body);
  path.lineTo(-W * 2, body); path.closePath();
  const glass = ctx.createLinearGradient(0, -body, 0, body);
  glass.addColorStop(0, '#bddde960'); glass.addColorStop(.2, '#678da52a'); glass.addColorStop(.42, '#d8f5ff48'); glass.addColorStop(.54, '#8fb6cf17'); glass.addColorStop(1, '#6c99b94d');
  ctx.fillStyle = glass; ctx.fill(path); ctx.strokeStyle = '#c6e6f39c'; ctx.lineWidth = 1.3; ctx.stroke(path);
  ctx.save(); ctx.clip(path);
  const core = ctx.createLinearGradient(0, -3 * sc, 0, 3 * sc);
  core.addColorStop(0, '#f6bc6900'); core.addColorStop(.5, '#fff1c6ba'); core.addColorStop(1, '#f6bc6900');
  ctx.fillStyle = core; ctx.fillRect(-W * 2, -3 * sc, W * 2, 6 * sc);
  ctx.strokeStyle = '#e1f4ff62'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-W * 2, -body * .55); ctx.lineTo(-taper, -body * .55); ctx.bezierCurveTo(-taper * .4, -body * .55, -nose, -nose * .5, -nose * .16, -nose * .5); ctx.stroke();
  ctx.restore(); ctx.restore();

  // Focus marker and facet hit retain their geometric meanings.
  const wx = X(-pose.gap + p.WD), wy = Y(pose.dx + p.WD * pose.tx);
  if (wx > 10 && wx < W - 10) {
    ctx.strokeStyle = '#e1edf49c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx, wy - 12); ctx.lineTo(wx, wy + 12); ctx.stroke();
    ctx.fillStyle = '#fff2d1'; ctx.beginPath(); ctx.arc(wx, wy, 3, 0, TAU); ctx.fill();
  }
  const hit = pose.dx + pose.gap * pose.tx, rw = beamAt(p, pose.gap - p.WD).w;
  ctx.strokeStyle = '#f1bd7f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx - 1, Y(hit + rw)); ctx.lineTo(fx - 1, Y(hit - rw)); ctx.stroke();
  const lo = Math.max(hit - rw, -p.wgx), hi = Math.min(hit + rw, p.wgx);
  if (hi > lo) { ctx.strokeStyle = '#9fe5cc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx + 2, Y(hi)); ctx.lineTo(fx + 2, Y(lo)); ctx.stroke(); }
  scaleBar(ctx, 18, H - 18, step(span * .4) * sc, step(span * .4));
}

export function drawOpticalFacet(g, p, pose, o) {
  const { ctx, w: W, h: H } = g; if (!W || !H) return;
  const sc = Math.min(W, H) / (2 * o.hw), X = x => W / 2 + x * sc, Y = y => H / 2 - y * sc;
  background(ctx, W, H);
  const st = step(o.hw * 2);
  ctx.strokeStyle = '#7798b11c'; ctx.lineWidth = 1;
  for (let v = -Math.floor(o.hw / st) * st; v <= o.hw; v += st) {
    ctx.beginPath(); ctx.moveTo(X(v), 0); ctx.lineTo(X(v), H); ctx.moveTo(0, Y(v)); ctx.lineTo(W, Y(v)); ctx.stroke();
  }
  ctx.strokeStyle = '#a8ccdc40'; ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); ctx.setLineDash([]);
  // Gaussian intensity gradients sampled as exp(-2r²/w²). Both contours are w.
  const gaussian = (x, y, rx, ry, rgb) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.8);
    for (let i = 0; i <= 18; i++) { const r = i / 10; grad.addColorStop(r / 1.8, `rgba(${rgb},${.72 * Math.exp(-2 * r * r)})`); }
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, TAU); ctx.fill(); ctx.restore();
  };
  gaussian(X(0), Y(0), p.wgx * sc, p.wgy * sc, '55,162,224');
  const { w } = beamAt(p, pose.gap - p.WD), cx = pose.dx + pose.gap * pose.tx, cy = pose.dy + pose.gap * pose.ty;
  gaussian(X(cx), Y(cy), w * sc, w * sc, '255,184,102');
  ctx.strokeStyle = '#74cce9'; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.ellipse(X(0), Y(0), p.wgx * sc, p.wgy * sc, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#edc18d'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(X(cx), Y(cy), w * sc, 0, TAU); ctx.stroke();
  for (const [x, y, color] of [[X(0), Y(0), '#9ddff0'], [X(cx), Y(cy), '#ffe3b4']]) {
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
  }
  scaleBar(ctx, 18, H - 18, st * sc, st);
  ctx.font = '12px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#a0b9cc';
  ctx.fillText('輪廓：1/e² 光強度', W - 16, H - 16);
}
