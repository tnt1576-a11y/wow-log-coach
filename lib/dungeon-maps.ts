import type { PullEvidence } from './domain';

export interface DungeonFloor {
  id: number;
  dungeon: string;
  floor: number;
  name: string;
  terrainPath: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  reportAliases?: number[];
}
// Oriented extents: never sort min/max. Source revision and tile provenance:
// public/maps/SOURCES.md. Includes all active floors for the eight requested dungeons.
export const DUNGEON_FLOORS: DungeonFloor[] = [
  {
    id: 2588,
    dungeon: 'Altar of Fangs',
    name: 'Sacrificial Approach',
    terrainPath: 'midnight/altar_of_fangs/1',
    floor: 1,
    minX: -1662.5,
    minY: 1414.58,
    maxX: -2552.08,
    maxY: 2008.33,
  },
  {
    id: 2589,
    dungeon: 'Altar of Fangs',
    name: 'Mutation Chambers',
    terrainPath: 'midnight/altar_of_fangs/2',
    floor: 2,
    minX: -1756.25,
    minY: 1043.75,
    maxX: -2395.83,
    maxY: 1470.83,
  },
  {
    id: 2590,
    dungeon: 'Altar of Fangs',
    name: 'Altar of Fangs',
    terrainPath: 'midnight/altar_of_fangs/3',
    floor: 3,
    minX: -1627.5,
    minY: 960,
    maxX: -2527.5,
    maxY: 1560,
  },
  {
    id: 2514,
    dungeon: 'Den of Nalorakk',
    name: 'The Foraging',
    terrainPath: 'midnight/den_of_nalorakk/2',
    floor: 2,
    minX: 5856.25,
    minY: 4014.58,
    maxX: 4731.25,
    maxY: 4764.58,
  },
  {
    id: 2564,
    dungeon: 'Den of Nalorakk',
    name: 'The Heart of Rage',
    terrainPath: 'midnight/den_of_nalorakk/3',
    floor: 3,
    minX: 5350,
    minY: 4500,
    maxX: 4406.25,
    maxY: 5129.16,
  },
  {
    id: 1004,
    dungeon: "Kings' Rest",
    name: "Kings' Rest",
    terrainPath: 'bfa/kingsrest/1',
    floor: 1,
    minX: -2440,
    minY: -1240.31,
    maxX: -3280.94,
    maxY: -679.68,
  },
  {
    id: 2433,
    dungeon: 'Murder Row',
    name: 'Murder Row',
    terrainPath: 'midnight/murder_row/1',
    floor: 1,
    minX: 5106.25,
    minY: 8633.33,
    maxX: 4629.16,
    maxY: 8952.08,
  },
  {
    id: 2435,
    dungeon: 'Murder Row',
    name: 'The Illicit Rain',
    terrainPath: 'midnight/murder_row/2',
    floor: 2,
    minX: 4895,
    minY: 8850,
    maxX: 4670,
    maxY: 9000,
  },
  {
    id: 2434,
    dungeon: 'Murder Row',
    name: "Augur's Terrace",
    terrainPath: 'midnight/murder_row/3',
    floor: 3,
    minX: 5502.08,
    minY: 8554.17,
    maxX: 4458.33,
    maxY: 9250,
  },
  {
    id: 2094,
    dungeon: 'Ruby Life Pools',
    name: 'Infusion Chambers',
    terrainPath: 'df/rubylifepools/1',
    floor: 1,
    minX: 450,
    minY: 1335,
    maxX: -75,
    maxY: 1685,
  },
  {
    id: 2095,
    dungeon: 'Ruby Life Pools',
    name: 'Ruby Overlook',
    terrainPath: 'df/rubylifepools/2',
    floor: 2,
    minX: 602.08,
    minY: 1345.83,
    maxX: -181.25,
    maxY: 1868.75,
  },
  {
    id: 1038,
    dungeon: 'Temple of Sethraliss',
    name: 'Temple of Sethraliss',
    terrainPath: 'bfa/templeofsethraliss/1',
    floor: 1,
    minX: -2789.58,
    minY: 3187.5,
    maxX: -3916.67,
    maxY: 3937.5,
  },
  {
    id: 1043,
    dungeon: 'Temple of Sethraliss',
    name: 'Atrium of Sethraliss',
    terrainPath: 'bfa/templeofsethraliss/2',
    floor: 2,
    minX: -3185.42,
    minY: 3760.42,
    maxX: -3972,
    maxY: 4285.42,
  },
  {
    id: 2500,
    dungeon: 'The Blinding Vale',
    name: 'The Blinding Vale',
    terrainPath: 'midnight/the_blinding_vale/1',
    floor: 1,
    minX: -1202.08,
    minY: 916.67,
    maxX: -2341.67,
    maxY: 1675,
  },
  {
    id: 2574,
    dungeon: 'Voidscar Arena',
    name: 'Halls of Spite',
    terrainPath: 'midnight/voidscar_arena/1',
    floor: 1,
    minX: 705,
    minY: 4358.33,
    maxX: 204.99,
    maxY: 4691.66,
  },
  {
    id: 2572,
    dungeon: 'Voidscar Arena',
    name: 'Voidscar Arena',
    terrainPath: 'midnight/voidscar_arena/2',
    floor: 2,
    minX: 720.83,
    minY: 4368.75,
    maxX: 195.83,
    maxY: 4718.75,
  },
  {
    id: 2573,
    dungeon: 'Voidscar Arena',
    name: "Domanaar's Ascent",
    terrainPath: 'midnight/voidscar_arena/3',
    floor: 3,
    minX: 912.5,
    minY: 4716.66,
    maxX: 18.75,
    maxY: 5312.5,
  },
];

export function dungeonFloor(id: number | null | undefined, dungeon?: string) {
  const normalized = dungeon?.toLowerCase().replace(/[^a-z]/g, '');
  if (id === 1978 && normalized === 'rubylifepools') {
    const floor = DUNGEON_FLOORS.find((item) => item.id === 2095)!;
    return { ...floor, reportAliases: [1978] };
  }
  return DUNGEON_FLOORS.find((floor) => floor.id === id);
}
export function projectPull(pull: PullEvidence, floor: DungeonFloor) {
  if (
    (pull.mapId !== floor.id &&
      !floor.reportAliases?.includes(pull.mapId ?? -1)) ||
    pull.x === null ||
    pull.y === null
  )
    return null;
  const u = 1 - (pull.x / 100 - floor.minX) / (floor.maxX - floor.minX);
  const v = 1 - (pull.y / 100 - floor.minY) / (floor.maxY - floor.minY);
  if (
    !Number.isFinite(u) ||
    !Number.isFinite(v) ||
    u < 0 ||
    u > 1 ||
    v < 0 ||
    v > 1
  )
    return null;
  return { x: u * 768, y: v * 512 };
}
export function floorTiles(floor: DungeonFloor) {
  const slug = floor.terrainPath.split('/')[1].replaceAll('_', '-');
  return [0, 1].flatMap((x) =>
    [0, 1].map((y) => ({
      x: x * 384,
      y: y * 256,
      width: 384,
      height: 256,
      src: '/maps/' + slug + '/' + floor.floor + '-' + x + '-' + y + '.png',
    })),
  );
}
