import { methodSource } from '../guides/method';
export const DEMONOLOGY_GUIDE = {
  ...methodSource('demonology-warlock', 'Sjeletyven', '2026-08-11'),
  rankingZoneId: 55,
  partitionId: 1,
};

export const DEMONOLOGY = {
  tyrant: 265187,
  handOfGuldan: 105174,
  dreadstalkers: 104316,
  demonbolt: 264178,
  demonicCore: 264173,
  powerSiphon: 264130,
  implosion: 196277,
  infernalBolt: 434506,
  shadowBolt: 686,
};

export const DEMONOLOGY_AURAS = new Set([DEMONOLOGY.demonicCore]);
