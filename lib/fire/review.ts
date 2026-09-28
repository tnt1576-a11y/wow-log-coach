import type { AnalysisResult } from '../domain';
import { castDecisionTime } from '../cast-sequence';
import { auraIndex } from '../arcane/state';
import { FIRE, FIRE_GUIDE } from './catalog';

export interface FireMoment {
  time: number;
  spellId: number;
  detail: string;
}

export interface FireCheck {
  id: string;
  title: string;
  status: 'review' | 'observed' | 'unavailable' | 'not-applicable';
  detail: string;
  eligible: number;
  moments: FireMoment[];
}

export interface FireWindow {
  start: number;
  end: number;
  pullId: number;
  spenders: number;
  fireBlasts: number;
  meteors: number;
}

function windows(
  result: AnalysisResult,
  auraId: number,
): Array<{ start: number; end: number; pullId: number }> {
  const evidence = result.evidence;
  if (!evidence?.fire?.complete) return [];
  const events = evidence.fire.auras
    .filter((event) => event.id === auraId)
    .sort((a, b) => a.time - b.time);
  const raw: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  for (const event of events) {
    if (event.type === 'removebuff') {
      if (start !== null && event.time > start)
        raw.push({ start, end: event.time });
      start = null;
    } else if (start === null) start = event.time;
  }
  if (start !== null && evidence.fire.complete)
    raw.push({ start, end: evidence.duration });
  return raw.flatMap((window) => {
    const pull = evidence.pulls.find(
      (item) => window.start >= item.start && window.start < item.end,
    );
    if (!pull) return [];
    const end = Math.min(window.end, pull.end);
    return end - window.start >= 2
      ? [{ start: window.start, end, pullId: pull.id }]
      : [];
  });
}

export function buildFireReview(result: AnalysisResult) {
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === FIRE_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === FIRE_GUIDE.partitionId;
  const castCoverage = evidence?.castsComplete === true;
  const buffCoverage = evidence?.fire?.complete === true;
  const casts = (evidence?.casts ?? []).filter((cast) =>
    evidence?.pulls.some(
      (pull) => cast.time >= pull.start && cast.time < pull.end,
    ),
  );
  const states = auraIndex(evidence?.fire?.auras ?? []);
  const checks: FireCheck[] = [];
  const baseBlock = !seasonMatches
    ? 'This Fire ruleset is reviewed for the 12.1 Season 2 partition only.'
    : !castCoverage
      ? 'Complete cast events are required.'
      : !evidence?.pulls.length
        ? 'Pull boundaries are required.'
        : null;
  const stateBlock =
    baseBlock ??
    (!buffCoverage ? 'Complete Fire buff events are required.' : null);
  function add(
    id: string,
    title: string,
    block: string | null,
    eligible: number,
    moments: FireMoment[],
    detail: string,
  ) {
    checks.push({
      id,
      title,
      status:
        block || !eligible
          ? 'unavailable'
          : moments.length
            ? 'review'
            : 'observed',
      detail:
        block ??
        (!eligible ? 'No eligible recorded decisions. ' + detail : detail),
      eligible: block ? 0 : eligible,
      moments: block ? [] : moments,
    });
  }

  const combustionWindows: FireWindow[] = windows(result, FIRE.combustion).map(
    (window) => {
      const inside = casts.filter(
        (cast) => cast.time >= window.start && cast.time < window.end,
      );
      return {
        ...window,
        spenders: inside.filter(
          (cast) => cast.id === FIRE.pyroblast || cast.id === FIRE.flamestrike,
        ).length,
        fireBlasts: inside.filter((cast) => cast.id === FIRE.fireBlast).length,
        meteors: inside.filter((cast) => cast.id === FIRE.meteor).length,
      };
    },
  );
  add(
    'combustion-spenders',
    'Hot Streak spenders during Combustion',
    stateBlock,
    combustionWindows.length,
    combustionWindows
      .filter((window) => window.spenders === 0)
      .map((window) => ({
        time: window.start,
        spellId: FIRE.combustion,
        detail:
          'No Pyroblast or Flamestrike cast was recorded during this ' +
          (window.end - window.start).toFixed(1) +
          's Combustion window.',
      })),
    'The guide rotates instant Pyroblast or Flamestrike spenders through Combustion. Pull endings, target access and proc state still need review.',
  );
  add(
    'combustion-fireblast',
    'Fire Blast during Combustion',
    stateBlock,
    combustionWindows.length,
    combustionWindows
      .filter((window) => window.fireBlasts === 0)
      .map((window) => ({
        time: window.start,
        spellId: FIRE.combustion,
        detail:
          'No Fire Blast cast was recorded during this Combustion window.',
      })),
    'The guide uses Fire Blast as a Hot Streak builder during Combustion. Charge state, overcap risk and proc timing are not reconstructed.',
  );

  const spenders = casts.filter(
    (cast) => cast.id === FIRE.pyroblast || cast.id === FIRE.flamestrike,
  );
  const chained = spenders.filter((cast) => {
    const decision = castDecisionTime(cast);
    return (
      states.before(FIRE.hotStreak, decision).active === true &&
      states.before(FIRE.combustion, decision).active !== true &&
      states.before(FIRE.hyperthermia, decision).active !== true
    );
  });
  const fillers = new Set([FIRE.fireball, FIRE.frostfireBolt, FIRE.scorch]);
  add(
    'hot-streak-chain',
    'Hot Streak chaining outside Combustion',
    stateBlock,
    chained.length,
    chained.flatMap((spender): FireMoment[] => {
      const decision = castDecisionTime(spender);
      const pull = evidence?.pulls.find(
        (item) => decision >= item.start && decision < item.end,
      );
      const setup = casts
        .filter(
          (cast) =>
            pull &&
            fillers.has(cast.id) &&
            cast.time >= pull.start &&
            cast.time <= spender.time &&
            spender.time - cast.time <= 1,
        )
        .at(-1);
      return setup
        ? []
        : [
            {
              time: decision,
              spellId: spender.id,
              detail:
                spender.name +
                ' consumed a recorded Hot Streak without a Fireball, Frostfire Bolt or Scorch completion in the preceding 1s.',
            },
          ];
    }),
    'Outside Combustion, the guide chains a Hot Streak spender immediately after Fireball, Frostfire Bolt or execute Scorch. Projectile impact and enemy health are not reconstructed.',
  );

  const hyperthermiaWindows = windows(result, FIRE.hyperthermia);
  add(
    'hyperthermia-spenders',
    'Pyroblast or Flamestrike during Hyperthermia',
    stateBlock,
    hyperthermiaWindows.length,
    hyperthermiaWindows.flatMap((window): FireMoment[] => {
      const count = spenders.filter(
        (cast) => cast.time >= window.start && cast.time < window.end,
      ).length;
      return count
        ? []
        : [
            {
              time: window.start,
              spellId: FIRE.hyperthermia,
              detail:
                'No Pyroblast or Flamestrike cast was recorded during this Hyperthermia window.',
            },
          ];
    }),
    'The guide spends Hyperthermia on Pyroblast in single target or Flamestrike in the relevant AoE context. Mechanics and target access still matter.',
  );

  const meteorObserved =
    (result.targetMetrics.casts?.find((cast) => cast.id === FIRE.meteor)
      ?.uses ?? 0) > 0;
  return {
    checks,
    combustionWindows,
    seasonMatches,
    castCoverage,
    buffCoverage,
    meteorObserved,
  };
}

export function fireGuideNotes(
  scenario: 'single' | 'aoe',
  meteorObserved: boolean,
) {
  const notes = [
    'Combustion is a distinct phase: alternate Hot Streak spenders with builders such as Fire Blast.',
    scenario === 'single'
      ? 'Single target normally spends Hot Streak on Pyroblast and chains it after Fireball or Frostfire Bolt.'
      : "At the guide's AoE threshold, Flamestrike replaces Pyroblast; priority-target damage can still favor Pyroblast.",
    'Pyroclasm hard-casts and Hyperthermia instant casts are separated from normal Hot Streak chaining checks.',
  ];
  if (meteorObserved)
    notes.push(
      'Meteor was observed in this run. The guide places it during Combustion when alignment permits, but readiness is not reconstructed.',
    );
  return notes;
}
