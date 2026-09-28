import type { CastEvent, RunEvidence } from './domain';

export const castDecisionTime = (cast: CastEvent) => cast.beganAt ?? cast.time;

export function momentSequence(
  evidence: RunEvidence | undefined,
  time: number,
  spellId: number,
): CastEvent[] {
  if (!evidence) return [];
  const pull = evidence.pulls.find(
    (item) => time >= item.start && time < item.end,
  );
  if (!pull) return [];
  const nearby = evidence.casts
    .filter(
      (cast) =>
        castDecisionTime(cast) >= Math.max(pull.start, time - 5) &&
        castDecisionTime(cast) < Math.min(pull.end, time + 6),
    )
    .sort((a, b) => castDecisionTime(a) - castDecisionTime(b));
  let focus = nearby.findIndex(
    (cast) =>
      cast.id === spellId && Math.abs(castDecisionTime(cast) - time) < 0.2,
  );
  if (focus < 0)
    focus = nearby.findIndex((cast) => castDecisionTime(cast) >= time);
  return nearby.slice(Math.max(0, focus - 2), Math.max(0, focus - 2) + 6);
}
