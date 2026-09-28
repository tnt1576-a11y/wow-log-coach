import type { GearComparison } from './domain';

// WCL uses zero-based equipment slots. Retail combat gear ends at off hand.
export const isCombatGearSlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot <= 16 && slot !== 3;

export function statOrder(name: string): number {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  if (
    ['strength', 'agility', 'intellect', 'primary', 'primarystat'].includes(key)
  )
    return 0;
  if (key === 'stamina') return 1;
  if (/^(crit|critical)/.test(key)) return 2;
  if (key.startsWith('haste')) return 3;
  if (key.startsWith('mastery')) return 4;
  if (key.startsWith('versatility')) return 5;
  return 6;
}

export function cohortItem(slot: GearComparison['slots'][number]) {
  const paired = [10, 11, 12, 13].includes(slot.slot);
  const rank = slot.slot === 11 || slot.slot === 13 ? 1 : 0;
  const noun = slot.slot <= 11 ? 'ring' : 'trinket';
  return {
    entry: slot.popular[rank],
    label: paired
      ? (rank ? '#2 most common ' : '#1 most common ') + noun + ' (either slot)'
      : 'Most common reference item',
    missing:
      paired && rank ? 'No second distinct item recorded' : 'Unavailable',
    paired,
  };
}
