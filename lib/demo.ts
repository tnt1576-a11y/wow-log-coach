import type { AnalysisResult, InspectionResult } from './domain';
import { compareBuffs, compareGear, compareSpells } from './comparisons';
import { buildDistributions, buildFindings } from './statistics';
import { findCastGaps } from './evidence';
import { defensiveSpell } from './defensives';

export const demoInspection: InspectionResult = {
  reportCode: 'example',
  reportTitle: 'WoW Log Coach preview',
  reportStartTime: Date.now() - 4 * 24 * 60 * 60 * 1000,
  partition: { id: 1, name: 'Current partition' },
  fights: [
    {
      id: 1,
      name: 'Altar of Fangs',
      startTime: 0,
      endTime: 1_721_000,
      keystoneLevel: 12,
      keystoneBonus: 1,
      keystoneTime: 1_721_000,
      keystoneAffixes: [9, 160],
      averageItemLevel: 684.2,
      encounterId: 12669,
      zoneName: 'Altar of Fangs',
      players: [
        {
          id: 7,
          name: 'Fyrakkson',
          className: 'Mage',
          specName: 'Fire',
          server: 'Preview',
        },
      ],
    },
  ],
  selectedFightId: 1,
  selectedSourceId: 7,
};

export const demoAnalysis: AnalysisResult = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target: {
    reportCode: 'example',
    fightId: 1,
    sourceId: 7,
    player: 'Fyrakkson',
    className: 'Mage',
    specName: 'Fire',
    dungeon: 'Altar of Fangs',
    keyLevel: 12,
    rankingZoneId: 55,
    duration: 1_721_000,
    affixes: [9, 160],
    url: 'https://www.warcraftlogs.com',
  },
  cohort: {
    requestedSize: 20,
    actualSize: 20,
    percentileMin: 95,
    percentileMax: 100,
    dateLabel: 'Last 14 days',
    partition: { id: 1, name: 'Current partition' },
    affixesMatched: true,
    confidence: 'high',
  },
  targetMetrics: {
    dps: 1_620_000,
    activeDps: 1_811_000,
    damage: 2_788_020_000,
    durationSeconds: 1721,
    castsPerMinute: 37.8,
    interrupts: 18,
    deaths: 1,
    damageTakenPerSecond: 91_400,
    abilities: [
      {
        id: 133,
        name: 'Fireball',
        total: 618_000_000,
        uses: 228,
        perMinute: 7.95,
      },
      {
        id: 11366,
        name: 'Pyroblast',
        total: 574_000_000,
        uses: 164,
        perMinute: 5.72,
      },
      {
        id: 108853,
        name: 'Fire Blast',
        total: 384_000_000,
        uses: 141,
        perMinute: 4.92,
      },
      {
        id: 2948,
        name: 'Scorch',
        total: 243_000_000,
        uses: 116,
        perMinute: 4.04,
      },
    ],
    buffs: [
      {
        id: 190319,
        name: 'Combustion',
        total: 0,
        uses: 7,
        perMinute: 0.24,
        uptime: 7.1,
      },
      {
        id: 48107,
        name: 'Heating Up',
        total: 0,
        uses: 88,
        perMinute: 3.07,
        uptime: 32.6,
      },
    ],
  },
  metrics: [
    {
      id: 'dps',
      label: 'Overall DPS',
      unit: 'damage',
      direction: 'higher',
      target: 1_620_000,
      median: 1_910_000,
      p25: 1_830_000,
      p75: 2_040_000,
      targetPercentile: 10,
      sampleSize: 20,
    },
    {
      id: 'activeDps',
      label: 'Active DPS',
      unit: 'damage',
      direction: 'higher',
      target: 1_811_000,
      median: 2_030_000,
      p25: 1_950_000,
      p75: 2_180_000,
      targetPercentile: 15,
      sampleSize: 20,
    },
    {
      id: 'castsPerMinute',
      label: 'Casts per minute',
      unit: 'perMinute',
      direction: 'higher',
      target: 37.8,
      median: 41.1,
      p25: 39.6,
      p75: 43.2,
      targetPercentile: 20,
      sampleSize: 20,
    },
    {
      id: 'interrupts',
      label: 'Interrupts',
      unit: 'number',
      direction: 'higher',
      target: 18,
      median: 16,
      p25: 13,
      p75: 18,
      targetPercentile: 90,
      sampleSize: 20,
    },
    {
      id: 'deaths',
      label: 'Deaths',
      unit: 'number',
      direction: 'lower',
      target: 1,
      median: 0,
      p25: 0,
      p75: 1,
      targetPercentile: 50,
      sampleSize: 20,
    },
    {
      id: 'damageTakenPerSecond',
      label: 'Damage taken / sec',
      unit: 'damage',
      direction: 'lower',
      target: 91_400,
      median: 83_100,
      p25: 77_900,
      p75: 89_500,
      targetPercentile: 25,
      sampleSize: 20,
    },
  ],
  findings: [
    {
      id: 'dps-opportunity',
      category: 'damage',
      severity: 'moderate',
      confidence: 'high',
      title: 'Overall DPS is below the typical range',
      detail:
        'Your total damage is 15.2% below the cohort median. Cast activity explains part of the gap; review cooldown windows before changing spell priority.',
      targetValue: 1_620_000,
      medianValue: 1_910_000,
      deltaPercent: -15.2,
      metricId: 'dps',
    },
    {
      id: 'casts-opportunity',
      category: 'rotation',
      severity: 'moderate',
      confidence: 'high',
      title: 'Longer gaps during large trash pulls',
      detail:
        'Your cast activity is below the middle 50% of comparable players. Review idle gaps and movement planning before changing spell priority.',
      targetValue: 37.8,
      medianValue: 41.1,
      deltaPercent: -8.0,
      metricId: 'castsPerMinute',
    },
    {
      id: 'interrupts-positive',
      category: 'utility',
      severity: 'positive',
      confidence: 'high',
      title: 'Interrupt usage is ahead of the cohort',
      detail:
        'This is a strength. You interrupted more often than the median comparison player.',
      targetValue: 18,
      medianValue: 16,
      deltaPercent: 12.5,
      metricId: 'interrupts',
    },
  ],
  references: Array.from({ length: 20 }, (_, index) => ({
    player: 'Reference' + (index + 1),
    className: 'Mage',
    specName: 'Fire',
    reportCode: 'preview' + index,
    fightId: index + 1,
    sourceId: index + 10,
    percentile: 99.9 - index * 0.2,
    dps: 2_080_000 - index * 18_000,
    duration: 1_620_000 + index * 8_000,
    startTime: Date.now() - index * 8 * 60 * 60 * 1000,
    affixes: [9, 160],
    server: 'Preview',
    url: 'https://www.warcraftlogs.com',
  })),
  warnings: [
    'This is preview data. Paste a real public report after configuring Warcraft Logs credentials.',
  ],
};

function enrichPreview() {
  // Deliberately synthetic fixtures, not current patch advice or real gear recommendations.
  const iconNames: Record<number, string> = {
    133: 'spell_fire_flamebolt.jpg',
    11366: 'spell_fire_fireball02.jpg',
    108853: 'spell_fire_fireball.jpg',
    2948: 'spell_fire_soulburn.jpg',
    190319: 'spell_fire_sealoffire.jpg',
    48107: 'ability_mage_hotstreak.jpg',
  };
  const target = demoAnalysis.targetMetrics;
  target.abilities = target.abilities.map((spell) => ({
    ...spell,
    icon: iconNames[spell.id],
  }));
  target.buffs = target.buffs.map((spell) => ({
    ...spell,
    icon: iconNames[spell.id],
  }));
  target.casts = [
    ...target.abilities.map((spell) => ({ ...spell, total: spell.uses })),
    {
      id: 190319,
      name: 'Combustion',
      icon: iconNames[190319],
      total: 7,
      uses: 7,
      perMinute: 7 / (1721 / 60),
    },
  ];
  const defenseTimes: Record<number, number[]> = {
    235313: [80, 400, 780, 1200, 1480],
    110959: [804, 1330],
    6262: [808],
  };
  for (const [key, times] of Object.entries(defenseTimes)) {
    const spell = defensiveSpell(Number(key))!;
    target.casts.push({
      id: spell.id,
      name: spell.name,
      icon: spell.icon,
      total: times.length,
      uses: times.length,
      perMinute: times.length / (1721 / 60),
    });
  }
  target.castsPerMinute =
    target.casts.reduce((sum, spell) => sum + spell.uses, 0) / (1721 / 60);
  target.character = {
    itemLevel: 684,
    stats: {
      Intellect: 35000,
      Haste: 16000,
      Crit: 12000,
      Mastery: 9000,
      Versatility: 3000,
    },
    talentCount: 61,
    potionUse: 2,
    healthstoneUse: 1,
    gear: [
      {
        id: -1,
        slot: 0,
        name: 'Illustrative cloth hood',
        icon: 'inv_helmet_53.jpg',
        itemLevel: 684,
        gems: [],
      },
      {
        id: -2,
        slot: 4,
        name: 'Illustrative cloth robe',
        icon: 'inv_chest_cloth_21.jpg',
        itemLevel: 681,
        enchant: 'Recorded chest enchant',
        gems: [],
      },
      {
        id: -3,
        slot: 10,
        name: 'Illustrative ring',
        icon: 'inv_jewelry_ring_03.jpg',
        itemLevel: 684,
        enchant: 'Recorded ring enchant',
        gems: [],
      },
      {
        id: -4,
        slot: 12,
        name: 'Illustrative trinket',
        icon: 'inv_misc_orb_01.jpg',
        itemLevel: 678,
        gems: [],
      },
      {
        id: -5,
        slot: 15,
        name: 'Illustrative staff',
        icon: 'inv_staff_13.jpg',
        itemLevel: 684,
        enchant: 'Recorded weapon enchant',
        gems: [],
      },
    ],
  };
  target.damageTaken = [
    {
      id: 1,
      name: 'Illustrative ground effect',
      icon: 'spell_fire_selfdestruct.jpg',
      total: 54000000,
      uses: 0,
      perMinute: 0,
    },
    {
      id: 2,
      name: 'Illustrative group-wide hit',
      icon: 'spell_shadow_shadowbolt.jpg',
      total: 82000000,
      uses: 0,
      perMinute: 0,
    },
  ];
  const referenceMetrics = demoAnalysis.references.map((reference, index) => {
    const character = {
      ...target.character!,
      itemLevel: 685 + (index % 5),
      stats: {
        Intellect: 36000 + index * 100,
        Haste: 18500 + index * 70,
        Crit: 10000 + index * 20,
        Mastery: 11000 + index * 60,
        Versatility: 2800 + index * 20,
      },
      gear: target.character!.gear.map((item) => ({
        ...item,
        itemLevel: item.itemLevel + 3 + (index % 4),
      })),
    };
    reference.character = character;
    return {
      ...target,
      character,
      dps: reference.dps,
      durationSeconds: reference.duration / 1000,
      castsPerMinute: target.castsPerMinute * (1.15 + index * 0.004),
      deaths: 0,
      casts: target.casts!.map((spell) => ({
        ...spell,
        perMinute: spell.perMinute * (1.15 + index * 0.004),
      })),
      abilities: target.abilities.map((spell) => ({
        ...spell,
        total: spell.total * (1.1 + index * 0.01),
      })),
      buffs: target.buffs.map((spell) => ({
        ...spell,
        uptime: (spell.uptime ?? 0) * 1.3,
      })),
    };
  });
  demoAnalysis.spells = compareSpells(target, referenceMetrics);
  demoAnalysis.references.forEach((reference, index) => {
    reference.metrics = referenceMetrics[index];
    reference.rankingDps = reference.dps;
  });
  demoAnalysis.references.sort((a, b) => b.dps - a.dps);
  demoAnalysis.buffComparisons = compareBuffs(target, referenceMetrics);
  demoAnalysis.gear = compareGear(target, referenceMetrics);
  demoAnalysis.metrics = buildDistributions(target, referenceMetrics);
  demoAnalysis.findings = buildFindings(demoAnalysis.metrics);
  const casts = target.casts
    .flatMap((spell, spellIndex) =>
      defenseTimes[spell.id]
        ? defenseTimes[spell.id].map((time) => ({
            id: spell.id,
            name: spell.name,
            icon: spell.icon,
            time,
          }))
        : Array.from({ length: spell.uses }, (_, index) => ({
            id: spell.id,
            name: spell.name,
            icon: spell.icon,
            time: ((index + 0.2 + spellIndex * 0.1) / spell.uses) * 1700,
          })),
    )
    .sort((a, b) => a.time - b.time);
  const pulls = Array.from({ length: 12 }, (_, index) => {
    const start = index * 140 + 8,
      end = Math.min(1721, index * 140 + 132);
    return {
      id: index + 1,
      name:
        index % 4 === 3 ? 'Illustrative boss pull' : 'Illustrative trash pull',
      start,
      end,
      x: -210000 + (index % 4) * 3500,
      y:
        index < 4
          ? 170000 + index * 1800
          : index < 8
            ? 125000 + (index % 4) * 1500
            : 130000 + (index % 4) * 3500,
      mapId: index < 4 ? 2588 : index < 8 ? 2589 : 2590,
      boss: index % 4 === 3,
      casts: casts.filter((cast) => cast.time >= start && cast.time < end)
        .length,
      deaths: index === 5 ? 1 : 0,
    };
  });
  const combustionAuras = casts
    .filter((cast) => cast.id === 190319)
    .flatMap((cast, index) => [
      {
        time: cast.time,
        id: 190319,
        type: 'applybuff' as const,
        stacks: null,
      },
      {
        time: Math.min(cast.time + (index === 0 ? 2.2 : 12), 1721),
        id: 190319,
        type: 'removebuff' as const,
        stacks: null,
      },
    ]);
  const hotStreakAuras = casts
    .filter((cast) => cast.id === 11366)
    .slice(0, 18)
    .flatMap((cast) => [
      {
        time: Math.max(0, cast.time - 0.45),
        id: 48108,
        type: 'applybuff' as const,
        stacks: null,
      },
      {
        time: cast.time + 0.05,
        id: 48108,
        type: 'removebuff' as const,
        stacks: null,
      },
    ]);
  demoAnalysis.evidence = {
    reportStart: 0,
    duration: 1721,
    casts,
    castsComplete: true,
    pulls,
    deaths: [
      {
        time: 810,
        name: 'Illustrative ground effect',
        icon: 'spell_fire_selfdestruct.jpg',
        damage: 8000000,
        healing: 1000000,
        window: 4,
        hits: [
          { time: 809, name: 'Illustrative ground effect', amount: 4000000 },
        ],
      },
    ],
    gaps: findCastGaps(casts, pulls),
    fire: {
      auras: [...combustionAuras, ...hotStreakAuras].sort(
        (a, b) => a.time - b.time,
      ),
      complete: true,
      pages: 1,
      warnings: [],
    },
    damage: Array.from({ length: 173 }, (_, index) => ({
      time: index * 10,
      value:
        700000 +
        Math.max(0, Math.sin(index * 0.48)) * 2100000 +
        Math.abs(Math.cos(index * 0.17)) * 500000,
    })),
    incomingSampleSeconds: 5,
    incoming: Array.from({ length: 345 }, (_, index) => ({
      time: index * 5,
      value:
        80000 +
        Math.max(0, Math.sin(index * 0.35)) * 130000 +
        ([160, 161, 245, 280].includes(index) ? 1200000 : 0),
    })),
    warnings: [],
  };
}
enrichPreview();
