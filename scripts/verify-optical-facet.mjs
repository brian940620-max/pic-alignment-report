import assert from 'node:assert/strict';
import { facetFootprint } from '../src/alignment-optics.js';
import { DEFAULTS, beamAt } from '../src/physics.js';

// Every contour point must lie one beam radius from the tilted optical axis.
// This independently checks the plane intersection, signs, and diagonal tilt.
for (const [tx, ty] of [[0, 0], [.1, 0], [0, -.1], [.07, .09], [-.07, .09]]) {
  const pose = { dx: 2, dy: -1.5, gap: 36, tx, ty };
  const f = facetFootprint(DEFAULTS, pose), w = beamAt(DEFAULTS, 6).w;
  const len = Math.hypot(tx, ty, 1);
  for (let i = 0; i < 32; i++) {
    const t = i * Math.PI / 16;
    const u = f.major * Math.cos(t), v = f.minor * Math.sin(t);
    const x = u * Math.cos(f.angle) - v * Math.sin(f.angle);
    const y = -(u * Math.sin(f.angle) + v * Math.cos(f.angle));
    const along = (x * tx + y * ty) / len;
    assert(Math.abs(x * x + y * y - along * along - w * w) < 1e-12);
  }
  assert.equal(f.cx, 2 + 36 * tx);
  assert.equal(f.cy, -1.5 + 36 * ty);
  if (!tx && !ty) assert.equal(f.major, f.minor);
  else assert(f.major > f.minor);
}
console.log('PASS: facet contours match tilted-axis plane intersections for zero, horizontal, vertical and combined tilt.');
