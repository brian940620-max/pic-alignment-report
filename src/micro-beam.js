import { BufferGeometry, Float32BufferAttribute } from 'three';
import { beamAt } from './physics.js';

// Fixed topology: changing the gap updates a single GPU position buffer.
// The coordinates match LatheGeometry rotated -π/2 about Z.
export function createMicroBeam(rings = 48, sides = 40) {
  const geometry = new BufferGeometry(), positions = new Float32Array((rings + 1) * (sides + 1) * 3), indices = [];
  for (let i = 0; i < sides; i++) for (let j = 0; j < rings; j++) {
    const a = i * (rings + 1) + j, b = a + rings + 1;
    indices.push(a, b, a + 1, b + 1, a + 1, b);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const radii = new Float64Array(rings + 1), axial = new Float64Array(rings + 1);
  return {
    geometry,
    update(length, model) {
      const L = Math.max(0, length), logL = Math.log1p(L), p = geometry.attributes.position;
      for (let j = 0; j <= rings; j++) {
        axial[j] = Math.expm1(j / rings * logL);
        radii[j] = Math.min(beamAt(model, axial[j]).w, 1e5);
      }
      for (let i = 0; i <= sides; i++) {
        const angle = i / sides * Math.PI * 2, sin = Math.sin(angle), cos = Math.cos(angle);
        for (let j = 0; j <= rings; j++) p.setXYZ(i * (rings + 1) + j, axial[j], -radii[j] * sin, radii[j] * cos);
      }
      p.needsUpdate = true;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    },
  };
}
