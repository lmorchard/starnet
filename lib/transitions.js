// Linear interpolation from v0 to v1 over t[0..1]
export function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

export function transition(
  start,
  end,
  duration,
  elapsed,
  ease = (x) => x,
  transform = (x) => x,
  endThreshold = 0.999
) {
  const progress = elapsed / duration;
  if (progress > endThreshold) return end;
  return transform(lerp(start, end, ease(progress)));
}

// TODO: more convenient transition that accepts arrays of from/to
// and returns array of current
