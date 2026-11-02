// Coalesce input/resize invalidations without dropping the latest state.
// flush() lets an animation draw in its own frame; cancel() prevents hidden work.
export function frameTask(draw) {
  let frame = 0;
  const request = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; draw(); });
  };
  request.cancel = () => { cancelAnimationFrame(frame); frame = 0; };
  request.flush = () => { request.cancel(); draw(); };
  return request;
}
