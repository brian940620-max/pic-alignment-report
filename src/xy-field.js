const SIG = 1.5, HALF = 60, NB = 12;

// Gaussian components are separable. Evaluate exponentials along each axis,
// retaining the full grid and accumulation order instead of resampling it.
function gaussianGrid(components, xs, ys) {
  const out = new Float64Array(xs.length * ys.length);
  for (const b of components) {
    const gx = xs.map(x => Math.exp(-((x - b.x) ** 2) / (2 * b.sx ** 2)));
    const gy = ys.map(y => Math.exp(-((y - b.y) ** 2) / (2 * b.sy ** 2)));
    for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) out[j * xs.length + i] += b.a * gx[i] * gy[j];
  }
  return out;
}

export function makeScene(seed) {
  let s = seed; const u = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ang = u() * 2 * Math.PI, rr = 54 * Math.sqrt(u());
  const main = [rr * Math.cos(ang), rr * Math.sin(ang)], bumps = [];
  while (bumps.length < NB) {
    const p = [(u() * 2 - 1) * 59, (u() * 2 - 1) * 59];
    if (Math.hypot(p[0] - main[0], p[1] - main[1]) < 8 || bumps.some(b => Math.hypot(p[0] - b.x, p[1] - b.y) < 6)) continue;
    bumps.push({ x: p[0], y: p[1], a: 0.001 + u() * 0.029, sx: 0.5 + u() * 1.5, sy: 0.5 + u() * 1.5 });
  }
  const bump = (x, y) => bumps.reduce((acc, b) => acc + b.a * Math.exp(-((x - b.x) ** 2) / (2 * b.sx ** 2) - ((y - b.y) ** 2) / (2 * b.sy ** 2)), 0);
  const axis = Array.from({ length: 241 }, (_, i) => -HALF + i * 0.5);
  let mx = 0; for (const v of gaussianGrid(bumps, axis, axis)) mx = Math.max(mx, v);
  const k = mx > 0.03 ? 0.03 / mx : 1;
  const P = (x, y) => Math.exp(-((x - main[0]) ** 2 + (y - main[1]) ** 2) / (2 * SIG * SIG)) + k * bump(x, y);
  const sampleGrid = (xs, ys) => {
    const out = gaussianGrid(bumps, xs, ys);
    for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
      const index = j * xs.length + i;
      out[index] = Math.exp(-((xs[i] - main[0]) ** 2 + (ys[j] - main[1]) ** 2) / (2 * SIG * SIG)) + k * out[index];
    }
    return out;
  };
  return { main, bumps, P, sampleGrid };
}
