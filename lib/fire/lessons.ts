import type { AnalysisResult, ReferenceRun, RunEvidence } from '../domain';
import { momentSequence } from '../cast-sequence';
import { FIRE } from './catalog';
import { buildFireReview, type FireCheck } from './review';

export type FireLesson = {
  id: string;
  title: string;
  short: string;
  why: string;
  tryNext: string;
  verify: string;
  spellId: number;
  sequence?: number[];
  check: FireCheck;
};

const LESSONS: Record<string, Omit<FireLesson, 'id' | 'check'>> = {
  'combustion-spenders': {
    title: 'Spend Hot Streaks inside Combustion',
    short: 'Combustion spenders',
    why: 'The guide treats Combustion as a separate burst phase built around instant Pyroblast or Flamestrike casts.',
    tryNext:
      'Before the next Combustion, confirm the target and plan which Hot Streak spender fits the pull.',
    verify:
      'Check target access, pull ending, Hot Streak state and whether Pyroblast or Flamestrike matched the target count.',
    spellId: FIRE.combustion,
    sequence: [FIRE.combustion, FIRE.fireBlast, FIRE.pyroblast],
  },
  'combustion-fireblast': {
    title: 'Review Fire Blast inside Combustion',
    short: 'Combustion Fire Blast',
    why: 'The guide uses Fire Blast to help build Hot Streaks during Combustion.',
    tryNext:
      'Enter Combustion with a plan for your Fire Blast charges and watch Heating Up before each use.',
    verify:
      'Charge availability, Fired Up procs and overcap pressure are not reconstructed. Zero casts is a review cue, not proof of a mistake.',
    spellId: FIRE.combustion,
    sequence: [FIRE.combustion, FIRE.fireBlast, FIRE.pyroblast],
  },
  'hot-streak-chain': {
    title: 'Chain your Hot Streak spender after a filler',
    short: 'Hot Streak chaining',
    why: 'Outside Combustion, the guide pairs a finishing Fireball or Frostfire Bolt with an immediate Hot Streak spender.',
    tryNext:
      'When Hot Streak is ready outside burst, finish a filler and immediately send Pyroblast or the correct AoE spender.',
    verify:
      'Confirm projectile impact, enemy health, movement and whether the spender was Pyroclasm or Hyperthermia instead.',
    spellId: FIRE.pyroblast,
    sequence: [FIRE.fireball, FIRE.pyroblast],
  },
  'hyperthermia-spenders': {
    title: 'Use the Hyperthermia window',
    short: 'Hyperthermia spenders',
    why: 'The guide uses Hyperthermia for repeated instant Pyroblast or Flamestrike casts.',
    tryNext:
      'Make Hyperthermia prominent in your UI and spend it on the correct single-target or AoE spell.',
    verify:
      'Check target access and mechanics. The coach only knows that the buff and casts were recorded.',
    spellId: FIRE.hyperthermia,
    sequence: [FIRE.hyperthermia, FIRE.pyroblast, FIRE.pyroblast],
  },
};

export function fireLessons(result: AnalysisResult) {
  const review = buildFireReview(result);
  const lessons = review.checks
    .filter((check) => check.status === 'review' && LESSONS[check.id])
    .map((check) => ({ ...LESSONS[check.id], id: check.id, check }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return { ...review, lessons };
}

export function referenceFireReview(
  result: AnalysisResult,
  reference: ReferenceRun,
  evidence: RunEvidence,
) {
  if (
    !reference.metrics ||
    reference.className !== 'Mage' ||
    reference.specName !== 'Fire'
  )
    return null;
  return buildFireReview({
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

export function firePracticeText(player: string, lesson: FireLesson) {
  return [
    player + ' - next key Fire focus',
    lesson.title,
    'Try: ' + lesson.tryNext,
    'Check first: ' + lesson.verify,
    'Based on ' +
      lesson.check.moments.length +
      ' review observations, not measured DPS loss.',
  ].join('\n');
}

export { momentSequence };
