import { facet } from './field6.js';

const AXES = ['x', 'y', 'z', 'tx', 'ty', 'tz'];

// Keep only the current field, ideal reference and one loss per axis. Changing
// an optical parameter invalidates every dependent result; moving one axis
// reuses the other five integrations. Sample counts and formulas stay intact.
export function sensitivityField(evaluate = facet) {
  let referenceKey, reference, currentKey, current;
  const axes = new Map();
  return (state, hw, idealZ) => {
    const ideal = { ...state, x: 0, y: 0, z: idealZ, tx: 0, ty: 0, tz: 0 };
    const key = JSON.stringify([ideal, hw]);
    if (referenceKey !== key) {
      referenceKey = key;
      const f0 = evaluate(ideal, hw, 141);
      let mx = 0; for (const value of f0.I) mx = Math.max(mx, value);
      reference = { f0, mx }; axes.clear(); currentKey = undefined;
    }
    const poseKey = JSON.stringify(state);
    if (currentKey !== poseKey) { current = evaluate(state, hw, 141); currentKey = poseKey; }
    const loss = AXES.map(axis => {
      let entry = axes.get(axis);
      if (!entry || entry.value !== state[axis]) {
        const eta = evaluate({ ...ideal, [axis]: state[axis] }, hw, 81).eta;
        entry = { value: state[axis], loss: Math.max(0, -10 * Math.log10(Math.max(eta, 1e-9) / Math.max(reference.f0.eta, 1e-9))) };
        axes.set(axis, entry);
      }
      return entry.loss;
    });
    return { f: current, ...reference, loss };
  };
}
