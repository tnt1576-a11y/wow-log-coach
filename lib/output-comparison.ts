import type { AnalysisResult, RunMetrics } from './domain';
import { damageFamilies } from './spell-families';
import { quantile } from './statistics';

function outputPerCast(metrics: RunMetrics, id: number): number | null {
  const uses = metrics.casts?.find((cast) => cast.id === id)?.uses;
  const total = damageFamilies(metrics.abilities).get(id)?.total;
  // No cast or damage record is unknown, not a zero-output cast.
  if (
    !uses ||
    !Number.isFinite(uses) ||
    uses < 0 ||
    total === undefined ||
    !Number.isFinite(total) ||
    total < 0
  )
    return null;
  return total / uses;
}

export function compareOutputPerCast(result: AnalysisResult, id: number) {
  const values = result.references.flatMap((reference) => {
    const value = reference.metrics
      ? outputPerCast(reference.metrics, id)
      : null;
    return value === null ? [] : [value];
  });
  const target = outputPerCast(result.targetMetrics, id);
  return {
    target,
    median: values.length ? quantile(values, 0.5) : null,
    p25: values.length ? quantile(values, 0.25) : null,
    p75: values.length ? quantile(values, 0.75) : null,
    sampleSize: values.length,
    usable: target !== null && values.length >= 8,
  };
}
