export function asStars(avg = 0) {
  const safe = Number.isFinite(avg) ? Math.max(0, Math.min(avg, 5)) : 0;
  const full = Math.floor(safe);
  const half = safe - full >= 0.5 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
  return { full, half, empty };
}
