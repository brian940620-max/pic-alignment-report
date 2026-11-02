// Monotone Hermite interpolation for the presentation pose only.
// Matching tangents keep velocity continuous between batches; each axis stays
// between its two sampled endpoints, so visual smoothing cannot overshoot.
export function interpolateCapturePose(previous, from, to, next, fraction) {
  const t = Math.max(0, Math.min(1, fraction)), t2 = t * t, t3 = t2 * t;
  const tangent = (a, b) => a * b <= 0 ? 0 : 2 * a * b / (a + b);
  return from.map((value, k) => {
    const delta = to[k] - value;
    const m0 = tangent(value - previous[k], delta);
    const m1 = tangent(delta, next[k] - to[k]);
    return (2 * t3 - 3 * t2 + 1) * value + (t3 - 2 * t2 + t) * m0
      + (-2 * t3 + 3 * t2) * to[k] + (t3 - t2) * m1;
  });
}
