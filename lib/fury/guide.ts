import { castDecisionTime } from '../cast-sequence';
import type { AnalysisResult } from '../domain';
import { auraStacksBefore, closedGuideAuraWindows } from '../guides/aura';
import type {
  GuideCheck,
  GuideLesson,
  GuideMoment,
  GuidedSpecPack,
} from '../guides/types';
import { FURY, FURY_CORE_CASTS, FURY_GUIDE } from './catalog';

function buildFuryChecks(result: AnalysisResult) {
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === FURY_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === FURY_GUIDE.partitionId;
  const castCoverage = evidence?.castsComplete === true;
  const stateCoverage =
    evidence?.guide?.specName === 'Fury' && evidence.guide.complete;
  const baseBlock = !seasonMatches
    ? 'This Fury ruleset is reviewed for the 12.1 Season 2 partition only.'
    : !castCoverage
      ? 'Complete cast events are required.'
      : !evidence?.pulls.length
        ? 'Pull boundaries are required.'
        : null;
  const stateBlock =
    baseBlock ??
    (!stateCoverage ? 'Complete Fury self-buff events are required.' : null);
  const casts = (evidence?.casts ?? []).filter((cast) =>
    evidence?.pulls.some(
      (pull) =>
        castDecisionTime(cast) >= pull.start &&
        castDecisionTime(cast) < pull.end,
    ),
  );
  const checks: GuideCheck[] = [];
  function add(
    id: string,
    title: string,
    block: string | null,
    eligible: number,
    moments: GuideMoment[],
    detail: string,
    empty: GuideCheck['status'] = 'unavailable',
  ) {
    checks.push({
      id,
      title,
      status: block
        ? 'unavailable'
        : !eligible
          ? empty
          : moments.length
            ? 'review'
            : 'observed',
      detail: block ?? detail,
      eligible: block ? 0 : eligible,
      moments: block ? [] : moments,
    });
  }

  const coreCasts = casts.filter((cast) => FURY_CORE_CASTS.has(cast.id));
  const enragedCasts = coreCasts.filter(
    (cast) =>
      auraStacksBefore(
        result,
        'Fury',
        FURY.enrage,
        castDecisionTime(cast),
      ) > 0,
  );
  const enrageObserved =
    evidence?.guide?.auras.some((event) => event.id === FURY.enrage) ?? false;
  add(
    'enrage-coverage',
    'Core actions during Enrage',
    stateBlock ??
      (!enrageObserved ? 'No Enrage state was recorded in this run.' : null),
    coreCasts.length,
    [],
    'Descriptive coverage across Rampage, Execute, Bloodthirst, Raging Blow, Thunder Blast, and Thunder Clap. Rage and cooldown readiness are required before calling an outside-Enrage cast avoidable.',
    'not-applicable',
  );

  const suddenWindows = closedGuideAuraWindows(
    result,
    'Fury',
    FURY.suddenDeath,
  );
  const missedSudden = suddenWindows.flatMap((window): GuideMoment[] =>
    casts.some(
      (cast) =>
        cast.id === FURY.execute &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end + 0.2,
    )
      ? []
      : [
          {
            time: window.end,
            spellId: FURY.execute,
            detail:
              'This complete Sudden Death window ended without a recorded Execute. Confirm melee access, cooldown state, target availability, and same-timestamp consumption.',
          },
        ],
  );
  add(
    'sudden-death',
    'Sudden Death converted into Execute',
    stateBlock,
    suddenWindows.length,
    missedSudden,
    'Pairs complete Sudden Death proc windows with Execute. It does not claim the miss was avoidable without cooldown and target-uptime evidence.',
    'not-applicable',
  );

  const thunderWindows = closedGuideAuraWindows(
    result,
    'Fury',
    FURY.thunderBlastReady,
  );
  const missedThunder = thunderWindows.flatMap((window): GuideMoment[] =>
    casts.some(
      (cast) =>
        cast.id === FURY.thunderBlast &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end + 0.2,
    )
      ? []
      : [
          {
            time: window.end,
            spellId: FURY.thunderBlast,
            detail:
              'This complete Thunder Blast ready window ended without a recorded Thunder Blast. Confirm target access, priority changes, and same-timestamp consumption.',
          },
        ],
  );
  add(
    'thunder-blast',
    'Thunder Blast ready window converted',
    stateBlock,
    thunderWindows.length,
    missedThunder,
    'Pairs complete ready windows with Thunder Blast. Target count changes its priority, so response speed is comparison context.',
    'not-applicable',
  );

  const thunderEvents = (evidence?.guide?.specName === 'Fury'
    ? evidence.guide.auras
    : []
  )
    .filter((event) => event.id === FURY.thunderBlastReady)
    .sort((a, b) => a.time - b.time);
  let priorStacks: number | null = null;
  let explicitTransitions = 0;
  const capPressure: GuideMoment[] = [];
  for (const event of thunderEvents) {
    if (event.type === 'removebuff') {
      priorStacks = 0;
      continue;
    }
    if (event.stacks === null) continue;
    if (
      event.type === 'applybuff' ||
      event.type === 'applybuffstack' ||
      event.type === 'refreshbuff'
    ) {
      if (priorStacks !== null) {
        explicitTransitions++;
        if (priorStacks >= 2 && event.stacks >= 2)
          capPressure.push({
            time: event.time,
            spellId: FURY.thunderBlast,
            detail:
              'A new recorded Thunder Blast application arrived while the prior explicit state was already at two stacks. Review whether room could have been made.',
          });
      }
      priorStacks = event.stacks;
    } else priorStacks = event.stacks;
  }
  add(
    'thunder-cap',
    'Thunder Blast two-stack pressure',
    stateBlock,
    explicitTransitions,
    capPressure,
    'Requires explicit stack transitions. Target count and priority can justify holding at cap briefly; this is not an instant-use rule.',
    'not-applicable',
  );

  const recklessnessWindows = closedGuideAuraWindows(
    result,
    'Fury',
    FURY.recklessness,
  );
  const rampagesByWindow = recklessnessWindows.map((window) => ({
    ...window,
    count: casts.filter(
      (cast) =>
        cast.id === FURY.rampage &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end + 0.2,
    ).length,
  }));
  add(
    'recklessness-rampage',
    'Recklessness produced Rampage casts',
    stateBlock,
    rampagesByWindow.length,
    rampagesByWindow.flatMap((window): GuideMoment[] =>
      window.count > 0
        ? []
        : [
            {
              time: window.start,
              spellId: FURY.rampage,
              detail:
                'No Rampage was recorded in this complete Recklessness window. Inspect Rage, mechanics, melee uptime, and whether the window source was manual.',
            },
          ],
    ),
    'Flags only complete Recklessness windows with zero Rampage. Exact opportunity count cannot be inferred without Rage and cooldown state.',
    'not-applicable',
  );

  const averageRampages = rampagesByWindow.length
    ? rampagesByWindow.reduce((sum, item) => sum + item.count, 0) /
      rampagesByWindow.length
    : null;
  return {
    checks,
    seasonMatches,
    castCoverage,
    stateCoverage,
    summaries: [
      {
        label: 'Enrage coverage',
        value: coreCasts.length
          ? ((enragedCasts.length / coreCasts.length) * 100).toFixed(0) + '%'
          : '-',
        note: 'recorded core actions',
      },
      {
        label: 'Sudden Death',
        value:
          suddenWindows.length - missedSudden.length +
          ' / ' +
          suddenWindows.length,
        note: 'complete procs converted',
      },
      {
        label: 'Thunder Blast',
        value:
          thunderWindows.length - missedThunder.length +
          ' / ' +
          thunderWindows.length,
        note: 'ready windows converted',
      },
      {
        label: 'Recklessness',
        value: averageRampages === null ? '-' : averageRampages.toFixed(1),
        note: 'average Rampages per window',
      },
    ],
  };
}

const LESSONS: Record<string, Omit<GuideLesson, 'id' | 'check'>> = {
  'sudden-death': {
    title: 'Convert Sudden Death before it ends',
    short: 'Sudden Death usage',
    why: 'A complete Sudden Death aura is a finite recorded opportunity for Execute.',
    tryNext: 'Track Sudden Death prominently and identify a reachable target before the proc expires.',
    verify: 'Confirm Execute readiness, melee access, target availability, and same-timestamp aura removal.',
    spellId: FURY.execute,
    sequence: [FURY.suddenDeath, FURY.execute],
  },
  'thunder-blast': {
    title: 'Convert the Thunder Blast ready window',
    short: 'Thunder Blast conversion',
    why: 'The observed ready aura creates a concrete opportunity even though target count changes its exact priority.',
    tryNext: 'Track Thunder Blast charges and choose the next valid target before the ready window expires.',
    verify: 'Confirm target count, movement, melee/ranged access, and same-timestamp consumption.',
    spellId: FURY.thunderBlast,
    sequence: [FURY.thunderClap, FURY.thunderBlast],
  },
  'thunder-cap': {
    title: 'Review Thunder Blast at two stacks',
    short: 'Thunder Blast cap pressure',
    why: 'A new application while the explicit state remains at two stacks can indicate lost room for another proc.',
    tryNext: 'At two charges, look for the next high-value Thunder Blast before another generator can add a stack.',
    verify: 'Confirm event ordering, target count, Avatar state, and whether the logged application actually overwrote a charge.',
    spellId: FURY.thunderBlast,
    sequence: [FURY.thunderBlast, FURY.thunderClap],
  },
  'recklessness-rampage': {
    title: 'Review an empty Recklessness window',
    short: 'Recklessness package',
    why: 'A complete Recklessness window with zero Rampage is unusual enough to inspect, but Rage determines whether casts were available.',
    tryNext: 'Enter Recklessness with a deliberate Rage plan and watch for the first Rampage opportunity.',
    verify: 'Confirm Rage history, Anger Management, mechanics, melee uptime, and how the window was triggered.',
    spellId: FURY.rampage,
    sequence: [FURY.recklessness, FURY.rampage],
  },
};

export function buildFuryReview(result: AnalysisResult) {
  const review = buildFuryChecks(result);
  const lessons = review.checks
    .filter((check) => check.status === 'review' && LESSONS[check.id])
    .map((check) => ({ ...LESSONS[check.id], id: check.id, check }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return { ...review, lessons };
}

export const furyGuidePack: GuidedSpecPack = {
  className: 'Warrior',
  specName: 'Fury',
  slug: 'fury-warrior',
  source: FURY_GUIDE,
  limitation:
    'Rage, cooldown/charge readiness, target count, target attackability, melee range, tier-set state, immunity, and forced downtime are not reconstructed. The coach never invents missed Rampage, Execute, or cooldown opportunities from base cooldowns.',
  notes: [
    'Enrage coverage is descriptive across recorded core actions; outside-Enrage casts are not automatically mistakes.',
    'Sudden Death and Thunder Blast checks require complete observed ready windows and exclude open windows, deaths, and pull endings.',
    'Thunder Blast cap pressure requires explicit stack events and remains target-count-sensitive.',
    'Recklessness flags only complete windows with zero Rampage; exact missed-use counts require Rage snapshots.',
  ],
  review: buildFuryReview,
};
