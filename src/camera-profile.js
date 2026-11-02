// Exact discrete convolution of the sampled, piecewise-constant fiber profile.
// Sum kernel ranges instead of repeating every tap for every output sample.
// The original 3σ cutoff, clamped edges and pixel-integration window are retained.
export function profileConvolver(raw, dy) {
  const runs = [];
  for (let start = 0; start < raw.length;) {
    let end = start + 1;
    while (end < raw.length && raw[end] === raw[start]) end++;
    runs.push({ start: start === 0 ? -Infinity : start, end: end === raw.length ? Infinity : end - 1, value: raw[start] });
    start = end;
  }
  return (sigma, pixel) => {
    const radius = Math.ceil(3 * Math.max(sigma, pixel) / dy);
    const prefix = new Float64Array(2 * radius + 2);
    for (let k = -radius; k <= radius; k++) prefix[k + radius + 1] = prefix[k + radius] + Math.exp(-0.5 * ((k * dy) / sigma) ** 2);
    const sum = prefix[prefix.length - 1], blurred = new Float64Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      let value = 0;
      for (const run of runs) {
        const lo = Math.max(-radius, run.start - i), hi = Math.min(radius, run.end - i);
        if (lo <= hi) value += run.value * (prefix[hi + radius + 1] - prefix[lo + radius]);
      }
      blurred[i] = value / sum;
    }
    const halfBox = Math.max(1, Math.round(pixel / dy)) >> 1;
    return blurred.map((_, i) => {
      let value = 0;
      for (let k = -halfBox; k <= halfBox; k++) value += blurred[Math.max(0, Math.min(blurred.length - 1, i + k))];
      return value / (2 * halfBox + 1);
    });
  };
}
