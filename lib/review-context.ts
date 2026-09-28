import type { AnalysisResult, RunEvidence } from './domain';
import type { BriefMoment } from './run-brief';
import { castDecisionTime } from './cast-sequence';
import { defensiveSpell } from './defensives';

/** Bound observations by recorded events, never by an assumed cooldown. */
export function momentContext(
  evidence: RunEvidence | undefined,
  moment: BriefMoment,
) {
  const pull = evidence?.pulls.find(
    (p) => moment.time >= p.start && moment.time < p.end,
  );
  const exact = (evidence?.casts ?? []).filter(
    (cast) =>
      (moment.spellId === undefined || cast.id === moment.spellId) &&
      (castDecisionTime(cast) === moment.time || cast.time === moment.time),
  );
  const cast = exact.length === 1 ? exact[0] : null;
  const nextDeath =
    pull &&
    evidence?.deaths
      .filter((d) => d.time >= moment.time && d.time < pull.end)
      .sort((a, b) => a.time - b.time)[0];
  const death = evidence?.deaths.find((d) => d.time === moment.time);
  const end =
    pull && Math.min(pull.end, evidence!.duration, nextDeath?.time ?? Infinity);
  return {
    pull,
    cast,
    remaining: end === undefined ? null : Math.max(0, end - moment.time),
    endedByDeath: Boolean(nextDeath && end === nextDeath.time),
    castComplete: evidence?.castsComplete ?? false,
    mana:
      cast?.mana &&
      Number.isFinite(cast.mana.maximum) &&
      cast.mana.maximum > 0 &&
      Number.isFinite(cast.mana.amount) &&
      cast.mana.amount >= 0 &&
      cast.mana.amount <= cast.mana.maximum
        ? {
            percent: (100 * cast.mana.amount) / cast.mana.maximum,
            time: cast.time,
          }
        : null,
    death,
    hits: [...(death?.hits ?? [])]
      .filter(
        (h) => h.time <= moment.time && h.time >= moment.time - death!.window,
      )
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3),
    // These are activations, not established mitigation buffs or availability.
    defensives: (evidence?.casts ?? []).filter(
      (c) =>
        c.time >= Math.max(0, moment.time - (death?.window ?? 10)) &&
        c.time <= moment.time &&
        defensiveSpell(c.id),
    ),
  };
}

export function patternBreakdown(
  result: AnalysisResult,
  moments: BriefMoment[],
) {
  const unique = [
    ...new Map(
      moments.map((m) => [`${m.time}:${m.spellId ?? ''}`, m]),
    ).values(),
  ];
  const pulls = result.evidence?.pulls ?? [];
  const rows = pulls
    .map((pull) => ({
      pull,
      count: unique.filter((m) => m.time >= pull.start && m.time < pull.end)
        .length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.pull.start - b.pull.start);
  const located = unique.filter((m) =>
    pulls.some((p) => m.time >= p.start && m.time < p.end),
  ).length;
  return {
    total: unique.length,
    rows,
    unlocated: unique.length - located,
    boss: rows.filter((r) => r.pull.boss).reduce((n, r) => n + r.count, 0),
    trash: rows.filter((r) => !r.pull.boss).reduce((n, r) => n + r.count, 0),
  };
}
