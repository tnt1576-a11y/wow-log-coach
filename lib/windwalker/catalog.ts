export const WINDWALKER_GUIDE = {
  url: 'https://www.icy-veins.com/wow/windwalker-monk-pve-dps-rotation-cooldowns-abilities',
  author: 'Babylonius / Icy Veins',
  patch: '12.1',
  updated: '2026-08-11',
  reviewed: '2026-09-05',
  rankingZoneId: 55,
  partitionId: 1,
};

export const WINDWALKER = {
  tigerPalm: 100780,
  blackoutKick: 100784,
  risingSunKick: 107428,
  fistsOfFury: 113656,
  spinningCraneKick: 101546,
  danceOfChiJi: 325202,
};

// Deliberately limited to verified manual core casts. An intervening unknown
// action breaks comparison; it is never silently removed from the sequence.
export const WINDWALKER_CORE_CASTS = new Set([
  WINDWALKER.tigerPalm,
  WINDWALKER.blackoutKick,
  WINDWALKER.risingSunKick,
  WINDWALKER.fistsOfFury,
  WINDWALKER.spinningCraneKick,
]);

export const WINDWALKER_AURAS = new Set([WINDWALKER.danceOfChiJi]);
