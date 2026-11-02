import { Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function materialKey(material) {
  // Compare every serializable material property, including textures and the
  // original selection/fade state. Identity/version do not affect appearance.
  return JSON.stringify(Object.fromEntries(Object.entries(material)
    .filter(([k]) => !['id', 'uuid', 'version'].includes(k))
    .map(([k, value]) => [k, value?.isTexture ? value.uuid : value])));
}

// Only sibling solids with the same owner/material become one draw call.
// Moving axes, transparent optics, labels, cables and powered waveguides retain
// their identity. No vertex, normal, UV, triangle or material detail is removed.
export function batchRigidParts(owners, pickables, excluded = new Set()) {
  let removed = 0;
  for (const owner of owners) {
    if (owner.userData.pid === 'DUT') continue;
    const groups = new Map();
    for (const mesh of owner.children) {
      const m = mesh.material, g = mesh.geometry;
      if (!mesh.isMesh || mesh.isInstancedMesh || mesh.children.length || excluded.has(mesh) ||
          !m?.isMeshStandardMaterial || m.transparent || m.map || !g?.index || g.morphAttributes.position ||
          mesh.scale.x * mesh.scale.y * mesh.scale.z <= 0) continue;
      const key = JSON.stringify([materialKey(m), mesh.visible, mesh.castShadow, mesh.receiveShadow,
        mesh.renderOrder, mesh.layers.mask, mesh.userData.pid, pickables.includes(mesh),
        Object.entries(g.attributes).map(([name, a]) => [name, a.itemSize, a.normalized, a.array.constructor.name])]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(mesh);
    }
    for (const meshes of groups.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      if (!geometry) continue;
      const first = meshes[0], batch = new Mesh(geometry, first.material);
      batch.userData = { ...first.userData }; batch.visible = first.visible;
      batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
      batch.renderOrder = first.renderOrder; batch.layers.mask = first.layers.mask;
      batch.updateMatrix(); batch.matrixAutoUpdate = false;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const pickable = pickables.includes(first);
      for (const mesh of meshes) {
        owner.remove(mesh);
        const index = pickables.indexOf(mesh); if (index >= 0) pickables.splice(index, 1);
      }
      owner.add(batch); if (pickable) pickables.push(batch);
      removed += meshes.length - 1;
    }
  }
  return removed;
}
