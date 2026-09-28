import type { AnalysisResult, SpellComparison } from './domain';
import { defensiveSpell, type ReviewFocus } from './defensives';

export interface DamageDriver {
  spell: SpellComparison;
  difference: number;
  percent: number;
  lowerFrequency: boolean;
  hasCastComparison: boolean;
  explanation: string;
  check: string;
}
export interface ReviewTask {
  id: string;
  title: string;
  observation: string;
  check: string;
  destination: 'abilities' | 'timeline' | 'survival' | 'gear';
  spellName?: string;
  focus?: ReviewFocus;
}
const n = (value: number) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);

export function buildDiagnosis(result: AnalysisResult) {
  const overall = result.metrics.find((metric) => metric.id === 'dps');
  const sufficient =
    result.cohort.actualSize >= 8 && (overall?.sampleSize ?? 0) >= 8;
  const deficit =
    overall && overall.median > 0
      ? ((overall.median - overall.target) / overall.median) * 100
      : null;
  const drivers: DamageDriver[] = sufficient
    ? (result.spells ?? [])
        .filter(
          (spell) =>
            spell.damage.sampleSize >= 8 &&
            spell.damage.median > 0 &&
            spell.damage.target < spell.damage.median &&
            spell.damage.median - spell.damage.target >=
              (overall?.median ?? 0) * 0.003 &&
            !defensiveSpell(spell.id),
        )
        .map((spell) => {
          const hasCastComparison =
            spell.casts.sampleSize >= 8 &&
            spell.referenceUsers >= 8 &&
            spell.casts.median > 0;
          const lowerFrequency =
            hasCastComparison &&
            spell.casts.target < spell.casts.p25 &&
            spell.casts.target < spell.casts.median * 0.85;
          return {
            spell,
            difference: spell.damage.median - spell.damage.target,
            percent: (1 - spell.damage.target / spell.damage.median) * 100,
            hasCastComparison,
            lowerFrequency,
            explanation: lowerFrequency
              ? 'Lower output and fewer casts per minute appear together.'
              : hasCastComparison
                ? 'Output is lower, without a clear cast-frequency shortfall.'
                : 'This damage effect has no reliable matching cast comparison.',
            check: lowerFrequency
              ? 'Check its use during your pulls. Confirm the same talent/build and spell replacement before treating this as missed casts.'
              : hasCastComparison
                ? 'Check target count, buffs, timing, talents and equipment. Casting more is not established as the fix.'
                : 'Inspect the ability or pet that generates this damage, plus talents and buffs. Do not treat this effect as a button you should press.',
          };
        })
        .sort((a, b) => b.difference - a.difference)
        .slice(0, 6)
    : [];
  const lowerBuffs = sufficient
    ? (result.buffComparisons ?? [])
        .filter(
          (buff) =>
            buff.sampleSize >= 8 &&
            buff.median - buff.target >= 10 &&
            buff.target < buff.p25,
        )
        .sort((a, b) => b.median - b.target - (a.median - a.target))
        .slice(0, 3)
    : [];
  const lowerCasts = sufficient
    ? (result.spells ?? [])
        .filter(
          (spell) =>
            !defensiveSpell(spell.id) &&
            spell.referenceUsers >= 8 &&
            spell.casts.sampleSize >= 8 &&
            spell.casts.median > 0.1 &&
            spell.casts.target < spell.casts.p25 &&
            spell.casts.target < spell.casts.median * 0.85,
        )
        .sort(
          (a, b) =>
            b.casts.median - b.casts.target - (a.casts.median - a.casts.target),
        )
        .slice(0, 4)
    : [];
  const tasks: ReviewTask[] = [];
  if (sufficient) {
    if ((result.targetMetrics.deaths ?? 0) > 0)
      tasks.push({
        id: 'survival',
        title: 'Review deaths before changing your rotation',
        observation:
          n(result.targetMetrics.deaths) +
          ' deaths were recorded. The damage lost while dead is not quantified here.',
        check:
          'Inspect the damage leading into each death and the timing of personal defensives, group defensives and recovery casts separately.',
        destination: 'survival',
      });
    const priorityDriver = drivers.find(
      (driver) =>
        driver.spell.damage.target < driver.spell.damage.p25 &&
        driver.percent >= 10,
    );
    if (priorityDriver) {
      const driver = priorityDriver;
      tasks.push({
        id: 'damage-' + driver.spell.id,
        title: 'Investigate ' + driver.spell.name + ' output',
        observation:
          n(driver.percent) +
          '% less DPS from this spell than its reference median. ' +
          driver.explanation,
        check: driver.check,
        destination: 'abilities',
        spellName: driver.spell.name,
      });
    }
    const gap = result.evidence?.castsComplete
      ? result.evidence.gaps[0]
      : undefined;
    if (gap && gap.end - gap.start >= 8)
      tasks.push({
        id: 'gap',
        title: 'Inspect a long gap in pull ' + gap.pullId,
        observation:
          n(gap.end - gap.start) +
          ' seconds between completed casts in ' +
          gap.pullName +
          '.',
        check:
          'Look for a channel, mechanic, stun, movement or death. Only after ruling those out should you treat it as avoidable downtime.',
        destination: 'timeline',
        focus: { pullId: gap.pullId, time: Math.max(0, gap.start - 3) },
      });
    if (
      lowerCasts[0] &&
      !drivers.some((driver) => driver.spell.id === lowerCasts[0].id)
    ) {
      const spell = lowerCasts[0];
      tasks.push({
        id: 'casts-' + spell.id,
        title: 'Check ' + spell.name + ' frequency',
        observation:
          n(spell.casts.target) +
          ' casts/min versus ' +
          n(spell.casts.median) +
          ' reference median.',
        check:
          'Compare the same talent build and pull opportunities. This is a frequency difference, not a count of available cooldowns you missed.',
        destination: 'abilities',
        spellName: spell.name,
      });
    }
    if (tasks.length < 4 && lowerBuffs[0])
      tasks.push({
        id: 'buff-' + lowerBuffs[0].id,
        title: 'Check ' + lowerBuffs[0].label + ' uptime',
        observation:
          n(lowerBuffs[0].target) +
          '% uptime versus ' +
          n(lowerBuffs[0].median) +
          '% reference median.',
        check:
          'Determine whether this buff came from you, another player or equipment. Lower uptime is not automatically your mistake.',
        destination: 'abilities',
        spellName: lowerBuffs[0].label,
      });
  }
  return {
    overall,
    sufficient,
    deficit,
    drivers,
    lowerBuffs,
    lowerCasts,
    tasks: tasks.slice(0, 4),
  };
}
