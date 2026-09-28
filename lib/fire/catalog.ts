export const FIRE_GUIDE = {
  url: 'https://www.icy-veins.com/wow/fire-mage-pve-dps-rotation-cooldowns-abilities',
  author: 'Dutchmagoz / Icy Veins',
  patch: '12.1',
  updated: '2026-08-10',
  reviewed: '2026-09-04',
  rankingZoneId: 55,
  partitionId: 1,
};

export const FIRE = {
  fireball: 133,
  pyroblast: 11366,
  fireBlast: 108853,
  scorch: 2948,
  flamestrike: 2120,
  combustion: 190319,
  meteor: 153561,
  frostfireBolt: 431044,
  heatingUp: 48107,
  hotStreak: 48108,
  hyperthermia: 1242220,
  pyroclasm: 269651,
};

export const FIRE_AURAS = new Set([
  FIRE.combustion,
  FIRE.heatingUp,
  FIRE.hotStreak,
  FIRE.hyperthermia,
  FIRE.pyroclasm,
]);
