// Shared detailed appearance and cable updates for validation machine views.
// Detail meshes stay inside their original kinematic owners. No measured values change.
import * as THREE from 'three';
import {cableGeometry} from './cable-geometry.js';

export function finishTour({ scene, renderer, controls, floor, sun, parts, pickables, views, cables }) {
  views.board = [[-950, 760, 1260], [20, 175, -20]];
  views.all = [[1600, 1160, 2080], [430, 160, -210]];
  views.stack = [[-350, 450, 680], [-55, 230, 0]];
  views.inst = [[980, 500, 580], [550, 100, -470]];
  controls.rotateSpeed = .65;
  controls.zoomSpeed = .75;
  controls.panSpeed = .75;
  controls.dampingFactor = .10;
  scene.background = new THREE.Color(0x28323e);
  scene.fog.color.copy(scene.background);
  scene.environmentIntensity = 1.0;
  renderer.toneMappingExposure = 1.04;
  sun.intensity = 2.0;
  sun.color.setHex(0xfff9f1);
  scene.traverse(o => { if (o.isHemisphereLight) o.intensity = .36; });
  const softFill = new THREE.DirectionalLight(0xd7e7ff, .65);
  softFill.position.set(-400, 520, 950);
  scene.add(softFill);
  // Keep the lab floor subdued so the machined surfaces define the image.
  floor.material.roughness = .94;
  floor.material.envMapIntensity = .18;

  const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const grain = (brushed) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const context = canvas.getContext('2d'), pixels = context.createImageData(1024, 256);
    let seed = brushed ? 4219 : 1729;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let y = 0; y < 256; y++) {
      const line = (random() - .5) * (brushed ? 30 : 5);
      for (let x = 0; x < 1024; x++) {
        const k = (y * 1024 + x) * 4, value = 210 + line + (random() - .5) * (brushed ? 9 : 22);
        pixels.data[k] = pixels.data[k + 1] = pixels.data[k + 2] = value;
        pixels.data[k + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    return texture;
  };
  const brushed = grain(true), anodized = grain(false), treated = new Set();
  scene.traverse(o => {
    if (!o.isMesh || o === floor) return;
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!material || treated.has(material)) continue;
      treated.add(material);
      for (const key of ['map', 'roughnessMap', 'bumpMap', 'normalMap']) {
        if (material[key]) { material[key].anisotropy = anisotropy; material[key].needsUpdate = true; }
      }
      if (!material.isMeshStandardMaterial || material.transparent || material.map || material.emissiveIntensity > 1) continue;
      if (material.metalness >= .7) {
        material.roughnessMap = brushed;
        material.bumpMap = brushed;
        material.bumpScale = .016;
        material.roughness = .32;
        material.envMapIntensity = 1.08;
      } else if (material.metalness >= .4) {
        material.roughnessMap = anodized;
        material.bumpMap = anodized;
        material.bumpScale = .009;
        material.roughness = .48;
        // Lift the deepest black slightly; retain rail seams and machining relief.
        if (material.color.getHex() < 0x303030) material.color.lerp(new THREE.Color(0x424950), .18);
        material.envMapIntensity = .85;
      }
      material.needsUpdate = true;
    }
  });

  // Real geometry at the threaded-hole rims holds up at grazing angles.
  // 36 × 24 holes at the existing 25 mm pitch, drawn in two instanced batches.
  const boardOwner = parts.R20?.[0];
  const board = boardOwner?.children.find(m => m.isMesh && Array.isArray(m.material));
  if (board) {
    const top = board.material[2];
    top.map = null; top.bumpMap = brushed; top.bumpScale = .018;
    top.roughnessMap = brushed; top.roughness = .37;
    top.color.setHex(0x9da6af); top.metalness = .88; top.envMapIntensity = .85;
    top.needsUpdate = true;
    const rim = new THREE.InstancedMesh(new THREE.RingGeometry(2.65, 3.35, 24),
      new THREE.MeshStandardMaterial({ color: 0x707b85, metalness: .88, roughness: .28 }), 864);
    const well = new THREE.InstancedMesh(new THREE.CircleGeometry(2.65, 24),
      new THREE.MeshStandardMaterial({ color: 0x101419, metalness: .15, roughness: .82 }), 864);
    const transform = new THREE.Object3D();
    transform.rotation.x = -Math.PI / 2;
    let i = 0;
    for (let z = 0; z < 24; z++) for (let x = 0; x < 36; x++) {
      transform.position.set(-437.5 + x * 25, .045, -287.5 + z * 25);
      transform.updateMatrix(); rim.setMatrixAt(i, transform.matrix); well.setMatrixAt(i++, transform.matrix);
    }
    for (const mesh of [rim, well]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.userData = { nopick: true, pid: 'R20' };
      // Let the board's selection/fade treatment include its new details, while
      // hit testing the original board instead of 1,728 individual instances.
      mesh.raycast = () => {};
      boardOwner.add(mesh);
      pickables.push(mesh);
    }
  }

  // Reuse GPU buffers. Unchanged cables do no work; moving ones update at most
  // 30 Hz while the camera and the rigid mechanism can render at display rate.
  const positions = new Map(), buffers = new Map();
  let lastCableUpdate = -Infinity, pending = null;
  return function updateCables() {
    const now = performance.now();
    if (now - lastCableUpdate < 32) {
      if (pending === null) pending = setTimeout(() => { pending = null; updateCables(); }, 33 - (now - lastCableUpdate));
      return;
    }
    if (pending !== null) { clearTimeout(pending); pending = null; }
    lastCableUpdate = now;
    // cable.fn() updates just the endpoint's ancestor chain via getWorldPosition.
    let changed = false;
    for (const cable of cables) {
      if (!cable.g.visible) continue;
      const points = cable.fn(), previous = positions.get(cable);
      if (previous && previous.length === points.length && points.every((p, i) => p.distanceToSquared(previous[i]) < .000001)) continue;
      positions.set(cable, points.map(p => p.clone()));
      changed = true;
      let buffer = buffers.get(cable);
      if (!buffer) {
        buffer = cableGeometry(points, cable.r); buffers.set(cable, buffer);
        cable.m.geometry.dispose(); cable.m.geometry = buffer.geometry;
      } else buffer.update(points);
    }
    // A throttled final update can land after the last pose message.
    if (changed) updateCables.onChange?.();
  };
}
