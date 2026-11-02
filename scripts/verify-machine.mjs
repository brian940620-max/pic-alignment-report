import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { LatheGeometry, Vector2, Vector3, CatmullRomCurve3, TubeGeometry, Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { createMicroBeam } from '../src/micro-beam.js';
import { beamAt } from '../src/physics.js';
import { cableGeometry } from '../src/cable-geometry.js';
import { demandLoop } from '../src/demand-loop.js';
import { batchRigidParts } from '../src/rigid-batches.js';

// Hidden and idle scenes must not keep a pending frame, while camera damping,
// inputs during a frame and resume all remain live with a bounded delta.
const pending = new Map(); let nextFrame = 0, animate = false, wakeInside = false;
const deltas = [];
const scheduling = demandLoop(dt => {
  deltas.push(dt); if (wakeInside) { wakeInside = false; scheduling.wake(); } return animate;
}, { raf: fn => { pending.set(++nextFrame, fn); return nextFrame; }, caf: id => pending.delete(id) });
const tick = now => { const [id, fn] = pending.entries().next().value; pending.delete(id); fn(now); };
scheduling.wake(); scheduling.wake(); assert.equal(pending.size, 1);
tick(100); assert.equal(pending.size, 0);
scheduling.wake(); tick(5000); assert.equal(deltas.at(-1), 0, 'Idle time must not advance the animation');
animate = true; scheduling.wake(); tick(6000); tick(6016); assert.equal(deltas.at(-1), .016);
scheduling.setActive(false); scheduling.wake(); assert.equal(pending.size, 0);
scheduling.setActive(true); tick(9000); assert.equal(deltas.at(-1), 0);
animate = false; wakeInside = true; tick(9016); assert.equal(pending.size, 1);
tick(9032); assert.equal(pending.size, 0);

const cablePath = n => [new Vector3(-345,35,-372), new Vector3(-320,60,-330),
  new Vector3(-60,200,-230), new Vector3(-120+n,280,10), new Vector3(n,210,80)];
const cable = cableGeometry(cablePath(0), 1.6);
const cableAttributes = { ...cable.geometry.attributes }, cableIndex = cable.geometry.index;
for (const displacement of [0, 24, -48, .0001, 250, 0]) {
  const points = cablePath(displacement); cable.update(points);
  const reference = new TubeGeometry(new CatmullRomCurve3(points), 90, 1.6, 8, false);
  for (const name of ['position', 'normal', 'uv']) {
    assert.strictEqual(cable.geometry.attributes[name], cableAttributes[name]);
    assert.deepEqual(cable.geometry.attributes[name].array, reference.attributes[name].array, `${name} matches TubeGeometry exactly`);
  }
  assert.strictEqual(cable.geometry.index, cableIndex); assert.deepEqual(cableIndex.array, reference.index.array);
  assert(Number.isFinite(cable.geometry.boundingSphere.radius)); reference.dispose();
}
const time = fn => { const start = performance.now(); for (let i = 0; i < 400; i++) fn(i); return performance.now() - start; };
const oldMs = time(i => new TubeGeometry(new CatmullRomCurve3(cablePath(i)), 90, 1.6, 8, false).dispose());
const newMs = time(i => cable.update(cablePath(i)));
console.log(`Cable CPU benchmark (400 updates, diagnostic only): ${oldMs.toFixed(1)} ms → ${newMs.toFixed(1)} ms`);
cable.geometry.dispose();

// Batch only identical opaque siblings, preserving triangle attributes,
// selection ownership and parent-axis movement. Optical transparency stays out.
const owner = new Group(); owner.userData.pid = 'R1';
const solids = [0, 1, 2].map(i => {
  const mesh = new Mesh(new BoxGeometry(2,3,4), new MeshStandardMaterial({color:0x656565, metalness:.9}));
  mesh.position.set(i*7, i*2, -i); mesh.rotation.y = i*.2; mesh.userData.pid = 'R1'; mesh.castShadow = true;
  owner.add(mesh); return mesh;
});
const expected = solids.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
const optical = new Mesh(new BoxGeometry(), new MeshStandardMaterial({transparent:true, opacity:.4})); owner.add(optical);
const candidates = [...solids, optical];
assert.equal(batchRigidParts([owner], candidates), 2); assert.equal(owner.children.length, 2);
assert(owner.children.includes(optical)); assert(candidates.includes(optical));
const batch = owner.children.find(m => m !== optical); assert.equal(batch.userData.pid, 'R1'); assert(batch.castShadow);
for (const name of ['position','normal','uv']) {
  assert.deepEqual([...batch.geometry.attributes[name].array], expected.flatMap(g => [...g.attributes[name].array]));
}
owner.position.x = 45; owner.updateMatrixWorld(true); assert.equal(batch.matrixWorld.elements[12], 45);
expected.forEach(g => g.dispose()); batch.geometry.dispose();

// Compare against the former Three.js geometry, including large gaps and a
// collapsed gap. Reusing buffers must not change the physical beam envelope.
const beam = createMicroBeam(), attribute = beam.geometry.attributes.position;
const model = { wf: 5.2, WD: 0 };
for (const length of [0, .1, 2, 10, 700, 48000, 10]) {
  beam.update(length, model);
  const profile = Array.from({ length: 49 }, (_, i) => {
    const x = Math.expm1(i / 48 * Math.log1p(length));
    return new Vector2(Math.min(beamAt(model, x).w, 1e5), x);
  });
  const reference = new LatheGeometry(profile, 40).rotateZ(-Math.PI / 2);
  assert.strictEqual(beam.geometry.attributes.position, attribute);
  attribute.array.forEach((v, i) => {
    assert(Number.isFinite(v));
    assert(Math.abs(v - reference.attributes.position.array[i]) < .005);
  });
  assert.deepEqual([...beam.geometry.index.array], [...reference.index.array]);
  assert(Number.isFinite(beam.geometry.boundingSphere.radius));
  reference.dispose();
}
beam.geometry.dispose();

// Bundle the scenario's JSON import exactly as the app does, without a browser.
const bundle = await build({ stdin: {
  contents: "export {buildFARun} from './src/mscenario.js'; export {S} from './src/pages/fa_pic.js';",
  resolveDir: fileURLToPath(new URL('../', import.meta.url)),
}, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
const { buildFARun, S } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const fixed = buildFARun({ N: 8, P: 127 }), linked = buildFARun();
const original = { ...S };
const baseline = Array.from({ length: 201 }, (_, i) => fixed.at(i / 200 * fixed.total));
try {
  S.N = 16; S.P = 250;
  assert.equal(linked.N(), 16, 'Existing configurable scenario must stay configurable');
  assert.equal(fixed.N(), 8); assert.equal(fixed.P(), 127);
  baseline.forEach((before, i) => {
    const after = fixed.at(i / 200 * fixed.total);
    assert.deepEqual(after.ch, before.ch, 'Other pages must not affect the machine model');
    assert.equal(after.ch.length, 8);
    assert.equal(after.ch[7].x, 7 * 127);
    Object.values(fixed.machinePose(after)).forEach(v => assert(Number.isFinite(v)));
  });
  assert.equal(S.N, 16); assert.equal(S.P, 250, 'Machine evaluation must not overwrite other pages');
} finally { Object.assign(S, original); }
console.log('PASS: reusable beam matches Three.js reference; all 201 machine states keep eight independent channels.');
