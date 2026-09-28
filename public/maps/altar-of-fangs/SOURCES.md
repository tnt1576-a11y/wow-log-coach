# Altar of Fangs terrain

Verified 2026-09-02 for the local WoW Log Coach dashboard.

Map artwork/data: copyright Blizzard Entertainment. Tiles served by
[Keystone.guru](https://keystone.guru). No open-source license for the
artwork is asserted; attribution is not a grant of redistribution rights.
Review rights before distributing the assets outside this local project.

## Tile source

`https://assets.keystone.guru/tiles/midnight/altar_of_fangs/{floor}/1/{x}_{y}.png`

Floors 1, 2, 3; x and y each 0 or 1. Each PNG is 384 by 256 pixels.
The four tiles assemble into a 768 by 512 image, with x increasing right
and y increasing down. Local names are `{floor}-{x}-{y}.png`.

## Floor IDs and calibration

[Dungeon metadata](https://github.com/RaiderIO/keystone.guru/blob/master/database/seeders/dungeondata/dungeons.json)
under the `altar_of_fangs` key supplies the following oriented world extents.
Do not numerically reorder min/max: their orientation is intentional.

| WCL/UI map ID | Floor | Name | minX | minY | maxX | maxY |
| --- | --- | --- | --- | --- | --- | --- |
| 2588 | 1 | Sacrificial Approach | -1662.5 | 1414.58 | -2552.08 | 2008.33 |
| 2589 | 2 | Mutation Chambers | -1756.25 | 1043.75 | -2395.83 | 1470.83 |
| 2590 | 3 | Altar of Fangs | -1627.5 | 960 | -2527.5 | 1560 |

[Coordinate conversion reference](https://github.com/RaiderIO/keystone.guru/blob/master/app/Service/Coordinates/CoordinatesService.php).
WCL coordinates are divided by 100 before this projection:

```text
u = 1 - (worldX - minX) / (maxX - minX)
v = 1 - (worldY - minY) / (maxY - minY)
pixelX = u * 768
pixelY = v * 512
```

Missing, wrong-floor, non-finite, or out-of-bounds positions are excluded.
WCL fight bounding boxes describe recorded activity, not terrain extents,
so they must not be used to stretch the map to the observed pulls.
