import type { AbilityMetric } from './domain';

// Verified against WCL casts/damage tables. Only damage is canonicalized:
// channel ticks and triggered impacts must never become additional casts.
export const DAMAGE_CAST_FAMILIES: Record<
  number,
  { castId: number; name: string }
> = {
  7268: { castId: 5143, name: 'Arcane Missiles' },
  210833: { castId: 321507, name: 'Touch of the Magi' },
  153640: { castId: 153626, name: 'Arcane Orb' },
  1295939: { castId: 1295924, name: 'Prismatic Bolt' },
};

export function damageFamilies(abilities: AbilityMetric[]) {
  const families = new Map<number, AbilityMetric & { damageIds: number[] }>();
  for (const ability of abilities) {
    const family = DAMAGE_CAST_FAMILIES[ability.id];
    const id = family?.castId ?? ability.id;
    const existing = families.get(id);
    if (existing) {
      existing.total += ability.total;
      existing.damageIds.push(ability.id);
    } else
      families.set(id, {
        ...ability,
        id,
        name: family?.name ?? ability.name,
        damageIds: [ability.id],
      });
  }
  return families;
}
