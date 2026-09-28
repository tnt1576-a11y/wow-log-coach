import type { AnalysisResult } from './domain';
import type { ReviewFocus } from './defensives';
import type { GuideCheck, GuideLesson } from './guides/types';
import { arcaneLessons } from './arcane/lessons';
import { fireLessons } from './fire/lessons';
import { frostLessons } from './frost/lessons';
import { guidePackFor } from './guides/registry';
import { coachingOpportunities, positiveSignals } from './coaching';
import { buildDiagnosis } from './diagnosis';

export type BriefMoment = { time: number; detail: string; spellId?: number };
export type BriefPriority = {
  id: string;
  category: 'Survival' | 'Rotation' | 'Activity' | 'Comparison';
  title: string;
  observation: string;
  action: string;
  verify: string;
  basis: 'Logged event' | 'Guide check' | 'Reference difference';
  moments: BriefMoment[];
  destination: string;
  spellName?: string;
  focus?: ReviewFocus;
  eligible?: number;
};

// One adapter for every supported spec. Keep each pack's talent, season and
// completeness gates intact; an educational branch is never a scored finding.
function specReview(result: AnalysisResult): {
  checks: GuideCheck[];
  lessons: GuideLesson[];
  destination: string;
  hero?: string;
} {
  if (result.target.contentType === 'raid')
    return { checks: [], lessons: [], destination: 'cooldowns' };
  if (result.target.className === 'Mage') {
    if (result.target.specName === 'Arcane') {
      const review = arcaneLessons(result);
      return {
        ...review,
        hero: review.build.hero.value,
        destination: 'arcane',
      };
    }
    if (result.target.specName === 'Fire')
      return { ...fireLessons(result), destination: 'fire' };
    if (result.target.specName === 'Frost')
      return { ...frostLessons(result), destination: 'frost' };
  }
  const pack = guidePackFor(result);
  return pack
    ? { ...pack.review(result), destination: 'spec-guide' }
    : { checks: [], lessons: [], destination: 'coach' };
}

export function buildRunBrief(result: AnalysisResult) {
  const review = specReview(result);
  const diagnosis = buildDiagnosis(result);
  const evidence = result.evidence;
  const priorities: BriefPriority[] = [];
  const deaths = evidence?.deaths ?? [];
  const deathCount = Math.max(result.targetMetrics.deaths, deaths.length);
  if (deathCount > 0)
    priorities.push({
      id: 'death-review',
      category: 'Survival',
      title: 'Start with the deaths',
      observation: `${deathCount} ${deathCount === 1 ? 'death was' : 'deaths were'} recorded. Review the damage and healing before changing your rotation.`,
      action:
        'Pick one dangerous mechanic and decide how you will handle it before the next pull.',
      verify:
        'Check positioning, healing, assigned duties and defensive availability. A death does not prove a missed defensive.',
      basis: 'Logged event',
      destination: 'survival',
      moments: deaths.map((death) => ({
        time: death.time,
        detail: `Killing blow: ${death.name}. Review the preceding ${death.window}s.`,
      })),
    });
  for (const lesson of [...review.lessons].sort(
    (a, b) => b.check.moments.length - a.check.moments.length,
  )) {
    if (lesson.check.status !== 'review' || !lesson.check.moments.length)
      continue;
    priorities.push({
      id: 'spec-' + lesson.id,
      category: 'Rotation',
      title: lesson.title,
      observation: `${lesson.check.moments.length} review ${lesson.check.moments.length === 1 ? 'moment' : 'moments'} across ${lesson.check.eligible} eligible observations. ${lesson.why}`,
      action: lesson.tryNext,
      verify: lesson.verify,
      basis: 'Guide check',
      moments: lesson.check.moments,
      eligible: lesson.check.eligible,
      destination: review.destination,
    });
  }
  // Cast gaps are meaningful only with complete events and inside a known pull.
  const gaps = evidence?.castsComplete
    ? evidence.gaps.filter(
        (gap) =>
          gap.end > gap.start &&
          evidence.pulls.some(
            (pull) =>
              pull.id === gap.pullId &&
              gap.start >= pull.start &&
              gap.end <= pull.end,
          ),
      )
    : [];
  if (gaps.length)
    priorities.push({
      id: 'cast-gaps',
      category: 'Activity',
      title: 'Explain the pauses inside pulls',
      observation: `${gaps.length} recorded cast ${gaps.length === 1 ? 'gap' : 'gaps'}; the longest is ${Math.max(...gaps.map((gap) => gap.end - gap.start)).toFixed(1)}s.`,
      action:
        'Review the longest pause. If movement caused it, plan your position or a usable instant cast before that mechanic.',
      verify:
        'Channels, deaths, mechanics and unavailable targets can explain a pause. These seconds are not automatically wasted time.',
      basis: 'Logged event',
      destination: 'timeline',
      moments: [...gaps]
        .sort((a, b) => b.end - b.start - (a.end - a.start))
        .map((gap) => ({
          time: gap.start,
          detail: `${(gap.end - gap.start).toFixed(1)}s between recorded casts. Check what happened before resuming.`,
        })),
    });
  for (const task of coachingOpportunities(result)) {
    if (task.category === 'survival' || task.category === 'activity') continue;
    priorities.push({
      id: 'comparison-' + task.id,
      category: 'Comparison',
      title: task.title,
      observation: task.observation,
      action: task.check,
      verify:
        'This compares different runs. Pull size, gear, talents, external buffs and group strategy can explain the difference; it is not measured recoverable DPS.',
      basis: 'Reference difference',
      destination: task.destination,
      spellName: task.spellName,
      focus: task.focus,
      moments: [],
    });
  }
  const checked = review.checks.filter(
    (check) => check.status === 'observed' || check.status === 'review',
  );
  const unavailable = review.checks.filter(
    (check) => check.status === 'unavailable',
  );
  return {
    priorities,
    diagnosis,
    hero: review.hero,
    guideDestination: review.destination,
    hasGuide: review.checks.length > 0,
    checked,
    unavailable,
    strengths: positiveSignals(result),
    pulls: (evidence?.pulls ?? []).map((pull) => ({
      ...pull,
      // Count distinct timestamps, not stacked flags for the same cast.
      moments: new Set(
        priorities
          .flatMap((priority) => priority.moments)
          .filter(
            (moment) => moment.time >= pull.start && moment.time < pull.end,
          )
          .map((moment) => moment.time),
      ).size,
      deaths: deaths.filter(
        (death) => death.time >= pull.start && death.time < pull.end,
      ).length,
    })),
  };
}

export function briefPracticeText(
  result: AnalysisResult,
  priority: BriefPriority,
) {
  return `${result.target.player} — ${result.target.specName} — ${result.target.dungeon} +${result.target.keyLevel}\nNext run: ${priority.title}\nTry: ${priority.action}\nCheck first: ${priority.verify}\nEvidence: ${priority.observation}\nReview priority, not a prediction of DPS gained.`;
}
