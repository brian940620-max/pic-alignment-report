import { CatmullRomCurve3, DynamicDrawUsage, TubeGeometry, Vector3 } from 'three';

// Same Catmull-Rom samples, Frenet frames and 90 × 8 topology as TubeGeometry.
// Keep position/normal/index/UV buffers alive throughout an animation.
export function cableGeometry(points, radius, segments = 90, radial = 8) {
  const curve = new CatmullRomCurve3(points);
  const geometry = new TubeGeometry(curve, segments, radius, radial, false);
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  position.setUsage(DynamicDrawUsage); normal.setUsage(DynamicDrawUsage);
  const point = new Vector3(), n = new Vector3();
  const sin = [], cos = [];
  for (let j = 0; j <= radial; j++) { sin[j] = Math.sin(j / radial * Math.PI * 2); cos[j] = -Math.cos(j / radial * Math.PI * 2); }
  return { geometry, update(next) {
    curve.points = next; curve.updateArcLengths();
    const frames = curve.computeFrenetFrames(segments, false);
    geometry.tangents = frames.tangents; geometry.normals = frames.normals; geometry.binormals = frames.binormals;
    let offset = 0;
    for (let i = 0; i <= segments; i++) {
      curve.getPointAt(i / segments, point);
      const N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j <= radial; j++, offset += 3) {
        n.set(cos[j] * N.x + sin[j] * B.x, cos[j] * N.y + sin[j] * B.y, cos[j] * N.z + sin[j] * B.z).normalize();
        for (let axis = 0; axis < 3; axis++) {
          normal.array[offset + axis] = n.getComponent(axis);
          position.array[offset + axis] = point.getComponent(axis) + radius * n.getComponent(axis);
        }
      }
    }
    position.needsUpdate = normal.needsUpdate = true;
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  } };
}
