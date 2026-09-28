import type { AnalysisResult, ReferenceRun, SpellComparison } from './domain';
import { compareSpells } from './comparisons';
import { buildDiagnosis, type ReviewTask } from './diagnosis';
import {
  castsAroundMoment,
  dangerMoments,
  defensiveCasts,
  defensiveSpell,
  type ReviewFocus,
} from './defensives';
import { damageFamilies } from './spell-families';

export type CoachingOpportunity = ReviewTask & {
  category: 'survival' | 'output' | 'activity' | 'buff' | 'gear';
  spellId?: number;
};
export type PullPractice = {
  id: number;
  name: string;
  start: number;
  duration: number;
  casts: number;
  castsPerMinute: number;
  deaths: number;
  gapSeconds: number;
  longestGap: number;
};
export type PositiveSignal = { id: string; title: string; detail: string };
export type SpellPullUse = {
  pullId: number;
  pullName: string;
  start: number;
  duration: number;
  uses: number;
  perMinute: number;
  firstUse: number | null;
};
export type DefensiveTimingCheck = {
  id: string;
  label: string;
  time: number;
  pullId?: number;
  before: Array<{ name: string; seconds: number }>;
};
export type DefensiveOverview = {
  complete: boolean;
  personal: number;
  group: number;
  recovery: number;
  moments: DefensiveTimingCheck[];
};

export function coachingOpportunities(
  result: AnalysisResult,
): CoachingOpportunity[] {
  const review = buildDiagnosis(result);
  const opportunities = review.tasks.map((task): CoachingOpportunity => {
    const driver = task.spellName
      ? review.drivers.find((entry) => entry.spell.name === task.spellName)
      : undefined;
    return {
      ...task,
      category:
        task.id === 'survival'
          ? 'survival'
          : task.id === 'gap'
            ? 'activity'
            : task.id.startsWith('buff-')
              ? 'buff'
              : task.destination === 'gear'
                ? 'gear'
                : 'output',
      spellId:
        driver?.spell.id ??
        result.spells?.find((spell) => spell.name === task.spellName)?.id,
    };
  });
  const gear = result.gear?.itemLevel;
  if (
    review.sufficient &&
    gear &&
    gear.sampleSize >= 8 &&
    gear.target < gear.p25 &&
    gear.median - gear.target >= 5
  )
    opportunities.push({
      id: 'gear-context',
      category: 'gear',
      title: 'Check the gear context before changing play',
      observation:
        gear.target.toFixed(1) +
        ' equipped item level versus ' +
        gear.median.toFixed(1) +
        ' reference median.',
      check:
        'Inspect item level, trinkets, embellishments and raw stats. This explains context; it does not estimate how much DPS gear caused.',
      destination: 'gear',
    });
  return opportunities.slice(0, 6);
}

export function pullPractice(result: AnalysisResult): PullPractice[] {
  const evidence = result.evidence;
  if (!evidence) return [];
  return evidence.pulls
    .filter((pull) => pull.end - pull.start >= 8)
    .map((pull) => {
      const duration = pull.end - pull.start;
      const casts = evidence.casts.filter(
        (cast) => cast.time >= pull.start && cast.time < pull.end,
      ).length;
      const gaps = evidence.gaps.filter((gap) => gap.pullId === pull.id);
      return {
        id: pull.id,
        name: pull.name,
        start: pull.start,
        duration,
        casts,
        castsPerMinute: casts / Math.max(duration / 60, 1 / 60),
        deaths: evidence.deaths.filter(
          (death) => death.time >= pull.start && death.time < pull.end,
        ).length,
        gapSeconds: gaps.reduce((total, gap) => total + gap.end - gap.start, 0),
        longestGap: Math.max(0, ...gaps.map((gap) => gap.end - gap.start)),
      };
    })
    .sort(
      (a, b) =>
        b.deaths - a.deaths ||
        b.longestGap - a.longestGap ||
        b.duration - a.duration,
    );
}

export function spellPullUse(
  result: AnalysisResult,
  spellId?: number,
): SpellPullUse[] {
  const evidence = result.evidence;
  const aggregateCast = result.targetMetrics.casts?.find(
    (cast) => cast.id === spellId,
  );
  if (
    !evidence?.castsComplete ||
    !spellId ||
    !aggregateCast ||
    !Number.isFinite(aggregateCast.uses) ||
    aggregateCast.uses <= 0
  )
    return [];
  return evidence.pulls
    .filter((pull) => pull.end - pull.start >= 8)
    .map((pull) => {
      const duration = pull.end - pull.start;
      const casts = evidence.casts
        .filter(
          (cast) =>
            cast.id === spellId &&
            cast.time >= pull.start &&
            cast.time < pull.end,
        )
        .sort((a, b) => a.time - b.time);
      return {
        pullId: pull.id,
        pullName: pull.name,
        start: pull.start,
        duration,
        uses: casts.length,
        perMinute: casts.length / Math.max(duration / 60, 1 / 60),
        firstUse: casts[0] ? casts[0].time - pull.start : null,
      };
    })
    .sort(
      (a, b) =>
        Number(a.uses > 0) - Number(b.uses > 0) ||
        a.perMinute - b.perMinute ||
        b.duration - a.duration,
    );
}

export function defensiveOverview(result: AnalysisResult): DefensiveOverview {
  const casts = defensiveCasts(result);
  const count = (kind: 'personal' | 'group' | 'recovery') =>
    casts.filter((cast) => cast.definition.kind === kind).length;
  return {
    complete: result.evidence?.castsComplete === true,
    personal: count('personal'),
    group: count('group'),
    recovery: count('recovery'),
    moments: dangerMoments(result)
      .slice(0, 4)
      .map((moment) => ({
        id: moment.id,
        label:
          moment.kind === 'death' ? 'Death: ' + moment.label : moment.label,
        time: moment.time,
        pullId: moment.pullId,
        before: castsAroundMoment(result, moment, 10)
          .filter(
            (cast) =>
              cast.definition.kind === 'personal' && cast.phase === 'before',
          )
          .map((cast) => ({
            name: cast.name,
            seconds: Math.abs(cast.offset),
          })),
      })),
  };
}

export function positiveSignals(result: AnalysisResult): PositiveSignal[] {
  const signals: PositiveSignal[] = [];
  const comparisonReady = result.cohort.actualSize >= 8;
  const dps = result.metrics.find((metric) => metric.id === 'dps');
  if (comparisonReady && dps && dps.sampleSize >= 8 && dps.target >= dps.p25)
    signals.push({
      id: 'dps-range',
      title:
        dps.target > dps.p75
          ? 'Overall DPS was above the reference middle range'
          : 'Overall DPS was inside the reference middle range',
      detail:
        'Useful context, not proof that every pull or decision was optimal.',
    });
  const casts = result.metrics.find((metric) => metric.id === 'castsPerMinute');
  if (
    comparisonReady &&
    casts &&
    casts.sampleSize >= 8 &&
    casts.target >= casts.p25
  )
    signals.push({
      id: 'cast-range',
      title: 'Full-run cast rate was not a clear shortfall',
      detail:
        casts.target.toFixed(1) +
        '/min versus a ' +
        casts.p25.toFixed(1) +
        '-' +
        casts.p75.toFixed(1) +
        '/min middle range. Channels and mechanics still need context.',
    });
  if (result.targetMetrics.deaths === 0)
    signals.push({
      id: 'no-deaths',
      title: 'No deaths were recorded',
      detail:
        'That removes one obvious source of lost uptime; defensive timing can still be improved.',
    });
  const supported = comparisonReady
    ? (result.spells ?? [])
        .filter(
          (spell) =>
            spell.damage.sampleSize >= 8 &&
            spell.damage.target >= spell.damage.median &&
            !defensiveSpell(spell.id),
        )
        .sort((a, b) => b.damage.target - a.damage.target)[0]
    : undefined;
  if (supported)
    signals.push({
      id: 'spell-' + supported.id,
      title: supported.name + ' contribution was not below its median',
      detail:
        'Keep the observed use pattern in mind while investigating larger differences elsewhere.',
    });
  return signals.slice(0, 3);
}

function damagePerCast(
  metrics: ReferenceRun['metrics'],
  id: number,
): number | null {
  if (!metrics) return null;
  const uses = metrics.casts?.find((cast) => cast.id === id)?.uses;
  const damage = damageFamilies(metrics.abilities).get(id)?.total;
  return Number.isFinite(uses) &&
    Number(uses) > 0 &&
    Number.isFinite(damage) &&
    Number(damage) >= 0
    ? Number(damage) / Number(uses)
    : null;
}
export type ReferenceDifference = {
  spell: SpellComparison;
  targetPerCast: number | null;
  referencePerCast: number | null;
  finding: string;
};
export function referenceDifferences(
  result: AnalysisResult,
  reference?: ReferenceRun,
): ReferenceDifference[] {
  if (!reference?.metrics) return [];
  return compareSpells(result.targetMetrics, [reference.metrics])
    .filter(
      (spell) =>
        !defensiveSpell(spell.id) &&
        (spell.damage.target > 0 || spell.damage.median > 0),
    )
    .map((spell) => {
      const targetPerCast = damagePerCast(result.targetMetrics, spell.id);
      const referencePerCast = damagePerCast(reference.metrics, spell.id);
      const fewer = spell.casts.target + 0.05 < spell.casts.median;
      const lowerPerCast =
        targetPerCast !== null &&
        referencePerCast !== null &&
        targetPerCast < referencePerCast * 0.9;
      return {
        spell,
        targetPerCast,
        referencePerCast,
        finding:
          fewer && lowerPerCast
            ? 'Fewer casts and lower damage per recorded cast'
            : fewer
              ? 'Fewer casts in the full run'
              : lowerPerCast
                ? 'Similar cast rate; lower damage per recorded cast'
                : 'Different contribution without a clear cast-rate cause',
      };
    })
    .sort(
      (a, b) =>
        b.spell.damage.median -
        b.spell.damage.target -
        (a.spell.damage.median - a.spell.damage.target),
    )
    .slice(0, 5);
}
export function practicePlanText(
  result: AnalysisResult,
  opportunity: CoachingOpportunity,
) {
  return [
    result.target.player + ' - next key review focus',
    opportunity.title,
    'Observed: ' + opportunity.observation,
    'Check: ' + opportunity.check,
    'This is a log comparison cue, not measured DPS loss or a verified class-guide rule.',
  ].join('\n');
}
export function opportunityFocus(
  opportunity: CoachingOpportunity,
): ReviewFocus | null {
  return (
    opportunity.focus ??
    (opportunity.spellId
      ? { spellId: opportunity.spellId }
      : opportunity.destination === 'survival'
        ? { defensiveOnly: true }
        : null)
  );
}
