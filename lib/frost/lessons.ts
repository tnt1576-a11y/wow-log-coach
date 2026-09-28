import type { AnalysisResult, ReferenceRun, RunEvidence } from '../domain';
import { FROST } from './catalog';
import { buildFrostReview, type FrostCheck } from './review';

export type FrostLesson = {
  id: string;
  title: string;
  short: string;
  why: string;
  tryNext: string;
  verify: string;
  spellId: number;
  sequence?: number[];
  check: FrostCheck;
};

const LESSONS: Record<string, Omit<FrostLesson, 'id' | 'check'>> = {
  'brain-freeze-flurry': {
    title: 'Convert Brain Freeze into Flurry',
    short: 'Brain Freeze usage',
    why: 'The guide gives proc-enhanced Flurry high priority, and the buff has a finite recorded window.',
    tryNext:
      'Make Brain Freeze prominent and plan a target for Flurry before the proc expires or refreshes.',
    verify:
      'Confirm whether the proc refreshed, the pull ended, the target became unavailable, or the buff event stream missed its consumption.',
    spellId: FROST.flurry,
    sequence: [FROST.brainFreeze, FROST.flurry],
  },
  'fingers-ice-lance': {
    title: 'Convert Fingers of Frost into Ice Lance',
    short: 'Fingers proc usage',
    why: 'Fingers of Frost lets Ice Lance Shatter without consuming target Freezing stacks.',
    tryNext:
      'Track Fingers of Frost charges separately and spend them before the recorded proc window ends.',
    verify:
      'Confirm movement, target access, proc refreshes and whether the event stream recorded a same-frame Ice Lance consumption.',
    spellId: FROST.iceLance,
    sequence: [FROST.fingersOfFrost, FROST.iceLance],
  },
  'fingers-overcap': {
    title: 'Review Fingers of Frost at two charges',
    short: 'Fingers charge pressure',
    why: 'Fingers of Frost has a two-charge maximum, so a new proc event at the recorded cap can indicate lost room.',
    tryNext:
      'At two charges, look for the next safe Ice Lance before another generator can proc.',
    verify:
      'Event ordering and stack snapshots can be imperfect. Confirm the actual charge display and whether Ice Lance was in flight.',
    spellId: FROST.iceLance,
    sequence: [FROST.iceLance, FROST.frostbolt],
  },
  'ray-comet': {
    title: 'Use the Comet Storm follow-up after Ray',
    short: 'Ray to Comet',
    why: 'When Comet Storm is talented and observed, the guide uses the transformed follow-up after Ray of Frost.',
    tryNext:
      'After Ray finishes, keep the transformed button visible and confirm the target before sending Comet Storm.',
    verify:
      'Confirm the transformation, mechanics, target movement and whether the pull ended. The eight-second allowance is not a cooldown rule.',
    spellId: FROST.rayOfFrost,
    sequence: [FROST.rayOfFrost, FROST.cometStorm],
  },
  'boss-opener': {
    title: 'Review the hero-tree boss opener anchors',
    short: 'Boss opener order',
    why: 'The current guide gives Frostfire and Spellslinger different opener orders around Flurry, Frozen Orb and Ray of Frost.',
    tryNext:
      'Before a boss, rehearse only your hero-tree anchor order and adjust it deliberately for the encounter plan.',
    verify:
      'Pre-pull casts may sit outside the logged pull. Confirm mechanics, delayed vulnerability and whether the inferred filler identifies the hero tree.',
    spellId: FROST.flurry,
    sequence: [FROST.flurry, FROST.frozenOrb, FROST.rayOfFrost],
  },
};

export function frostLessons(result: AnalysisResult) {
  const review = buildFrostReview(result);
  const lessons = review.checks
    .filter((check) => check.status === 'review' && LESSONS[check.id])
    .map((check) => ({ ...LESSONS[check.id], id: check.id, check }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return { ...review, lessons };
}

export function referenceFrostReview(
  result: AnalysisResult,
  reference: ReferenceRun,
  evidence: RunEvidence,
) {
  if (
    !reference.metrics ||
    reference.className !== 'Mage' ||
    reference.specName !== 'Frost'
  )
    return null;
  return buildFrostReview({
    ...result,
    target: {
      ...result.target,
      player: reference.player,
      reportCode: reference.reportCode,
      fightId: reference.fightId,
      sourceId: reference.sourceId ?? 0,
    },
    targetMetrics: reference.metrics,
    evidence,
  });
}

export function frostPracticeText(player: string, lesson: FrostLesson) {
  return [
    player + ' - next key Frost focus',
    lesson.title,
    'Try: ' + lesson.tryNext,
    'Check first: ' + lesson.verify,
    'Based on ' +
      lesson.check.moments.length +
      ' review observations, not measured DPS loss.',
  ].join('\n');
}
