import type {
  GearComparison,
  MetricDistribution,
  RunMetrics,
  SpellComparison,
} from './domain';
import { distribution, quantile } from './statistics';
import { isCombatGearSlot, statOrder } from './gear';
import { damageFamilies } from './spell-families';

export function compareSpells(
  target: RunMetrics,
  references: RunMetrics[],
): SpellComparison[] {
  const available = references.filter((reference) =>
    Array.isArray(reference.casts),
  );
  const targetDamage = damageFamilies(target.abilities);
  const referenceDamage = references.map((reference) =>
    damageFamilies(reference.abilities),
  );
  const spells = new Map(
    [
      ...referenceDamage.flatMap((damage) => [...damage.values()]),
      ...targetDamage.values(),
      ...(target.casts ?? []),
      ...available.flatMap((reference) => reference.casts ?? []),
    ].map((ability) => [ability.id, ability]),
  );
  return [...spells.values()]
    .map((spell) => {
      const cast = target.casts?.find((item) => item.id === spell.id);
      const damage = targetDamage.get(spell.id);
      return {
        id: spell.id,
        name: spell.name,
        icon: spell.icon,
        damageIds: [
          ...new Set([
            ...(damage?.damageIds ?? []),
            ...referenceDamage.flatMap(
              (map) => map.get(spell.id)?.damageIds ?? [],
            ),
          ]),
        ],
        targetUses: cast?.uses ?? 0,
        referenceUsers: available.filter((reference) =>
          reference.casts?.some(
            (item) => item.id === spell.id && item.uses > 0,
          ),
        ).length,
        casts: distribution(
          'ability-' + spell.id + '-cpm',
          spell.name,
          'perMinute',
          'context',
          cast?.perMinute ?? 0,
          available.map(
            (reference) =>
              reference.casts?.find((item) => item.id === spell.id)
                ?.perMinute ?? 0,
          ),
        ),
        damage: distribution(
          'ability-' + spell.id + '-dps',
          spell.name,
          'damage',
          'context',
          (damage?.total ?? 0) / target.durationSeconds,
          references.map(
            (reference, index) =>
              (referenceDamage[index].get(spell.id)?.total ?? 0) /
              reference.durationSeconds,
          ),
        ),
      };
    })
    .sort(
      (a, b) =>
        b.damage.target + b.damage.median - (a.damage.target + a.damage.median),
    );
}

export function compareBuffs(
  target: RunMetrics,
  references: RunMetrics[],
): MetricDistribution[] {
  if (target.buffsAvailable === false) return [];
  references = references.filter(
    (reference) => reference.buffsAvailable !== false,
  );
  const buffs = new Map(
    [
      ...target.buffs,
      ...references.flatMap((reference) => reference.buffs),
    ].map((buff) => [buff.id, buff]),
  );
  return [...buffs.values()]
    .map((buff) => ({
      ...distribution(
        'buff-' + buff.id,
        buff.name,
        'percent',
        'context',
        target.buffs.find((item) => item.id === buff.id)?.uptime ?? 0,
        references.map(
          (reference) =>
            reference.buffs.find((item) => item.id === buff.id)?.uptime ?? 0,
        ),
      ),
      icon: buff.icon,
    }))
    .filter((buff) => buff.target > 0 || buff.median > 0)
    .sort(
      (a, b) => Math.abs(b.target - b.median) - Math.abs(a.target - a.median),
    );
}

export function compareGear(
  target: RunMetrics,
  references: RunMetrics[],
): GearComparison {
  const snapshots = references.flatMap((reference) =>
    reference.character ? [reference.character] : [],
  );
  const character = target.character;
  const itemLevels = snapshots.flatMap((snapshot) =>
    snapshot.itemLevel !== null ? [snapshot.itemLevel] : [],
  );
  const stats = Object.entries(character?.stats ?? {})
    .sort(([a], [b]) => statOrder(a) - statOrder(b) || a.localeCompare(b))
    .map(([name, value]) =>
      distribution(
        'stat-' + name,
        name,
        'number',
        'context',
        value,
        snapshots.flatMap((snapshot) =>
          typeof snapshot.stats[name] === 'number'
            ? [snapshot.stats[name]]
            : [],
        ),
      ),
    );
  const slots = [
    ...new Set(
      [
        ...(character?.gear ?? []),
        ...snapshots.flatMap((snapshot) => snapshot.gear),
      ]
        .map((item) => item.slot)
        .filter(isCombatGearSlot),
    ),
  ].sort((a, b) => a - b);
  return {
    snapshotCount: snapshots.length,
    itemLevel:
      character?.itemLevel !== null && character?.itemLevel !== undefined
        ? distribution(
            'itemLevel',
            'Equipped item level',
            'number',
            'context',
            character.itemLevel,
            itemLevels,
          )
        : null,
    stats,
    slots: slots.map((slot) => {
      const equipped = snapshots.flatMap((snapshot) =>
        snapshot.gear.filter((item) => item.slot === slot),
      );
      // Rings and trinkets can swap slots. Popularity is per player across the pair.
      const pair =
        slot === 10 || slot === 11
          ? [10, 11]
          : slot === 12 || slot === 13
            ? [12, 13]
            : [slot];
      const popular = new Map<
        number,
        { item: (typeof equipped)[number]; count: number }
      >();
      for (const snapshot of snapshots) {
        const unique = new Map(
          snapshot.gear
            .filter((item) => pair.includes(item.slot))
            .map((item) => [item.id, item]),
        );
        for (const item of unique.values()) {
          const existing = popular.get(item.id);
          if (existing) existing.count++;
          else popular.set(item.id, { item, count: 1 });
        }
      }
      return {
        slot,
        target: character?.gear.find((item) => item.slot === slot) ?? null,
        medianItemLevel: quantile(
          equipped.map((item) => item.itemLevel),
          0.5,
        ),
        sampleSize: equipped.length,
        enchantedCount: equipped.filter((item) => item.enchant).length,
        gemmedCount: equipped.filter((item) => item.gems.length).length,
        popular: [...popular.values()]
          .sort((a, b) => b.count - a.count || a.item.id - b.item.id)
          .slice(0, 3),
      };
    }),
  };
}
