# Dungeon terrain sources

Verified 2026-09-03 for local WoW Log Coach use. Map artwork/data is copyright
Blizzard Entertainment; tiles are served by [Keystone.guru](https://keystone.guru).
Public availability does not establish an open reuse license. Review rights before
redistributing the assets outside this local project.

## Sources and layout

[Dungeon metadata at verified revision](https://github.com/RaiderIO/keystone.guru/blob/5bb81a32e6ba1a97b4f9210753f696b8605a33fc/database/seeders/dungeondata/dungeons.json)
(revision dated 2026-09-01).
[Coordinate transform](https://github.com/RaiderIO/keystone.guru/blob/5bb81a32e6ba1a97b4f9210753f696b8605a33fc/app/Service/Coordinates/CoordinatesService.php).
[Published floor aliases](https://github.com/RaiderIO/keystone.guru/blob/5bb81a32e6ba1a97b4f9210753f696b8605a33fc/app/Models/Floor/Floor.php).

Tile URL: `https://assets.keystone.guru/tiles/{terrainPath}/1/{x}_{y}.png`.
For each floor, x and y are each 0 or 1. Each tile is 384x256; four assemble to
768x512, x increasing right and y down. All 68 local PNGs and their dimensions
are regression-tested. The seven added dungeons' 56 URLs were HTTP200 image/png.
Altar's 12 URLs were verified on 2026-09-02.

| Dungeon | Floor name | WCL/UI map ID | terrainPath | minX | minY | maxX | maxY |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Altar of Fangs | Sacrificial Approach | 2588 | midnight/altar_of_fangs/1 | -1662.5 | 1414.58 | -2552.08 | 2008.33 |
| Altar of Fangs | Mutation Chambers | 2589 | midnight/altar_of_fangs/2 | -1756.25 | 1043.75 | -2395.83 | 1470.83 |
| Altar of Fangs | Altar of Fangs | 2590 | midnight/altar_of_fangs/3 | -1627.5 | 960 | -2527.5 | 1560 |
| Den of Nalorakk | The Foraging | 2514 | midnight/den_of_nalorakk/2 | 5856.25 | 4014.58 | 4731.25 | 4764.58 |
| Den of Nalorakk | The Heart of Rage | 2564 | midnight/den_of_nalorakk/3 | 5350 | 4500 | 4406.25 | 5129.16 |
| Kings' Rest | Kings' Rest | 1004 | bfa/kingsrest/1 | -2440 | -1240.31 | -3280.94 | -679.68 |
| Murder Row | Murder Row | 2433 | midnight/murder_row/1 | 5106.25 | 8633.33 | 4629.16 | 8952.08 |
| Murder Row | The Illicit Rain | 2435 | midnight/murder_row/2 | 4895 | 8850 | 4670 | 9000 |
| Murder Row | Augur's Terrace | 2434 | midnight/murder_row/3 | 5502.08 | 8554.17 | 4458.33 | 9250 |
| Ruby Life Pools | Infusion Chambers | 2094 | df/rubylifepools/1 | 450 | 1335 | -75 | 1685 |
| Ruby Life Pools | Ruby Overlook | 2095 | df/rubylifepools/2 | 602.08 | 1345.83 | -181.25 | 1868.75 |
| Temple of Sethraliss | Temple of Sethraliss | 1038 | bfa/templeofsethraliss/1 | -2789.58 | 3187.5 | -3916.67 | 3937.5 |
| Temple of Sethraliss | Atrium of Sethraliss | 1043 | bfa/templeofsethraliss/2 | -3185.42 | 3760.42 | -3972 | 4285.42 |
| The Blinding Vale | The Blinding Vale | 2500 | midnight/the_blinding_vale/1 | -1202.08 | 916.67 | -2341.67 | 1675 |
| Voidscar Arena | Halls of Spite | 2574 | midnight/voidscar_arena/1 | 705 | 4358.33 | 204.99 | 4691.66 |
| Voidscar Arena | Voidscar Arena | 2572 | midnight/voidscar_arena/2 | 720.83 | 4368.75 | 195.83 | 4718.75 |
| Voidscar Arena | Domanaar's Ascent | 2573 | midnight/voidscar_arena/3 | 912.5 | 4716.66 | 18.75 | 5312.5 |

## Calibration and exceptions

Oriented bounds must not be numerically sorted. WCL coordinates are scaled by
100. Project with `u = 1 - (wclX / 100 - minX) / (maxX - minX)` and
`v = 1 - (wclY / 100 - minY) / (maxY - minY)`; pixel positions are
`(u * 768, v * 512)`. Reject wrong-floor and out-of-bounds points.
Never substitute a fight's activity bounding box for terrain calibration.

- Den's Dreamer's Passage (UI2513, floor1) is inactive in the source and all
  four tile URLs returned404. It is intentionally excluded.
- Combined overview facade floors with UI0 and zero bounds are excluded.
- Ruby Life Pools UI1978 aliases UI2095 only when the report dungeon is Ruby
  Life Pools. Never apply this open-world alias globally.
- Returning BFA/Dragonflight dungeons use their current published entries;
  there are no separate matching Midnight entries in this metadata revision.
- Marker numbers are WCL pull IDs. Positions locate first-hit enemies, not
  player movement, a recommended route, or complete pack boundaries.
