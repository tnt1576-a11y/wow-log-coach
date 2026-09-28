import type { CastEvent, RunEvidence } from './domain';

// Display presets only. Availability, cooldown length, talents and resets are not inferred.
export const COOLDOWN_PRESETS = new Set([
  365350, 321507, 12472, 190319, 12042, 80353, 389713, 10060, 194249, 391109,
  228260, 200174, 34433, 102543, 102560, 194223, 323764, 106951, 391528, 288613,
  19574, 360952, 360966, 266779, 1719, 107574, 227847, 152277, 167105, 205180,
  265187, 1122, 113858, 113860, 386997, 13750, 121471, 360194, 385627, 51690,
  185313, 51271, 63560, 275699, 42650, 49206, 383269, 114050, 114051, 191634,
  51533, 198067, 192249, 31884, 231895, 375087, 403631, 191427, 12472, 137639,
  123904, 152173, 451965,
]);

export function cooldownUses(
  evidence: RunEvidence,
  ids: ReadonlySet<number>,
  end = evidence.duration,
): CastEvent[] {
  return evidence.casts
    .filter(
      (cast) =>
        ids.has(cast.id) &&
        Number.isFinite(cast.time) &&
        cast.time >= 0 &&
        cast.time < Math.min(end, evidence.duration),
    )
    .sort((a, b) => a.time - b.time || a.id - b.id);
}

export function compareCooldownTiming(
  target: RunEvidence,
  reference: RunEvidence,
  id: number,
) {
  const end = Math.min(target.duration, reference.duration);
  const ids = new Set([id]);
  const yours = cooldownUses(target, ids, end);
  const theirs = cooldownUses(reference, ids, end);
  return {
    end,
    yours,
    theirs,
    complete: target.castsComplete && reference.castsComplete,
    firstDifference:
      yours.length && theirs.length ? yours[0].time - theirs[0].time : null,
  };
}
