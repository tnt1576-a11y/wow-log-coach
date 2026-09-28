export const FURY_GUIDE = {
  url: 'https://www.icy-veins.com/wow/fury-warrior-pve-dps-rotation-cooldowns-abilities',
  author: 'Archimtiros / Icy Veins',
  patch: '12.1',
  updated: '2026-08-10',
  reviewed: '2026-09-05',
  rankingZoneId: 55,
  partitionId: 1,
};

export const FURY = {
  rampage: 184367,
  enrage: 184362,
  recklessness: 1719,
  suddenDeath: 280776,
  execute: 280735,
  bloodthirst: 23881,
  ragingBlow: 85288,
  thunderBlastReady: 435615,
  thunderBlast: 435222,
  thunderClap: 6343,
  bladestorm: 227847,
  avatar: 107574,
  berserk: 1269349,
};

export const FURY_AURAS = new Set([
  FURY.enrage,
  FURY.recklessness,
  FURY.suddenDeath,
  FURY.thunderBlastReady,
]);

export const FURY_CORE_CASTS = new Set([
  FURY.rampage,
  FURY.execute,
  FURY.bloodthirst,
  FURY.ragingBlow,
  FURY.thunderBlast,
  FURY.thunderClap,
]);
