export const SURVIVAL_GUIDE = {
  url: 'https://www.icy-veins.com/wow/survival-hunter-pve-dps-rotation-cooldowns-abilities',
  author: 'Azortharion / Icy Veins',
  patch: '12.1',
  updated: '2026-08-30',
  reviewed: '2026-09-05',
  rankingZoneId: 55,
  partitionId: 1,
};

export const SURVIVAL = {
  killCommand: 259489,
  wildfireBomb: 259495,
  raptorStrike: 186270,
  raptorSwipe: 1262343,
  boomstick: 1261193,
  moonlightChakram: 1264949,
  takedown: 1250646,
  tipOfTheSpear: 260286,
  moonlightOverride: 1264946,
  howl: 472324,
  leadFromTheFront: 472743,
  twinFangs: 1272139,
};

export const SURVIVAL_AURAS = new Set([
  SURVIVAL.tipOfTheSpear,
  SURVIVAL.moonlightOverride,
  SURVIVAL.howl,
  SURVIVAL.leadFromTheFront,
]);
