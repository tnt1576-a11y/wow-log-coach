import type { AnalysisResult } from './domain';

// Specializations with expanded curated comparison checks. Other packs stay available.
const PRIORITY_SPECS = new Set([
  'Mage:Arcane',
  'DeathKnight:Frost',
  'DeathKnight:Unholy',
  'Shaman:Elemental',
  'Warlock:Demonology',
  'Rogue:Assassination',
  'Rogue:Outlaw',
  'Warrior:Arms',
]);

export function isPrioritySpec(target: AnalysisResult['target']) {
  return PRIORITY_SPECS.has(`${target.className}:${target.specName}`);
}
