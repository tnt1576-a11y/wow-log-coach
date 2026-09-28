import type { AnalysisResult } from '../domain';
import { ARCANE, ARCANE_GUIDE, type BuildOverrides } from './catalog';
import { arcaneBuild } from './build';
import { auraIndex } from './state';
import { castDecisionTime } from '../cast-sequence';

export const DECISION_STATES = [
  [ARCANE.salvo, 'Arcane Salvo', true],
  [ARCANE.clearcasting, 'Clearcasting', true],
  [ARCANE.soul, 'Arcane Soul', false],
  [ARCANE.surgeBuff, 'Arcane Surge', false],
  [ARCANE.cumulative, 'Cumulative Power', true],
] as const;

export function arcaneDecisionContext(
  result: AnalysisResult,
  time: number,
  spellId?: number,
  overrides: BuildOverrides = {},
) {
  if (result.target.className !== 'Mage' || result.target.specName !== 'Arcane')
    return null;
  const evidence = result.evidence;
  const build = arcaneBuild(result.targetMetrics, evidence, overrides);
  const casts = (evidence?.casts ?? []).filter(
    (c) =>
      (spellId === undefined || c.id === spellId) &&
      (castDecisionTime(c) === time || c.time === time),
  );
  const cast = casts.length === 1 ? casts[0] : null;
  const at = cast ? castDecisionTime(cast) : time;
  const season =
    result.target.rankingZoneId === ARCANE_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === ARCANE_GUIDE.partitionId;
  const usable = Boolean(
    season &&
    cast &&
    evidence?.castsComplete &&
    evidence.arcane?.complete &&
    evidence.pulls.some((p) => at >= p.start && at < p.end),
  );
  const index = auraIndex(usable ? evidence!.arcane!.auras : []);
  const states = DECISION_STATES.map(([id, label, stack]) => {
    const state = index.before(id, at);
    return {
      id,
      label,
      state,
      value:
        state.active === null
          ? 'Unknown'
          : !state.active
            ? stack
              ? '0'
              : 'Inactive'
            : stack
              ? state.stacks === null
                ? 'Active; stacks unknown'
                : String(state.stacks)
              : 'Active',
    };
  });
  const notes: string[] = [];
  if (!season)
    notes.push(
      'This decision guide is only reviewed for the supported 12.1 Season 2 partition.',
    );
  else if (!usable)
    notes.push(
      'Complete cast and buff evidence, an unambiguous cast, and its pull are needed to explain this decision.',
    );
  else if (build.hero.value === 'unknown')
    notes.push(
      'Hero evidence is missing or conflicting; no hero-specific priority is applied.',
    );
  else {
    const salvo = index.before(ARCANE.salvo, at);
    const clear = index.before(ARCANE.clearcasting, at);
    const soul = index.before(ARCANE.soul, at);
    const surge = index.before(ARCANE.surgeBuff, at);
    const threshold = build.hero.value === 'Sunfury' ? 12 : 15;
    const setup = evidence!.casts.some(
      (c) =>
        (c.id === ARCANE.surge || c.id === ARCANE.touch) &&
        at >= castDecisionTime(c) - 3 &&
        at <= c.time + (c.id === ARCANE.surge ? 25 : 20),
    );
    if (cast!.id === ARCANE.missiles) {
      if (setup || surge.active === true || soul.active === true)
        notes.push(
          'This channel overlaps a detected burst setup or buff. The ordinary Missiles threshold alone cannot judge it.',
        );
      else if (
        build.hero.value === 'Spellslinger' &&
        (clear.stacks === null || clear.stacks >= 3)
      )
        notes.push(
          'The Spellslinger AoE three-stack exception cannot be excluded. No spend-first recommendation is made.',
        );
      else if (
        surge.active !== false ||
        (build.hero.value === 'Sunfury' && soul.active !== false) ||
        clear.active !== true ||
        salvo.stacks === null
      )
        notes.push(
          'Ordinary-rotation state is not fully established. Unknown buffs are not treated as inactive.',
        );
      else
        notes.push(
          salvo.stacks >= threshold
            ? `${build.hero.value}'s ordinary Missiles branch is below ${threshold} Salvo; this cast began at ${salvo.stacks}. Review the spending branch and available alternatives before another channel.`
            : `This cast began below ${build.hero.value}'s ${threshold}-Salvo ordinary Missiles threshold with Clearcasting recorded. That condition fits; it does not establish the best available spell.`,
        );
    } else if (
      cast!.id === ARCANE.blast &&
      build.hero.value === 'Sunfury' &&
      soul.active === true
    )
      notes.push(
        'Arcane Soul was already active at the recorded decision time. The Sunfury priority puts Barrage above filler Blast in this state.',
      );
    else if (cast!.id === ARCANE.surge || cast!.id === ARCANE.touch)
      notes.push(
        'Inspect setup timing alongside the time left in this pull. A delayed follow-up may reflect a planned hold; readiness is not reconstructed.',
      );
    else
      notes.push(
        'Use the recorded state to compare this choice with the applicable guide branch; it is not a simulated next-spell verdict.',
      );
    if (cast!.beganAt === undefined)
      notes.push(
        'A separate cast-start timestamp is unavailable. State is sampled before the recorded cast event.',
      );
  }
  return { hero: build.hero, states, notes, source: ARCANE_GUIDE.url, usable };
}
