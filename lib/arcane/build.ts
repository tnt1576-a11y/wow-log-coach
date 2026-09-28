import type { RunEvidence, RunMetrics } from '../domain';
import { METHOD_GUIDES, methodBuild } from '../guides/method';
import {
  ARCANE,
  ARCANE_TALENTS,
  type ArcaneTalentKey,
  type BuildOverrides,
  type Hero,
} from './catalog';

export type BuildChoice<T> = {
  value: T;
  source:
    | 'logged talent'
    | 'observed effect'
    | 'user confirmed'
    | 'unknown'
    | 'conflict';
};
export function arcaneBuild(
  metrics: RunMetrics,
  evidence?: RunEvidence,
  overrides: BuildOverrides = {},
) {
  const effects = new Set([
    ...metrics.abilities
      .filter((spell) => spell.total > 0)
      .map((spell) => spell.id),
    ...(metrics.casts ?? [])
      .filter((spell) => spell.uses > 0)
      .map((spell) => spell.id),
    ...(evidence?.casts ?? []).map((spell) => spell.id),
    ...metrics.buffs
      .filter((spell) => (spell.uptime ?? 0) > 0)
      .map((spell) => spell.id),
    ...(evidence?.arcane?.auras ?? [])
      .filter((event) => event.type !== 'removebuff')
      .map((event) => event.id),
  ]);
  const learned = new Set(
    (metrics.character?.talents ?? []).map((talent) => talent.spellId),
  );
  const loggedHero = methodBuild(METHOD_GUIDES[0], metrics);
  const sunfury =
    loggedHero.conflict ||
    loggedHero.hero === 'Sunfury' ||
    effects.has(ARCANE.soul) ||
    effects.has(ARCANE.sphere);
  const spellslinger =
    loggedHero.conflict ||
    loggedHero.hero === 'Spellslinger' ||
    effects.has(ARCANE.splinter);
  let hero: BuildChoice<Hero> =
    sunfury && spellslinger
      ? { value: 'unknown', source: 'conflict' }
      : sunfury
        ? {
            value: 'Sunfury',
            source: loggedHero.hero ? 'logged talent' : 'observed effect',
          }
        : spellslinger
          ? {
              value: 'Spellslinger',
              source: loggedHero.hero ? 'logged talent' : 'observed effect',
            }
          : { value: 'unknown', source: 'unknown' };
  if (
    overrides.hero &&
    overrides.hero !== 'auto' &&
    overrides.hero !== 'unknown'
  ) {
    hero =
      hero.source === 'conflict' ||
      (hero.value !== 'unknown' && hero.value !== overrides.hero)
        ? { value: 'unknown', source: 'conflict' }
        : { value: overrides.hero, source: 'user confirmed' };
  }
  const talents = {} as Record<ArcaneTalentKey, BuildChoice<boolean | null>>;
  for (const talent of ARCANE_TALENTS) {
    let choice: BuildChoice<boolean | null> = learned.has(talent.spellId)
      ? { value: true, source: 'logged talent' }
      : talent.effects.some((id) => effects.has(id))
        ? { value: true, source: 'observed effect' }
        : { value: null, source: 'unknown' };
    if (overrides[talent.key] === 'yes')
      choice = { value: true, source: 'user confirmed' };
    if (overrides[talent.key] === 'no')
      choice =
        choice.value === true
          ? { value: null, source: 'conflict' }
          : { value: false, source: 'user confirmed' };
    talents[talent.key] = choice;
  }
  return {
    hero,
    talents,
    loggedTalentCount: metrics.character?.talents?.length ?? 0,
  };
}
