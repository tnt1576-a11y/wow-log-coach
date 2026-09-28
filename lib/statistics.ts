import type { Finding, MetricDistribution, RunMetrics } from './domain';

export function quantile(values: number[], percentile: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function percentileRank(
  values: number[],
  target: number,
  direction: MetricDistribution['direction'],
): number {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return 0;
  const atOrBelow = finite.filter((value) => value <= target).length;
  const rank = (atOrBelow / finite.length) * 100;
  if (direction === 'lower')
    return (
      (finite.filter((value) => value >= target).length / finite.length) * 100
    );
  return rank;
}

export function distribution(
  id: string,
  label: string,
  unit: MetricDistribution['unit'],
  direction: MetricDistribution['direction'],
  target: number,
  values: number[],
): MetricDistribution {
  return {
    id,
    label,
    unit,
    direction,
    target,
    median: quantile(values, 0.5),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    targetPercentile: percentileRank(values, target, direction),
    sampleSize: values.length,
    nonZeroCount: values.filter((value) => value > 0).length,
  };
}

export function buildDistributions(
  target: RunMetrics,
  references: RunMetrics[],
): MetricDistribution[] {
  const definitions: Array<{
    id: keyof Pick<
      RunMetrics,
      | 'dps'
      | 'activeDps'
      | 'castsPerMinute'
      | 'interrupts'
      | 'deaths'
      | 'damageTakenPerSecond'
    >;
    label: string;
    unit: MetricDistribution['unit'];
    direction: MetricDistribution['direction'];
  }> = [
    { id: 'dps', label: 'Overall DPS', unit: 'damage', direction: 'higher' },
    {
      id: 'castsPerMinute',
      label: 'Casts per minute',
      unit: 'perMinute',
      direction: 'higher',
    },
    {
      id: 'interrupts',
      label: 'Interrupts',
      unit: 'number',
      direction: 'higher',
    },
    { id: 'deaths', label: 'Deaths', unit: 'number', direction: 'lower' },
    {
      id: 'damageTakenPerSecond',
      label: 'Damage taken / sec',
      unit: 'damage',
      direction: 'lower',
    },
  ];

  return definitions.map((definition) =>
    distribution(
      definition.id,
      definition.label,
      definition.unit,
      definition.direction,
      target[definition.id],
      references.map((reference) => reference[definition.id]),
    ),
  );
}

export function buildFindings(metrics: MetricDistribution[]): Finding[] {
  return metrics
    .filter(
      (metric) => metric.sampleSize >= 8 && metric.direction !== 'context',
    )
    .map((metric): Finding | null => {
      const median = metric.median;
      const rawDelta =
        median === 0
          ? null
          : ((metric.target - median) / Math.abs(median)) * 100;
      const effectiveDelta = rawDelta ?? (metric.target > 0 ? 100 : 0);
      const beneficialDelta =
        metric.direction === 'lower' ? -effectiveDelta : effectiveDelta;
      const confidence: Finding['confidence'] =
        metric.sampleSize >= 15 ? 'high' : 'medium';

      if (beneficialDelta >= 10 && metric.targetPercentile >= 70) {
        return {
          id: metric.id + '-positive',
          category: categoryFor(metric.id),
          severity: 'positive',
          confidence,
          title: metric.label + ' compares favorably',
          detail:
            'Your result compares favorably with the reference median. Route, gear, group support, and assignments can affect this difference.',
          targetValue: metric.target,
          medianValue: median,
          deltaPercent: rawDelta,
          metricId: metric.id,
        };
      }

      const outsideTypicalRange =
        metric.direction === 'lower'
          ? metric.target > metric.p75
          : metric.target < metric.p25;
      if (!outsideTypicalRange || beneficialDelta > -10) return null;

      const major = beneficialDelta <= -20 && metric.targetPercentile <= 20;
      return {
        id: metric.id + '-opportunity',
        category: categoryFor(metric.id),
        severity: major ? 'major' : 'moderate',
        confidence,
        title:
          metric.label +
          (metric.direction === 'lower'
            ? ' is above the typical range'
            : ' is below the typical range'),
        detail: findingDetail(metric),
        targetValue: metric.target,
        medianValue: median,
        deltaPercent: rawDelta,
        metricId: metric.id,
      };
    })
    .filter((finding): finding is Finding => finding !== null)
    .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    .slice(0, 8);
}

function findingDetail(metric: MetricDistribution): string {
  switch (metric.id) {
    case 'castsPerMinute':
      return 'Your cast activity is below the middle 50% of comparable players. Review idle gaps and movement planning before changing spell priority.';
    case 'interrupts':
      return 'Your interrupt count is below the typical comparison range. Check whether the route assigned interrupts differently before treating this as a missed mechanic.';
    case 'deaths':
      return 'You died more often than the typical comparison player. Review the incoming-damage timeline and defensive availability around each death.';
    case 'damageTakenPerSecond':
      return 'You took more damage per second than the typical range. This is a candidate positioning or defensive issue, not proof that every extra hit was avoidable.';
    default:
      return 'Your result is outside the typical range for the selected top players. Use the ability and context tables to identify the responsible windows.';
  }
}

function categoryFor(metricId: string): Finding['category'] {
  if (metricId === 'dps' || metricId === 'activeDps') return 'damage';
  if (metricId === 'castsPerMinute') return 'rotation';
  if (metricId === 'interrupts') return 'utility';
  if (metricId === 'deaths' || metricId === 'damageTakenPerSecond')
    return 'survival';
  return 'context';
}

function severityOrder(severity: Finding['severity']): number {
  return { major: 0, moderate: 1, positive: 2, info: 3 }[severity];
}
