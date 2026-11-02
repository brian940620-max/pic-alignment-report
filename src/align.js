// 精對位演示：螺旋找光（first light）→ 繞圈梯度（XY）＋三點拋物線（Z）→ 收斂。
// 用 physics.js 的耦合效率當「功率計」，加量測雜訊。這是示意版：原理同我們的繞圈梯度法
// （圓周取樣的一次諧波給梯度、已知模態寬度做一步到位的步長），但時間與步長是示意值，不是實機或正式模擬結果。
import { eta, beamAt, LAMBDA } from './physics.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clampv = (v, a, b) => Math.min(b, Math.max(a, v));

export const ALIGN_DEFAULTS = {
  seed: 7, noise: 0.02, floor: 1e-6, thresh: 3e-5,   // 乘性雜訊 2%、底噪 −60 dB、首光門檻 −45 dB
  speed: 3000,        // 螺旋掃描速度 µm/s
  sampleDt: 0.004,    // 圓周／探測每點時間 s
  pitchMax: 10, rMax: 60, minGap: 3,
};

export function planAlignment(p, start, optIn = {}) {
  const o = { ...ALIGN_DEFAULTS, ...optIn };
  const R = rng(o.seed);
  const randn = () => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const frames = [];
  const ev = {};
  let t = 0;
  const tx = start.tx || 0, ty = start.ty || 0;
  const meas = (x, y, z) => {
    const e = eta(p, { dx: x, dy: y, gap: z, tx, ty });
    const pm = Math.max(0, e * (1 + o.noise * randn()) + o.floor * Math.abs(randn()));
    return { e, pm };
  };
  const push = (x, y, z, phase, dt) => {
    t += dt; const m = meas(x, y, z);
    frames.push({ t, dx: x, dy: y, gap: z, eta: m.e, pm: m.pm, phase });
    return m;
  };

  // ---- 階段一：螺旋找光 ----
  const cx0 = start.dx, cy0 = start.dy, z0 = start.gap;
  const w0 = beamAt(p, z0 - p.WD).w;
  const pitch = clampv(0.7 * w0, 1.5, o.pitchMax);
  const b = pitch / (2 * Math.PI);
  let phi = 0.5, found = false;
  const ds = Math.max(0.4, pitch / 6);
  push(cx0, cy0, z0, 'spiral', 0);
  while (!found) {
    const r = b * phi;
    if (r > o.rMax) break;
    const m = push(cx0 + r * Math.cos(phi), cy0 + r * Math.sin(phi), z0, 'spiral', ds / o.speed);
    if (m.pm > o.thresh) { found = true; ev.firstLight = t; ev.firstLightIdx = frames.length - 1; }
    phi += ds / Math.hypot(r, b);
  }
  if (!found) { ev.fail = 'spiral'; return { frames, events: ev }; }

  // ---- 階段二：繞圈梯度（XY）＋ Z 三點 ----
  let x = frames[frames.length - 1].dx, y = frames[frames.length - 1].dy, z = z0;
  let calm = 0;
  const gainXY = 0.85, maxXY = 25, maxZ = 12;
  ev.iters = 0;
  for (let it = 0; it < 80; it++) {
    ev.iters = it + 1;
    const wb = beamAt(p, z - p.WD).w;
    const a = clampv(0.35 * Math.sqrt((wb * wb + p.wgx * p.wgy) / 2), 0.15, 4);
    const f = [];
    for (let k = 0; k < 8; k++) {
      const ang = (2 * Math.PI * k) / 8;
      const m = push(x + a * Math.cos(ang), y + a * Math.sin(ang), z, 'circle', o.sampleDt);
      f.push(Math.log(Math.max(m.pm, 1e-9)));
    }
    let gx = 0, gy = 0;
    for (let k = 0; k < 8; k++) { const ang = (2 * Math.PI * k) / 8; gx += f[k] * Math.cos(ang); gy += f[k] * Math.sin(ang); }
    gx /= 4 * a; gy /= 4 * a;
    // Z：中心與 ±δ 三點拋物線
    const zR = (Math.PI * p.wf * p.wf) / LAMBDA;
    const dz = clampv(0.3 * zR, 0.4, 5);
    const f0 = Math.log(Math.max(push(x, y, z, 'zprobe', o.sampleDt).pm, 1e-9));
    const fp = Math.log(Math.max(push(x, y, z + dz, 'zprobe', o.sampleDt).pm, 1e-9));
    const fm = Math.log(Math.max(push(x, y, Math.max(o.minGap, z - dz), 'zprobe', o.sampleDt).pm, 1e-9));
    const slope = (fp - fm) / (2 * dz), curv = (fp + fm - 2 * f0) / (dz * dz);
    let stepZ = curv < -1e-6 ? -slope / curv : Math.sign(slope) * 8;
    stepZ = clampv(0.9 * stepZ, -maxZ, maxZ);
    let sx = clampv(gainXY * ((wb * wb + p.wgx * p.wgx) / 4) * gx, -maxXY, maxXY);
    let sy = clampv(gainXY * ((wb * wb + p.wgy * p.wgy) / 4) * gy, -maxXY, maxXY);
    const nz = Math.max(o.minGap, z + stepZ);
    // 平滑移到新中心
    const nSeg = 3;
    for (let k = 1; k <= nSeg; k++) push(x + (sx * k) / nSeg, y + (sy * k) / nSeg, z + ((nz - z) * k) / nSeg, 'move', 0.002);
    x += sx; y += sy; z = nz;
    if (it === 0) ev.lockIdx = frames.length - 1;
    const small = Math.hypot(sx, sy) < 0.04 && Math.abs(stepZ) < 0.2;
    calm = small ? calm + 1 : 0;
    if (calm >= 2) { ev.done = t; ev.doneIdx = frames.length - 1; break; }
  }
  for (let k = 0; k < 6; k++) push(x, y, z, 'hold', 0.01);
  if (ev.done == null) { ev.done = t; ev.doneIdx = frames.length - 1; ev.note = '未在迭代上限內完全收斂'; }
  ev.lockT = ev.lockIdx != null ? frames[ev.lockIdx].t : null;
  const last = frames[frames.length - 1];
  ev.final = { dx: last.dx, dy: last.dy, gap: last.gap, eta: last.eta };
  return { frames, events: ev };
}
