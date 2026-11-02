// Opt-in, local-only diagnostics. Normal reports allocate no timer or observer.
// CPU submission time is not GPU time; rAF spacing is not a guaranteed FPS.
export function machineProfile(enabled, canvas) {
  if (!enabled) return null;
  const output = document.createElement('output');
  output.id = 'machine-performance'; output.hidden = true;
  document.body.append(output);
  const totals = { steps: 0, renders: 0, shadows: 0, drawCalls: 0, cpuMs: 0 };
  let previous = { ...totals }, last = performance.now();
  setInterval(() => {
    const now = performance.now(), elapsedMs = now - last;
    const sample = Object.fromEntries(Object.keys(totals).map(k => [k, +(totals[k] - (previous[k] || 0)).toFixed(2)]));
    output.textContent = JSON.stringify({ elapsedMs: +elapsedMs.toFixed(1), ...sample,
      pixels: [canvas.width, canvas.height], totals });
    previous = { ...totals }; last = now;
  }, 1000);
  return totals;
}
