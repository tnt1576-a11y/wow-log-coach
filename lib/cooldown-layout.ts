import type { CastEvent } from './domain';

/** Collapse only visually adjacent uses of one spell; all original timestamps are retained. */
export function clusterCooldownMarkers(
  casts: CastEvent[],
  duration: number,
  trackWidth = 620,
) {
  const denominator = Math.max(1, duration);
  const minimumPercent = (42 / Math.max(1, trackWidth)) * 100;
  const groups: Array<{ position: number; events: CastEvent[] }> = [];
  for (const cast of [...casts].sort((a, b) => a.time - b.time)) {
    if (
      !Number.isFinite(cast.time) ||
      cast.time < 0 ||
      cast.time >= denominator
    )
      continue;
    const position = (cast.time / denominator) * 100;
    const last = groups[groups.length - 1];
    if (last && position - last.position < minimumPercent)
      last.events.push(cast);
    else groups.push({ position, events: [cast] });
  }
  return groups;
}
