import { castDecisionTime } from '../cast-sequence';
import type { AnalysisResult } from '../domain';
import { closedGuideAuraWindows } from '../guides/aura';
import type {
  GuideCheck,
  GuideLesson,
  GuideMoment,
  GuidedSpecPack,
} from '../guides/types';
import { WINDWALKER, WINDWALKER_CORE_CASTS, WINDWALKER_GUIDE } from './catalog';

export function buildWindwalkerReview(result: AnalysisResult) {
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === WINDWALKER_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === WINDWALKER_GUIDE.partitionId;
  const castCoverage = evidence?.castsComplete === true;
  const stateCoverage =
    evidence?.guide?.specName === 'Windwalker' && evidence.guide.complete;
  const baseBlock = !seasonMatches
    ? 'This guide is reviewed for the 12.1 Season 2 partition.'
    : !castCoverage
      ? 'Complete cast events are required.'
      : !evidence?.pulls.length
        ? 'Pull boundaries are required.'
        : null;
  const stateBlock =
    baseBlock ??
    (!stateCoverage
      ? 'Complete Windwalker self-buff events are required.'
      : null);
  const checks: GuideCheck[] = [];
  function add(
    id: string,
    title: string,
    block: string | null,
    eligible: number,
    moments: GuideMoment[],
    detail: string,
  ) {
    checks.push({
      id,
      title,
      status: block
        ? 'unavailable'
        : !eligible
          ? 'not-applicable'
          : moments.length
            ? 'review'
            : 'observed',
      detail: block ?? detail,
      eligible: block ? 0 : eligible,
      moments: block ? [] : moments,
    });
  }

  // Success events are already separated from begin events by parseEvidence.
  // Never join sequences across pulls or discard unknown intervening actions.
  let pairs = 0;
  const repeats: GuideMoment[] = [];
  for (const pull of evidence?.pulls ?? []) {
    const casts = (evidence?.casts ?? [])
      .filter(
        (cast) =>
          castDecisionTime(cast) >= pull.start &&
          castDecisionTime(cast) < pull.end,
      )
      .sort((a, b) => castDecisionTime(a) - castDecisionTime(b));
    for (let index = 1; index < casts.length; index++) {
      const previous = casts[index - 1],
        current = casts[index];
      const time = castDecisionTime(current),
        previousTime = castDecisionTime(previous);
      if (
        !WINDWALKER_CORE_CASTS.has(previous.id) ||
        !WINDWALKER_CORE_CASTS.has(current.id) ||
        time - previousTime < 0.25 ||
        time - previousTime > 10 ||
        evidence?.deaths.some(
          (death) => death.time >= previousTime && death.time <= time,
        )
      )
        continue;
      pairs++;
      if (previous.id === current.id)
        repeats.push({
          time,
          spellId: current.id,
          detail:
            current.name +
            ' was the same as the immediately preceding recorded core cast (' +
            (time - previousTime).toFixed(1) +
            's earlier). Review Combo Strikes and the available alternatives at this moment.',
        });
    }
  }
  add(
    'combo-repeat',
    'Consecutive repeats of core attacks',
    baseBlock,
    pairs,
    repeats,
    'Reviews adjacent manual core casts within ten seconds. Utility, unknown actions, pull transitions, deaths, and ambiguous duplicate timestamps interrupt the comparison. This is a review cue, not a quantified DPS loss or complete mastery audit.',
  );

  const danceWindows = closedGuideAuraWindows(
    result,
    'Windwalker',
    WINDWALKER.danceOfChiJi,
  ).filter(
    (window) =>
      evidence?.guide?.auras.some(
        (event) =>
          event.id === WINDWALKER.danceOfChiJi &&
          event.time === window.start &&
          event.type === 'applybuff',
      ) &&
      !evidence?.deaths.some(
        (death) => death.time >= window.start && death.time <= window.end,
      ),
  );
  const unusedDance = danceWindows.flatMap((window): GuideMoment[] =>
    evidence?.casts.some(
      (cast) =>
        cast.id === WINDWALKER.spinningCraneKick &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end + 0.2,
    )
      ? []
      : [
          {
            time: window.end,
            spellId: WINDWALKER.spinningCraneKick,
            detail:
              'This complete Dance of Chi-Ji window ended with no Spinning Crane Kick recorded. Check target access, movement, and the aura removal before treating it as an unused opportunity.',
          },
        ],
  );
  add(
    'dance-conversion',
    'Dance windows with Spinning Crane Kick',
    stateBlock,
    danceWindows.length,
    unusedDance,
    'Checks whether at least one Spinning Crane Kick occurred during a complete observed Dance window. Dance can hold two stacks; one cast does not prove every charge was used. Open, pull-ending, and death-ending windows are excluded.',
  );

  const definitions: Record<string, Omit<GuideLesson, 'id' | 'check'>> = {
    'combo-repeat': {
      title: 'Review consecutive core attacks',
      short: 'Combo Strikes decisions',
      why: 'Combo Strikes rewards changing your damaging ability. These moments show a repeated core action that deserves a closer look.',
      tryNext:
        'Before repeating a core attack, check the next available different attack and your Chi. Practice alternating without delaying a more valuable action.',
      verify:
        'Confirm the cast sequence, resources, procs, and target access. Repeating can still be a deliberate priority choice; the report cannot calculate that tradeoff.',
      spellId: WINDWALKER.blackoutKick,
    },
    'dance-conversion': {
      title: 'Review unused Dance windows',
      short: 'Dance of Chi-Ji usage',
      why: 'A complete Dance window with no Spinning Crane Kick is a concrete place to inspect proc handling.',
      tryNext:
        'Make Dance stacks visible and plan a Spinning Crane Kick before a usable proc window ends.',
      verify:
        'Confirm target access and whether removal was expiration, death, or another event. A cast within the window does not prove all stacks were consumed.',
      spellId: WINDWALKER.spinningCraneKick,
      sequence: [WINDWALKER.danceOfChiJi, WINDWALKER.spinningCraneKick],
    },
  };
  const lessons = checks
    .filter((check) => check.status === 'review')
    .map((check) => ({
      ...definitions[check.id],
      spellId: check.moments[0]?.spellId ?? definitions[check.id].spellId,
      id: check.id,
      check,
    }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return {
    checks,
    lessons,
    seasonMatches,
    castCoverage,
    stateCoverage,
    summaries: [
      {
        label: 'Core cast pairs',
        value: baseBlock ? '-' : String(pairs),
        note: 'adjacent verified actions',
      },
      {
        label: 'Repeated attacks',
        value: baseBlock ? '-' : String(repeats.length),
        note: 'moments to inspect',
      },
      {
        label: 'Dance windows',
        value: stateBlock ? '-' : String(danceWindows.length),
        note: 'complete observed windows',
      },
      {
        label: 'Dance follow-through',
        value: stateBlock
          ? '-'
          : danceWindows.length -
            unusedDance.length +
            ' / ' +
            danceWindows.length,
        note: 'windows with at least one SCK',
      },
    ],
  };
}

export const windwalkerGuidePack: GuidedSpecPack = {
  className: 'Monk',
  specName: 'Windwalker',
  slug: 'windwalker-monk',
  source: WINDWALKER_GUIDE,
  limitation:
    'Chi, Energy, target count, cooldown readiness, full hero/talent loadout, tier bonuses, and target attackability are not reconstructed. Core-repeat coverage is deliberately limited to adjacent verified casts. No fixed cooldown-use or channel-length verdict is applied.',
  notes: [
    'Core-repeat review applies to both hero trees and does not require Hit Combo to be talented.',
    'Dance review activates only from recorded proc windows. It measures windows containing a cast, not individual charges consumed.',
    'Season 2 four-piece and hero-specific priorities require additional state; this pack does not infer them from equipped item level.',
  ],
  review: buildWindwalkerReview,
};
