import { methodSource } from '../guides/method';
export const ARCANE_GUIDE = {
  ...methodSource('arcane-mage', 'Khaelt', '2026-09-05'),
  rankingZoneId: 55,
  partitionId: 1,
};
export const ARCANE = {
  missiles: 5143,
  barrage: 44425,
  blast: 30451,
  orb: 153626,
  surge: 365350,
  touch: 321507,
  evocation: 12051,
  bolt: 1295924,
  clearcasting: 263725,
  salvo: 1242974,
  soul: 451038,
  surgeBuff: 365362,
  sphere: 448604,
  splinter: 443763,
  boltProc: 1295942,
  cumulative: 1296930,
  overpoweredBuff: 1277009,
};
export const ARCANE_AURAS = new Set([
  ARCANE.clearcasting,
  ARCANE.salvo,
  ARCANE.soul,
  ARCANE.surgeBuff,
  ARCANE.sphere,
  ARCANE.boltProc,
  ARCANE.cumulative,
  ARCANE.overpoweredBuff,
]);
export const ARCANE_TALENTS = [
  { key: 'pulse', label: 'Arcane Pulse', spellId: 1241462, effects: [1241462] },
  {
    key: 'presence',
    label: 'Presence of Mind',
    spellId: 205025,
    effects: [205025],
  },
  { key: 'evocation', label: 'Evocation', spellId: 12051, effects: [12051] },
  { key: 'orbMastery', label: 'Orb Mastery', spellId: 1243435, effects: [] },
  { key: 'highVoltage', label: 'High Voltage', spellId: 461248, effects: [] },
  {
    key: 'overpowered',
    label: 'Overpowered Missiles',
    spellId: 1244329,
    effects: [1277009],
  },
  {
    key: 'tier4',
    label: 'Season 2 four-piece',
    spellId: 1296582,
    effects: [1296930],
  },
  {
    key: 'apex',
    label: 'Prismatic Bolt',
    spellId: 1295923,
    effects: [1295924, 1295942],
  },
] as const;
export type ArcaneTalentKey = (typeof ARCANE_TALENTS)[number]['key'];
export type Hero = 'Sunfury' | 'Spellslinger' | 'unknown';
export type BuildOverrides = Partial<
  Record<ArcaneTalentKey, 'yes' | 'no' | 'auto'>
> & { hero?: Hero | 'auto' };
