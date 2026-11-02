import assert from 'node:assert/strict';
import { profileConvolver } from '../src/camera-profile.js';
import { makeScene } from '../src/xy-field.js';
import { fieldRGB, lightRGB, writeFieldPixel, writeLightPixel } from '../src/presentation-palette.js';
import { frameTask } from '../src/render-task.js';
import { fitCanvas } from '../src/ui.js';
import { facet } from '../src/field6.js';
import { sensitivityField } from '../src/sensitivity-field.js';

// Cached six-axis fields must preserve the full numerical integration, including
// invalidation when source, ellipticity, aperture or ideal working distance change.
const axes = ['x', 'y', 'z', 'tx', 'ty', 'tz'];
let integrations = 0;
const sensitivity = sensitivityField((...args) => { integrations++; return facet(...args); });
for (const wf of [1.5, 5.2]) for (const ellipse of [false, true]) {
  const idealZ = wf === 1.5 ? 30 : 5;
  const state = { x: 0, y: 0, z: idealZ, tx: 0, ty: 0, tz: 0, wsx: wf, wsy: wf * (ellipse ? .5 : 1), wd: wf === 1.5 ? 30 : 0, wrx: wf, wry: wf * (ellipse ? .5 : 1) };
  for (const [axis, value] of [['x', 3.95], ['y', -4], ['z', 80], ['tx', -.087], ['ty', .087], ['tz', 1.57]]) {
    state[axis] = value;
    const actual = sensitivity(state, 15, idealZ), ideal = { ...state, x: 0, y: 0, z: idealZ, tx: 0, ty: 0, tz: 0 };
    const f0 = facet(ideal, 15, 141);
    assert.deepEqual(actual.f, facet(state, 15, 141)); assert.deepEqual(actual.f0, f0);
    assert.equal(actual.mx, Math.max(...f0.I));
    assert.deepEqual(actual.loss, axes.map(k => Math.max(0, -10 * Math.log10(Math.max(facet({ ...ideal, [k]: state[k] }, 15, 81).eta, 1e-9) / Math.max(f0.eta, 1e-9)))));
    const before = integrations; sensitivity(state, 15, idealZ); assert.equal(integrations, before);
  }
  const before = integrations; state.x = 0; sensitivity(state, 15, idealZ); assert.equal(integrations - before, 2);
  const resized = sensitivity(state, 20, idealZ + 1); assert.deepEqual(resized.f, facet(state, 20, 141));
  assert.deepEqual(resized.f0, facet({ ...state, x: 0, y: 0, z: idealZ + 1, tx: 0, ty: 0, tz: 0 }, 20, 141));
}
console.log('PASS: six-axis fields/losses remain exact across both sources, ellipticity, all axes and reference changes; one-axis edits require only two integrations.');

// Independent, direct convolution reference: includes edge clamping, even box
// sizes and kernels wider than the profile. No timing thresholds in CI.
function directConvolution(raw, dy, sigma, pixel) {
  const radius = Math.ceil(3 * Math.max(sigma, pixel) / dy), weights = [];
  for (let k = -radius; k <= radius; k++) weights.push(Math.exp(-0.5 * ((k * dy) / sigma) ** 2));
  const sum = weights.reduce((a, b) => a + b, 0);
  const blurred = raw.map((_, i) => weights.reduce((a, w, j) => a + w * raw[Math.max(0, Math.min(raw.length - 1, i + j - radius))], 0) / sum);
  const half = Math.max(1, Math.round(pixel / dy)) >> 1;
  return blurred.map((_, i) => {
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += blurred[Math.max(0, Math.min(raw.length - 1, i + k))];
    return sum / (2 * half + 1);
  });
}
const profiles = [
  Array(761).fill(.08),
  Array.from({ length: 761 }, (_, i) => i < 120 ? .08 : i < 130 ? .95 : i < 360 ? .2 : i < 400 ? .32 : i < 630 ? .2 : .08),
  [.08, .95, .2, .38, .2, .42, .32, .42, .2, .95, .08],
];
let maxProfileError = 0;
for (const raw of profiles) {
  const convolve = profileConvolver(raw, .25);
  for (const pixel of [3.69 / 2, 3.69 / 5, 3.69 / 10]) for (const sigma of [.4125, .825, 2.1, 4, 14, 30.5]) {
    const expected = directConvolution(raw, .25, sigma, pixel), actual = convolve(sigma, pixel);
    actual.forEach((v, i) => { maxProfileError = Math.max(maxProfileError, Math.abs(v - expected[i])); });
  }
}
assert(maxProfileError < 2e-13, `Profile changed: ${maxProfileError}`);

// The optimized grid must agree with pointwise evaluation, including weak peaks.
let maxFieldError = 0, seed = 20260920;
const xs = Array.from({ length: 361 }, (_, i) => -60 + i * (120 / 360)), ys = xs.map(x => -x);
for (let scenario = 0; scenario < 6; scenario++) {
  const scene = makeScene(seed), grid = scene.sampleGrid(xs, ys);
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) maxFieldError = Math.max(maxFieldError, Math.abs(grid[j * xs.length + i] - scene.P(xs[i], ys[j])));
  assert.equal(scene.bumps.length, 12);
  seed = seed * 48271 % 2147483647;
}
assert(maxFieldError < 1e-14, `XY field changed: ${maxFieldError}`);

// Display colors must retain byte-for-byte rounding, including clamped values.
const actualPixel = new Uint8ClampedArray(4), expectedPixel = new Uint8ClampedArray(4);
for (let i = -100; i <= 10100; i++) for (const [color, write] of [[fieldRGB, writeFieldPixel], [lightRGB, writeLightPixel]]) {
  expectedPixel.set([...color(i / 10000), 255]); write(actualPixel, 0, i / 10000);
  assert.deepEqual(actualPixel, expectedPixel);
}

// A burst renders once, using its latest state; hidden/flush work cannot leak.
let nextId = 0, state = 0, drawn = [], frames = new Map();
globalThis.requestAnimationFrame = fn => { frames.set(++nextId, fn); return nextId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
const step = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); };
const request = frameTask(() => drawn.push(state));
for (state = 0; state < 20; state++) request();
assert.equal(frames.size, 1); step(); assert.deepEqual(drawn, [20]);
request(); request.cancel(); step(); assert.deepEqual(drawn, [20]);
state = 30; request(); request.flush(); step(); assert.deepEqual(drawn, [20, 30]);

// Resize deduplication must still restore a previously hidden canvas and DPR.
let resize, redraws = 0;
globalThis.ResizeObserver = class { constructor(fn) { resize = fn; } observe() {} };
globalThis.window = { devicePixelRatio: 2, __deckScale: 1, addEventListener() {} };
const canvas = { width: 300, height: 150, clientWidth: 500, clientHeight: 250, getContext: () => ({ setTransform() {} }) };
const fit = fitCanvas(canvas, () => redraws++);
assert.equal(redraws, 1); assert.equal(canvas.width, 1000);
fit.apply(); resize(); assert.equal(redraws, 1);
window.__deckScale = .75; fit.apply(); assert.equal(redraws, 2); assert.equal(canvas.width, 750);
canvas.clientWidth = canvas.clientHeight = 0; resize(); assert.equal(fit.w, 0); assert.equal(fit.h, 0);
canvas.clientWidth = 500; canvas.clientHeight = 250; resize(); assert.equal(redraws, 3);
canvas.width = 1; fit.apply(); assert.equal(redraws, 4); assert.equal(canvas.width, 750);
console.log(`PASS: full-resolution XY error ${maxFieldError.toExponential(2)}, profile error ${maxProfileError.toExponential(2)}, exact palette bytes, coalescing/cancellation, resize/DPR/hidden restoration.`);
