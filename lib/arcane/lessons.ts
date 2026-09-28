import type { AnalysisResult, ReferenceRun, RunEvidence } from '../domain';
export { castDecisionTime, momentSequence } from '../cast-sequence';
import { ARCANE, type BuildOverrides } from './catalog';
import { buildArcaneReview, type ArcaneCheck } from './review';

export type ArcaneLesson = {
  id: string;
  title: string;
  short: string;
  why: string;
  tryNext: string;
  verify: string;
  spellId: number;
  sequence?: number[];
  check: ArcaneCheck;
};
const LESSONS: Record<string, Omit<ArcaneLesson, 'id' | 'check'>> = {
  'burst-sequence': {
    title: 'Rehearse the anchors of your burst',
    short: 'Surge burst sequence',
    why: 'Method anchors the opener with Surge, Missiles, then Touch.',
    tryNext:
      'Before the next planned burst, confirm your target and rehearse Surge, Missiles, then Touch.',
    verify:
      'Trinkets, racials and encounter actions can sit between these anchors. Verify that Surge and Touch were both planned and ready. Do not wait for full mana just to increase the initial Surge hit; the guide values its damage buff and mana recovery.',
    spellId: ARCANE.surge,
    sequence: [ARCANE.surge, ARCANE.missiles, ARCANE.touch],
  },
  'touch-cadence': {
    title: 'Check whether Touch drifted inside a pull',
    short: 'Touch cadence',
    why: 'The guide describes Touch as a 45-second cooldown and warns that delays can push the next Surge.',
    tryNext:
      'Track the next Touch after each use and decide on the hold before it becomes available.',
    verify:
      'The coach allows 55 seconds before flagging a review. Confirm cooldown availability, target access, downtime and planned holds.',
    spellId: ARCANE.touch,
    sequence: [ARCANE.touch],
  },
  'touch-order': {
    title: 'Check your burst opener',
    short: 'Barrage and Touch order',
    why: 'Legacy check: Method does not require Barrage before Touch.',
    tryNext:
      'Use the Method opener anchors and review proc context separately.',
    verify:
      'Check projectile impact and your target before changing the sequence. Cast order alone does not prove lost damage.',
    spellId: ARCANE.touch,
    sequence: [ARCANE.barrage, ARCANE.touch],
  },
  'missiles-salvo': {
    title: 'Check what you spend before Missiles',
    short: 'Missiles at high Salvo',
    why: 'Normal Missiles priority changes with your hero tree and the Salvo already banked.',
    tryNext:
      'Watch Salvo before your next Clearcasting channel. Check whether your build calls for spending first.',
    verify:
      'You still need Arcane Charges, proc expiry, target count, and a usable alternative. This is not an instruction to Barrage every time.',
    spellId: ARCANE.missiles,
  },
  'soul-filler': {
    title: 'Use your Arcane Soul window',
    short: 'Blast during Arcane Soul',
    why: 'Arcane Soul moves Barrage above filler Blast in the Sunfury priority.',
    tryNext:
      'Make Arcane Soul easy to see, then check Barrage priority before starting another filler Blast.',
    verify:
      'A Blast started before Soul is different from one started during it. Target availability and mechanics still matter.',
    spellId: ARCANE.blast,
    sequence: [ARCANE.barrage],
  },
  'evocation-surge': {
    title: 'Review mana recovery during burst',
    short: 'Evocation inside Surge',
    why: 'This app heuristic highlights mana recovery during burst; it is not a Method rotation requirement.',
    tryNext:
      'Plan mana recovery outside the next burst window when the encounter allows it.',
    verify:
      'Mana and encounter emergencies are not reconstructed. Do not remove a necessary recovery cast solely because it appears here.',
    spellId: ARCANE.evocation,
  },
  'surge-touch': {
    title: 'Keep planned burst spells together',
    short: 'Surge to Touch delay',
    why: 'A long gap can separate parts of the planned burst setup.',
    tryNext:
      'Before your next Surge, plan the target and when Touch will follow.',
    verify:
      'The 8-second threshold is a review cue, not a game rule. Check whether Touch was ready and whether the pull justified holding it.',
    spellId: ARCANE.surge,
    sequence: [ARCANE.surge, ARCANE.missiles, ARCANE.touch],
  },
};

export function arcaneLessons(
  result: AnalysisResult,
  overrides: BuildOverrides = {},
) {
  const review = buildArcaneReview(result, overrides);
  // Workflow order, not a made-up damage-loss ranking. Repeated observations first.
  const lessons: ArcaneLesson[] = review.checks
    .filter((check) => check.status === 'review' && LESSONS[check.id])
    .map((check) => ({ ...LESSONS[check.id], id: check.id, check }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return { ...review, lessons };
}

export function referenceArcaneReview(
  result: AnalysisResult,
  reference: ReferenceRun,
  evidence: RunEvidence,
) {
  if (
    !reference.metrics ||
    reference.className !== 'Mage' ||
    reference.specName !== 'Arcane'
  )
    return null;
  return buildArcaneReview({
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

export function practiceText(player: string, lesson: ArcaneLesson) {
  return (
    player +
    ' - next key focus\n' +
    lesson.title +
    '\nTry: ' +
    lesson.tryNext +
    '\nCheck first: ' +
    lesson.verify +
    '\nBased on ' +
    lesson.check.moments.length +
    ' review observations, not measured DPS loss.'
  );
}
