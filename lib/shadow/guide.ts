import { castDecisionTime } from '../cast-sequence';
import type { AnalysisResult } from '../domain';
import type {
  GuideCheck,
  GuideLesson,
  GuideMoment,
  GuidedSpecPack,
} from '../guides/types';
import { SHADOW, SHADOW_GUIDE } from './catalog';

type AuraWindow = { start: number; end: number; pullId: number };

function stateWindows(result: AnalysisResult, auraId: number): AuraWindow[] {
  const evidence = result.evidence;
  if (!evidence?.guide?.complete || evidence.guide.specName !== 'Shadow')
    return [];
  const events = evidence.guide.auras
    .filter((event) => event.id === auraId)
    .sort((a, b) => a.time - b.time);
  const windows: Array<{ start: number; end: number; closed: boolean }> = [];
  let start: number | null = null;
  for (const event of events) {
    if (event.type === 'removebuff') {
      if (start !== null && event.time > start)
        windows.push({ start, end: event.time, closed: true });
      start = null;
    } else if (start === null) start = event.time;
  }
  if (start !== null)
    windows.push({ start, end: evidence.duration, closed: false });
  return windows.flatMap((window): AuraWindow[] => {
    const pull = evidence.pulls.find(
      (item) => window.start >= item.start && window.start < item.end,
    );
    if (
      !pull ||
      !window.closed ||
      window.end >= pull.end - 0.5 ||
      evidence.deaths.some((death) => Math.abs(death.time - window.end) <= 1)
    )
      return [];
    return [{ start: window.start, end: window.end, pullId: pull.id }];
  });
}

function buildShadowChecks(result: AnalysisResult) {
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === SHADOW_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === SHADOW_GUIDE.partitionId;
  const castCoverage = evidence?.castsComplete === true;
  const stateCoverage =
    evidence?.guide?.specName === 'Shadow' && evidence.guide.complete;
  const baseBlock = !seasonMatches
    ? 'This Shadow ruleset is reviewed for the 12.1 Season 2 partition only.'
    : !castCoverage
      ? 'Complete cast events are required.'
      : !evidence?.pulls.length
        ? 'Pull boundaries are required.'
        : null;
  const stateBlock =
    baseBlock ??
    (!stateCoverage ? 'Complete Shadow self-buff events are required.' : null);
  const checks: GuideCheck[] = [];
  const casts = (evidence?.casts ?? []).filter((cast) =>
    evidence?.pulls.some(
      (pull) =>
        castDecisionTime(cast) >= pull.start &&
        castDecisionTime(cast) < pull.end,
    ),
  );
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

  const devourerWindows = stateWindows(result, SHADOW.mindDevourer);
  const missedDevourer = devourerWindows.flatMap((window): GuideMoment[] => {
    const consumed = casts.some(
      (cast) =>
        cast.id === SHADOW.shadowWordMadness &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end + 0.2,
    );
    return consumed
      ? []
      : [
          {
            time: window.end,
            spellId: SHADOW.shadowWordMadness,
            detail:
              'This complete Mind Devourer window ended without a recorded Shadow Word: Madness cast. Confirm target availability and whether the proc was consumed at the same timestamp.',
          },
        ];
  });
  add(
    'mind-devourer',
    'Mind Devourer converted into Madness',
    stateBlock,
    devourerWindows.length,
    missedDevourer,
    'Pairs complete Mind Devourer proc windows with Shadow Word: Madness. Pull endings, open windows and deaths are excluded.',
  );

  const voidformWindows = stateWindows(result, SHADOW.voidformAura);
  const volleyCounts = voidformWindows.map((window) => ({
    ...window,
    count: casts.filter(
      (cast) =>
        cast.id === SHADOW.voidVolley &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end + 0.2,
    ).length,
  }));
  add(
    'void-volley',
    'Void Volley charges cleared in Voidform',
    stateBlock,
    volleyCounts.length,
    volleyCounts.flatMap((window): GuideMoment[] =>
      window.count >= 3
        ? []
        : [
            {
              time: window.end,
              spellId: SHADOW.voidVolley,
              detail:
                'Only ' +
                window.count +
                ' Void Volley cast' +
                (window.count === 1 ? ' was' : 's were') +
                ' recorded in this complete Voidform window. The baseline window has three charges; Improved Voidform raises that to five.',
            },
          ],
    ),
    'The minimum safe check is three casts in a complete Voidform window. The app does not yet prove Improved Voidform, so it will not demand five.',
  );

  const infusionWindows = stateWindows(result, SHADOW.powerInfusion);
  const infusionObserved =
    (evidence?.guide?.auras ?? []).some(
      (event) => event.id === SHADOW.powerInfusion,
    ) || false;
  add(
    'voidform-infusion',
    'Self Power Infusion aligned with Voidform',
    stateBlock,
    infusionObserved ? voidformWindows.length : 0,
    infusionObserved
      ? voidformWindows.flatMap((window): GuideMoment[] => {
          const overlap = infusionWindows.some(
            (infusion) =>
              infusion.start <= window.end && infusion.end >= window.start,
          );
          return overlap
            ? []
            : [
                {
                  time: window.start,
                  spellId: SHADOW.voidformCast,
                  detail:
                    'No self-cast Power Infusion aura overlapped this complete Voidform. Check whether PI was intentionally assigned, held for the route, or unavailable.',
                },
              ];
        })
      : [],
    infusionObserved
      ? 'Checks overlap only when the priest demonstrably used Power Infusion on themself somewhere in the run. Assignment and route choices still require review.'
      : 'No self-cast Power Infusion aura was observed, so this assignment-sensitive check is not graded.',
    'not-applicable',
  );

  const firstVolleys = voidformWindows.map((window) => {
    const volley = casts.find(
      (cast) =>
        cast.id === SHADOW.voidVolley &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end,
    );
    return {
      ...window,
      delay: volley ? castDecisionTime(volley) - window.start : null,
    };
  });
  add(
    'voidform-first-volley',
    'Voidform started converting promptly',
    stateBlock,
    firstVolleys.length,
    firstVolleys.flatMap((window): GuideMoment[] =>
      window.delay === null || window.delay > 4.5
        ? [
            {
              time: window.start,
              spellId: SHADOW.voidVolley,
              detail:
                window.delay === null
                  ? 'No Void Volley was recorded in this complete Voidform window.'
                  : 'The first recorded Void Volley came ' +
                    window.delay.toFixed(1) +
                    's after Voidform began. Inspect movement, mechanics and the chosen opener.',
            },
          ]
        : [],
    ),
    'Shows Voidform windows where the first recorded Void Volley was absent or more than three GCDs late. It is a review threshold, not a universal opener rule.',
  );

  return {
    checks,
    seasonMatches,
    castCoverage,
    stateCoverage,
    summaries: [
      {
        label: 'Mind Devourer',
        value:
          devourerWindows.length - missedDevourer.length +
          ' / ' +
          devourerWindows.length,
        note: 'complete procs converted',
      },
      {
        label: 'Voidform windows',
        value: String(voidformWindows.length),
        note: 'complete windows assessed',
      },
      {
        label: 'Void Volley',
        value: volleyCounts.length
          ? (
              volleyCounts.reduce((sum, item) => sum + item.count, 0) /
              volleyCounts.length
            ).toFixed(1)
          : '-',
        note: 'average casts per window',
      },
      {
        label: 'Self PI',
        value: infusionObserved ? 'Observed' : 'Not observed',
        note: 'assignment-sensitive',
      },
    ],
  };
}

const LESSONS: Record<string, Omit<GuideLesson, 'id' | 'check'>> = {
  'mind-devourer': {
    title: 'Convert Mind Devourer before it ends',
    short: 'Mind Devourer usage',
    why: 'Mind Devourer creates a recorded opportunity for Shadow Word: Madness, so a complete unconsumed window is a concrete moment to inspect.',
    tryNext:
      'Make Mind Devourer prominent and identify the next valid target for Shadow Word: Madness before the proc expires.',
    verify:
      'Confirm target access, pull timing, proc refreshes and same-timestamp event ordering before calling it a loss.',
    spellId: SHADOW.shadowWordMadness,
    sequence: [SHADOW.mindDevourer, SHADOW.shadowWordMadness],
  },
  'void-volley': {
    title: 'Clear the baseline Void Volley charges',
    short: 'Void Volley clearance',
    why: 'The current guide calls for exhausting Void Volley charges before Voidform ends; even the baseline window contains three.',
    tryNext:
      'Track the remaining Void Volley charges beside Voidform and plan space for all of them before the window closes.',
    verify:
      'Improved Voidform raises the total to five. Check talents, forced downtime, target access and whether the window ended with the pull.',
    spellId: SHADOW.voidVolley,
    sequence: [SHADOW.voidformCast, SHADOW.voidVolley],
  },
  'voidform-infusion': {
    title: 'Review self Power Infusion alignment',
    short: 'Voidform / PI overlap',
    why: 'When Power Infusion is being used on the priest, overlapping the large haste and Voidform windows is a useful burst-package comparison.',
    tryNext:
      'Before the key, decide which Voidform cycles receive self Power Infusion and make deliberate exceptions for route or group needs.',
    verify:
      'Power Infusion may be assigned to another player or held for Bloodlust, a priority pack, immunity or downtime.',
    spellId: SHADOW.voidformCast,
    sequence: [SHADOW.powerInfusion, SHADOW.voidformCast, SHADOW.voidVolley],
  },
  'voidform-first-volley': {
    title: 'Start converting the Voidform window sooner',
    short: 'First Void Volley',
    why: 'A long delay to the first charge leaves less room to clear the remaining Void Volley charges.',
    tryNext:
      'Enter Voidform with the first few GCDs planned and keep Void Volley visible near the center of your UI.',
    verify:
      'Check movement, mechanics, target availability and the actual talent opener; the timing threshold is intentionally generous.',
    spellId: SHADOW.voidVolley,
    sequence: [SHADOW.voidformCast, SHADOW.voidVolley],
  },
};

export function buildShadowReview(result: AnalysisResult) {
  const review = buildShadowChecks(result);
  const lessons = review.checks
    .filter((check) => check.status === 'review' && LESSONS[check.id])
    .map((check) => ({ ...LESSONS[check.id], id: check.id, check }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return { ...review, lessons };
}

export const shadowGuidePack: GuidedSpecPack = {
  className: 'Priest',
  specName: 'Shadow',
  slug: 'shadow',
  source: SHADOW_GUIDE,
  limitation:
    'Insanity, target DoTs, target lifetime, enemy count, cooldown readiness, full talent loadout and forced downtime are not reconstructed. DoT and resource advice therefore stays in the damage comparison instead of becoming a binary guide failure.',
  notes: [
    'Archon is presented by the source guide for single target and Voidweaver for AoE; the app does not infer the complete hero tree from one spell.',
    'Void Volley checks use the three-charge baseline. Improved Voidform can raise the window to five, but missing talent evidence will never create a five-charge failure.',
    'Power Infusion alignment is enabled only after a self-cast PI aura is positively observed and remains assignment-sensitive.',
    'Mind Devourer uses the proc aura, not the passive talent spell ID.',
  ],
  review: buildShadowReview,
};
