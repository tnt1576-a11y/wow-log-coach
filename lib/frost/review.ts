import type { AnalysisResult } from '../domain';
import { castDecisionTime } from '../cast-sequence';
import { FROST, FROST_GUIDE } from './catalog';

export type FrostHero = 'Frostfire' | 'Spellslinger' | 'unknown';

export interface FrostMoment {
  time: number;
  spellId: number;
  detail: string;
}

export interface FrostCheck {
  id: string;
  title: string;
  status: 'review' | 'observed' | 'unavailable' | 'not-applicable';
  detail: string;
  eligible: number;
  moments: FrostMoment[];
}

interface FrostWindow {
  start: number;
  end: number;
  pullId: number;
  consumed: boolean;
}

function observedUses(result: AnalysisResult, id: number) {
  return (
    result.targetMetrics.casts?.find((cast) => cast.id === id)?.uses ??
    result.evidence?.casts.filter((cast) => cast.id === id).length ??
    0
  );
}

export function frostHero(result: AnalysisResult): FrostHero {
  const frostfire = observedUses(result, FROST.frostfireBolt) > 0;
  const frostbolt = observedUses(result, FROST.frostbolt) > 0;
  if (frostfire && !frostbolt) return 'Frostfire';
  if (frostbolt && !frostfire) return 'Spellslinger';
  return 'unknown';
}

function auraWindows(
  result: AnalysisResult,
  auraId: number,
  consumerId: number,
): FrostWindow[] {
  const evidence = result.evidence;
  if (!evidence?.frost?.complete) return [];
  const events = evidence.frost.auras
    .filter((event) => event.id === auraId)
    .sort((a, b) => a.time - b.time);
  const raw: Array<{ start: number; end: number; closed: boolean }> = [];
  let start: number | null = null;
  for (const event of events) {
    if (event.type === 'removebuff') {
      if (start !== null && event.time > start)
        raw.push({ start, end: event.time, closed: true });
      start = null;
    } else if (start === null) start = event.time;
  }
  if (start !== null)
    raw.push({ start, end: evidence.duration, closed: false });
  return raw.flatMap((window) => {
    const pull = evidence.pulls.find(
      (item) => window.start >= item.start && window.start < item.end,
    );
    if (!pull) return [];
    if (
      !window.closed ||
      window.end >= pull.end - 0.5 ||
      evidence.deaths.some((death) => Math.abs(death.time - window.end) <= 1)
    )
      return [];
    const end = Math.min(window.end, pull.end);
    if (end - window.start < 0.25) return [];
    const consumed = evidence.casts.some(
      (cast) =>
        cast.id === consumerId &&
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= end + 0.2,
    );
    return [{ start: window.start, end, pullId: pull.id, consumed }];
  });
}

function ordered(casts: number[], expected: number[]) {
  let index = 0;
  for (const id of casts) if (id === expected[index]) index++;
  return index === expected.length;
}

export function buildFrostReview(result: AnalysisResult) {
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === FROST_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === FROST_GUIDE.partitionId;
  const castCoverage = evidence?.castsComplete === true;
  const buffCoverage = evidence?.frost?.complete === true;
  const hero = frostHero(result);
  const casts = (evidence?.casts ?? []).filter((cast) =>
    evidence?.pulls.some(
      (pull) =>
        castDecisionTime(cast) >= pull.start &&
        castDecisionTime(cast) < pull.end,
    ),
  );
  const checks: FrostCheck[] = [];
  const baseBlock = !seasonMatches
    ? 'This Frost ruleset is reviewed for the 12.1 Season 2 partition only.'
    : !castCoverage
      ? 'Complete cast events are required.'
      : !evidence?.pulls.length
        ? 'Pull boundaries are required.'
        : null;
  const stateBlock =
    baseBlock ??
    (!buffCoverage ? 'Complete Frost proc-buff events are required.' : null);
  function add(
    id: string,
    title: string,
    block: string | null,
    eligible: number,
    moments: FrostMoment[],
    detail: string,
    empty: 'unavailable' | 'not-applicable' = 'unavailable',
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
      detail: block ?? (!eligible ? detail : detail),
      eligible: block ? 0 : eligible,
      moments: block ? [] : moments,
    });
  }

  const brainFreezeWindows = auraWindows(
    result,
    FROST.brainFreeze,
    FROST.flurry,
  );
  add(
    'brain-freeze-flurry',
    'Brain Freeze converted into Flurry',
    stateBlock,
    brainFreezeWindows.length,
    brainFreezeWindows
      .filter((window) => !window.consumed)
      .map((window) => ({
        time: window.end,
        spellId: FROST.flurry,
        detail:
          'This recorded Brain Freeze window ended without a Flurry cast. Confirm whether the proc expired, refreshed, or the pull ended.',
      })),
    'The guide prioritizes Flurry with Brain Freeze. Buff expiration, refreshes and pull endings remain review context.',
  );

  const fingersWindows = auraWindows(
    result,
    FROST.fingersOfFrost,
    FROST.iceLance,
  );
  add(
    'fingers-ice-lance',
    'Fingers of Frost converted into Ice Lance',
    stateBlock,
    fingersWindows.length,
    fingersWindows
      .filter((window) => !window.consumed)
      .map((window) => ({
        time: window.end,
        spellId: FROST.iceLance,
        detail:
          'This recorded Fingers of Frost window ended without an Ice Lance cast. Confirm movement, target access and whether the proc refreshed.',
      })),
    'Fingers of Frost makes Ice Lance a Shatter spender without consuming target Freezing stacks.',
  );

  const fingersEvents = (evidence?.frost?.auras ?? [])
    .filter((event) => event.id === FROST.fingersOfFrost)
    .sort((a, b) => a.time - b.time);
  let priorStacks: number | null = null;
  let explicitTransitions = 0;
  const overcaps: FrostMoment[] = [];
  for (const event of fingersEvents) {
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
          overcaps.push({
            time: event.time,
            spellId: FROST.iceLance,
            detail:
              'A new recorded Fingers of Frost application arrived while the prior explicit state was already at two charges. Check whether an Ice Lance opportunity was missed.',
          });
      }
      priorStacks = event.stacks;
    } else priorStacks = event.stacks;
  }
  add(
    'fingers-overcap',
    'Fingers of Frost charge pressure',
    stateBlock,
    explicitTransitions,
    overcaps,
    'This requires explicit stack transitions. Fingers of Frost has a maximum of two charges; event ordering can still require log review.',
  );

  const cometObserved = observedUses(result, FROST.cometStorm) > 0;
  const rayCasts = casts.filter((cast) => cast.id === FROST.rayOfFrost);
  const eligibleRays = cometObserved
    ? rayCasts.filter((ray) => {
        const time = castDecisionTime(ray);
        const pull = evidence?.pulls.find(
          (item) => time >= item.start && time < item.end,
        );
        return pull && pull.end - time >= 8;
      })
    : [];
  add(
    'ray-comet',
    'Comet Storm after Ray of Frost',
    baseBlock,
    eligibleRays.length,
    eligibleRays.flatMap((ray): FrostMoment[] => {
      const time = castDecisionTime(ray);
      const comet = casts.find(
        (cast) =>
          cast.id === FROST.cometStorm &&
          castDecisionTime(cast) > time &&
          castDecisionTime(cast) <= time + 8,
      );
      return comet
        ? []
        : [
            {
              time,
              spellId: FROST.rayOfFrost,
              detail:
                'No Comet Storm cast was recorded within 8s after this Ray of Frost. Confirm the transformed button, target access and pull ending.',
            },
          ];
    }),
    cometObserved
      ? 'Comet Storm was observed, so Ray follow-ups can be checked. The 8s window is a review allowance, not a cooldown-ready claim.'
      : 'Comet Storm was not observed, so this talent-dependent follow-up is not graded.',
    cometObserved ? 'unavailable' : 'not-applicable',
  );

  const expected =
    hero === 'Frostfire'
      ? [FROST.rayOfFrost, FROST.flurry, FROST.frozenOrb]
      : hero === 'Spellslinger'
        ? [FROST.flurry, FROST.frozenOrb, FROST.rayOfFrost, FROST.iceLance]
        : [];
  const bossPulls = expected.length
    ? (evidence?.pulls ?? []).filter(
        (pull) => pull.boss && pull.end - pull.start >= 20,
      )
    : [];
  add(
    'boss-opener',
    hero === 'unknown' ? 'Hero-tree opener anchors' : hero + ' boss opener',
    baseBlock ??
      (hero === 'unknown'
        ? 'Frostfire versus Spellslinger could not be established from filler casts.'
        : null),
    bossPulls.length,
    bossPulls.flatMap((pull): FrostMoment[] => {
      const opener = casts
        .filter(
          (cast) =>
            castDecisionTime(cast) >= pull.start &&
            castDecisionTime(cast) < Math.min(pull.end, pull.start + 20),
        )
        .map((cast) => cast.id);
      return ordered(opener, expected)
        ? []
        : [
            {
              time: pull.start,
              spellId: expected[0],
              detail:
                'The first 20s did not contain the current guide opener anchors in order for the observed ' +
                hero +
                ' filler. Pre-casts, mechanics and planned delays still need review.',
            },
          ];
    }),
    'Boss openers use only the anchor order shared by the current guide branch. Pre-pull casts and encounter plans can change the visible sequence.',
  );

  return {
    checks,
    seasonMatches,
    castCoverage,
    buffCoverage,
    hero,
    brainFreezeWindows,
    fingersWindows,
    rayCasts: rayCasts.length,
    cometObserved,
  };
}

export function frostGuideNotes(hero: FrostHero, scenario: 'single' | 'aoe') {
  return [
    'Build Freezing on the target with Frostbolt or Frostfire Bolt and Flurry, then consume it with Ice Lance.',
    'Brain Freeze resets Flurry; Fingers of Frost makes Ice Lance Shatter without consuming target Freezing stacks.',
    hero === 'unknown'
      ? 'The filler cast did not establish Frostfire or Spellslinger, so hero-specific opener and stack advice is disabled.'
      : hero +
        ' was inferred from the recorded filler spell; this is not a complete talent loadout.',
    scenario === 'single'
      ? 'The current guide keeps the single-target priority on one or two targets.'
      : 'The current guide changes to its AoE branch at three or more targets; the app does not infer enemy count.',
  ];
}
