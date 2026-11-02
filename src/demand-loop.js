// One frame per invalidation; keep stepping only while an animation is moving.
// Sleeping/hidden views never poll. The next wake starts with a fresh delta.
export function demandLoop(step, { raf = requestAnimationFrame, caf = cancelAnimationFrame } = {}) {
  let frame = 0, enabled = true, last = null;
  const tick = now => {
    frame = 0;
    if (!enabled) return;
    const dt = last === null ? 0 : Math.min(.1, (now - last) / 1000);
    last = now;
    if (step(dt, now)) wake();
    else if (!frame) last = null;
  };
  function wake() { if (enabled && !frame) frame = raf(tick); }
  return {
    wake,
    setActive(value) {
      enabled = !!value;
      if (enabled) wake();
      else { caf(frame); frame = 0; last = null; }
    },
    get pending() { return !!frame; },
  };
}
