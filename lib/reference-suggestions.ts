import type { CastEvent, PullEvidence, RunEvidence } from './domain';
import { castDecisionTime } from './cast-sequence';
import { ARCANE, type Hero } from './arcane/catalog';
import { auraIndex } from './arcane/state';

function secondsLeft(run: RunEvidence, time: number) {
  const pull = run.pulls.find((p) => time >= p.start && time < p.end);
  if (!pull) return 0;
  const death = run.deaths
    .filter((d) => d.time >= time && d.time < pull.end)
    .sort((a, b) => a.time - b.time)[0];
  return Math.max(
    0,
    Math.min(pull.end, run.duration, death?.time ?? Infinity) - time,
  );
}

/** Suggestions are explicit choices, never claims of equivalent enemy packs. */
export function suggestReferencePulls(
  target: RunEvidence | undefined,
  reference: RunEvidence | undefined,
  pull: PullEvidence | undefined,
) {
  if (
    !target?.castsComplete ||
    !reference?.castsComplete ||
    !pull ||
    pull.end <= pull.start
  )
    return [];
  const duration = pull.end - pull.start;
  return reference.pulls
    .flatMap((candidate) => {
      const length = candidate.end - candidate.start;
      if (candidate.boss !== pull.boss || length <= 0) return [];
      if (
        pull.boss &&
        (!pull.encounterId || candidate.encounterId !== pull.encounterId)
      )
        return [];
      if (
        !pull.boss &&
        pull.mapId !== null &&
        candidate.mapId !== null &&
        pull.mapId !== candidate.mapId
      )
        return [];
      const ratio = Math.min(duration, length) / Math.max(duration, length);
      // A substantially different trash duration is not a useful default suggestion.
      if (!pull.boss && ratio < 0.7) return [];
      const yourDeaths = target.deaths.filter(
        (d) => d.time >= pull.start && d.time < pull.end,
      ).length;
      const theirDeaths = reference.deaths.filter(
        (d) => d.time >= candidate.start && d.time < candidate.end,
      ).length;
      const reasons = [
        pull.boss ? 'Same boss encounter' : 'Similar trash-pull duration',
        `${length.toFixed(0)}s vs your ${duration.toFixed(0)}s`,
      ];
      if (yourDeaths !== theirDeaths) reasons.push('Death counts differ');
      return [
        {
          pull: candidate,
          reasons,
          distance: 1 - ratio + (yourDeaths === theirDeaths ? 0 : 0.2),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance || a.pull.start - b.pull.start)
    .slice(0, 3);
}

/** Same hero + comparable observed starting state. No readiness or target-count inference. */
export function suggestArcaneAnchors(
  yours: RunEvidence | undefined,
  theirs: RunEvidence | undefined,
  yourTime: number,
  spellId: number,
  candidates: CastEvent[],
  yourHero: Hero,
  theirHero: Hero,
) {
  if (
    yourHero === 'unknown' ||
    yourHero !== theirHero ||
    !yours?.castsComplete ||
    !theirs?.castsComplete ||
    !yours.arcane?.complete ||
    !theirs.arcane?.complete ||
    secondsLeft(yours, yourTime) < 5
  )
    return [];
  const yourCasts = yours.casts.filter(
    (c) =>
      c.id === spellId &&
      (castDecisionTime(c) === yourTime || c.time === yourTime),
  );
  if (yourCasts.length !== 1) return [];
  const yourIndex = auraIndex(yours.arcane.auras),
    theirIndex = auraIndex(theirs.arcane.auras);
  const yourAt = castDecisionTime(yourCasts[0]);
  const buffs =
    yourHero === 'Sunfury'
      ? [ARCANE.surgeBuff, ARCANE.soul]
      : [ARCANE.surgeBuff];
  const stacks = [
    ARCANE.salvo,
    ARCANE.clearcasting,
    ...(spellId === ARCANE.bolt ? [ARCANE.cumulative] : []),
  ];
  // Known spell setup proximity is separate from active-buff state.
  const phase = (run: RunEvidence, time: number) =>
    run.casts.some(
      (c) =>
        (c.id === ARCANE.surge || c.id === ARCANE.touch) &&
        time >= castDecisionTime(c) - 3 &&
        time <= c.time + (c.id === ARCANE.surge ? 25 : 20),
    );
  const yourPhase = phase(yours, yourAt);
  return candidates
    .flatMap((cast) => {
      const time = castDecisionTime(cast);
      if (
        cast.id !== spellId ||
        secondsLeft(theirs, time) < 5 ||
        phase(theirs, time) !== yourPhase
      )
        return [];
      let distance = 0;
      for (const id of buffs) {
        const a = yourIndex.before(id, yourAt),
          b = theirIndex.before(id, time);
        if (a.active === null || b.active === null || a.active !== b.active)
          return [];
      }
      for (const id of stacks) {
        const a = yourIndex.before(id, yourAt),
          b = theirIndex.before(id, time);
        if (a.stacks === null || b.stacks === null) return [];
        if (
          id === ARCANE.clearcasting &&
          (a.active !== b.active || a.stacks >= 3 !== b.stacks >= 3)
        )
          return [];
        if (id === ARCANE.salvo) {
          const cuts = yourHero === 'Sunfury' ? [12, 25] : [15, 20];
          const band = (value: number) =>
            cuts.filter((cut) => value >= cut).length;
          if (band(a.stacks) !== band(b.stacks)) return [];
        }
        distance += Math.abs(a.stacks - b.stacks);
      }
      const yourRemaining = secondsLeft(yours, yourAt),
        theirRemaining = secondsLeft(theirs, time);
      distance +=
        Math.abs(Math.min(30, yourRemaining) - Math.min(30, theirRemaining)) /
        10;
      return [
        {
          cast,
          distance,
          reasons: [
            yourHero,
            'Same recorded burst state',
            'Known Salvo and Clearcasting',
            `${Math.min(10, yourRemaining, theirRemaining).toFixed(1)}s shared window`,
          ],
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance || a.cast.time - b.cast.time)
    .slice(0, 3);
}
