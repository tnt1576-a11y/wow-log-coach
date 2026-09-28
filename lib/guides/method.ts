import type { AnalysisResult, RunMetrics } from '../domain';

export const methodSource = (
  slug: string,
  author: string,
  updated: string,
) => ({
  url: `https://www.method.gg/guides/${slug}/playstyle-and-rotation`,
  author: `${author} / Method`,
  patch: '12.1',
  updated,
  reviewed: '2026-09-08',
});
type Marker = { name: string; ids: number[] };
type Branch = {
  text: string;
  hero?: string;
  min?: number;
  max?: number;
  requires?: string[];
};
export type MethodGuide = {
  className: string;
  specName: string;
  slug: string;
  source: ReturnType<typeof methodSource>;
  heroes: Record<string, Marker[]>;
  talents: Marker[];
  branches: Branch[];
};
const marker = (name: string, ...ids: number[]): Marker => ({ name, ids });
const riders = [
  marker('Apocalypse Now', 444040),
  marker("Mograine's Might", 444047),
  marker('Death Charge', 444010),
  marker('Pact of the Apocalypse', 444083),
];

// IDs are talent links on the corresponding Method talent page, reviewed 2026-09-08.
// Never infer an unselected talent from an incomplete learned-talent snapshot.
export const METHOD_GUIDES: MethodGuide[] = [
  {
    className: 'Mage',
    specName: 'Arcane',
    slug: 'arcane-mage',
    source: methodSource('arcane-mage', 'Khaelt', '2026-09-05'),
    heroes: {
      Sunfury: [
        marker('Spellfire Spheres', 448601),
        marker('Sunfury Execution', 449349),
      ],
      Spellslinger: [
        marker('Splintering Sorcery', 443739),
        marker('Splintering Orbs', 444256),
      ],
    },
    talents: [
      marker('Arcane Pulse', 1241462),
      marker('Orb Mastery', 1243435),
      marker('High Voltage', 461248),
    ],
    branches: [
      {
        text: 'Opener anchors: Surge → Missiles → Touch. Barrage is not a mandatory intervening cast.',
      },
      {
        hero: 'Sunfury',
        text: 'Below 12 Salvo, prioritize Missiles. Soul favors Barrage. Outside Soul, the high-priority Bolt branch uses 8 Cumulative Power.',
      },
      {
        hero: 'Sunfury',
        text: 'Barrage at 25 Salvo, or with Clearcasting at 12+. Check charges and available alternatives before judging a cast.',
      },
      {
        hero: 'Spellslinger',
        text: 'Prioritize Bolt without Clearcasting or at 6 Cumulative Power; Barrage at 20 Salvo or following Surge; normal Missiles below 15.',
      },
      {
        hero: 'Spellslinger',
        min: 2,
        requires: ['Orb Mastery'],
        text: 'AoE raises Orb priority. The listed three-stack Missiles exception needs proc context; a high-Salvo channel alone is not an error.',
      },
      {
        hero: 'Sunfury',
        min: 2,
        requires: ['Arcane Pulse'],
        text: 'AoE adds Orb/Pulse-dependent early spending. Readiness is not reconstructed.',
      },
    ],
  },
  {
    className: 'DeathKnight',
    specName: 'Frost',
    slug: 'frost-death-knight',
    source: methodSource('frost-death-knight', 'Taeznak', '2026-08-11'),
    heroes: {
      'Rider of the Apocalypse': riders,
      Deathbringer: [
        marker("Reaper's Mark", 439843),
        marker('Exterminate', 441378),
      ],
    },
    talents: [
      marker('Breath of Sindragosa', 1249658),
      marker('Shattering Blade', 207057),
      marker('Obliteration', 207256, 281238),
      marker('Frostscythe', 207230),
      marker('Glacial Advance', 194913),
    ],
    branches: [
      {
        max: 2,
        text: 'Review Killing Machine → Obliterate and Rime → Howling Blast alongside rune availability.',
      },
      {
        min: 3,
        requires: ['Frostscythe', 'Glacial Advance'],
        text: 'At 3+ targets, compare Frostscythe and Glacial Advance usage. Frostbane can still justify Frost Strike.',
      },
      {
        requires: ['Breath of Sindragosa'],
        text: 'Breath setup: build resources, then align Pillar and Breath. Compare the same Breath build, not a Shattering Blade opener.',
      },
      {
        requires: ['Shattering Blade'],
        max: 2,
        text: 'Five Razorice stacks can raise Frost Strike priority. Target debuff state is needed to assess it.',
      },
      {
        requires: ['Obliteration'],
        text: 'Pool 3–4 runes for Pillar; inspect alternating proc generation and consumption inside it.',
      },
      {
        hero: 'Deathbringer',
        text: 'Reaper’s Mark changes setup. Recall timing depends on its explosion and Exterminate charges; cast order alone cannot grade it.',
      },
      {
        hero: 'Rider of the Apocalypse',
        min: 3,
        text: 'For the listed AoE build, retain the Frostwyrm Recall for the next Pillar.',
      },
    ],
  },
  {
    className: 'DeathKnight',
    specName: 'Unholy',
    slug: 'unholy-death-knight',
    source: methodSource('unholy-death-knight', 'Taeznak', '2026-09-06'),
    heroes: {
      'Rider of the Apocalypse': riders,
      "San'layn": [
        marker('Vampiric Strike', 433895, 433901),
        marker('Vampiric Aura', 434105),
      ],
    },
    talents: [
      marker('Blightburst', 1254552),
      marker('Soul Reaper', 343294),
      marker('Festering Scythe', 455397),
      marker('Forbidden Knowledge'),
    ],
    branches: [
      {
        text: 'Review Army and Dark Transformation alignment, disease application, and Festering Scythe debuff upkeep. Do not use old Festering Wound priorities.',
      },
      {
        max: 2,
        text: 'Sudden Doom favors Death Coil; use the appropriate transformed spender when available.',
      },
      {
        min: 2,
        text: 'Check Death and Decay coverage when enemies remain in range.',
      },
      {
        min: 3,
        text: 'Epidemic becomes the normal AoE spender at 3+ enemies.',
      },
      {
        min: 3,
        max: 3,
        requires: ['Forbidden Knowledge'],
        text: 'At three enemies, distinguish Necrotic Coil from the normal Epidemic branch.',
      },
      {
        min: 4,
        requires: ['Forbidden Knowledge'],
        text: 'At four or more enemies, the transformed spender branch uses Graveyard.',
      },
      {
        requires: ['Blightburst'],
        text: 'Putrefy can supply diseases; do not demand redundant Outbreak casts.',
      },
      {
        hero: "San'layn",
        text: 'Build Lesser Ghoul stock before Transformation and track Blood Queen stacks for Vampiric Strike decisions.',
      },
      {
        hero: 'Rider of the Apocalypse',
        requires: ['Soul Reaper'],
        max: 1,
        text: 'The listed opener places Soul Reaper about seven seconds after Transformation.',
      },
    ],
  },
  {
    className: 'Warlock',
    specName: 'Demonology',
    slug: 'demonology-warlock',
    source: methodSource('demonology-warlock', 'Sjeletyven', '2026-08-11'),
    heroes: {
      Diabolist: [marker('Diabolic Ritual', 428514)],
      'Soul Harvester': [
        marker('Demonic Soul', 449614),
        marker('Wicked Reaping', 449631),
        marker('Soul Anathema', 449624),
      ],
    },
    talents: [
      marker('Reign of Tyranny', 1276748),
      marker('Implosion', 196277),
      marker('Power Siphon', 264130),
      marker('Doom', 460551),
      marker('Inner Demons', 267216),
    ],
    branches: [
      {
        text: 'Compare Dreadstalker timing and shard/Core management. A post-Tyrant Hand count does not establish whether the demon setup was good.',
      },
      {
        hero: 'Diabolist',
        requires: ['Reign of Tyranny'],
        text: 'Plan Tyrant to extend Dreadstalkers; the setup differs from Soul Harvester.',
      },
      {
        hero: 'Soul Harvester',
        text: 'Compare Core generation and spending with another Soul Harvester. Do not impose Diabolist’s demon-extension setup.',
      },
      {
        requires: ['Power Siphon'],
        text: 'Avoid Siphon at 3+ Core, or at 2 when Dreadstalkers are expiring. Pet expiry is not reconstructed.',
      },
      {
        min: 2,
        requires: ['Implosion'],
        text: 'Review Implosion cycles with at least six imps. Cast counts alone cannot establish imp count.',
      },
      {
        min: 2,
        requires: ['Doom'],
        text: 'Inspect instant Demonbolt target choices for Doom spreading.',
      },
      {
        text: 'Plan the next Tyrant around pack lifetime; saving cooldowns for a durable pack can be appropriate.',
      },
    ],
  },
  {
    className: 'Shaman',
    specName: 'Elemental',
    slug: 'elemental-shaman',
    source: methodSource('elemental-shaman', 'Celz', '2026-09-01'),
    heroes: {
      Farseer: [marker('Ancestral Swiftness', 443454, 448861)],
      Stormbringer: [marker('Tempest', 454009)],
    },
    talents: [
      marker('Master of the Elements', 16166),
      marker('Molten Wrath', 1258843),
      marker('Voltaic Blaze', 470057),
      marker('Purging Flames', 1259471),
    ],
    branches: [
      {
        text: 'Plan Stormkeeper before Ascendance, allowing for encounter holds and total cooldown uses.',
      },
      {
        hero: 'Farseer',
        text: 'Follow Ancestral Swiftness with a spell that consumes its instant-cast effect; already-instant lightning may not start its recovery.',
      },
      {
        hero: 'Stormbringer',
        text: 'Use the Tempest/Stormkeeper interaction, not Farseer’s ancestor priority. Arc Discharge can add Stormkeeper stacks; inspect cap pressure.',
      },
      {
        requires: ['Master of the Elements'],
        max: 2,
        text: 'Alternate Lava Burst with other spells to use its empowerment, especially on strong spenders.',
      },
      {
        requires: ['Molten Wrath'],
        max: 1,
        text: 'The listed M+ single-target priority puts Elemental Blast before Lava Burst; do not impose Master of the Elements weaving.',
      },
      {
        min: 2,
        max: 2,
        text: 'Two-target cleave replaces Lightning Bolt with Chain Lightning.',
      },
      {
        min: 3,
        text: 'Review Earthquake and Chain Lightning as the AoE core. Lava Surge alone does not prove Lava Burst should be used.',
      },
      {
        min: 3,
        requires: ['Purging Flames', 'Voltaic Blaze'],
        text: 'Review the Blaze → empowered Lava Burst cleave opportunity before returning to AoE spenders.',
      },
    ],
  },
  {
    className: 'Warrior',
    specName: 'Arms',
    slug: 'arms-warrior',
    source: methodSource('arms-warrior', 'Danwarr', '2026-08-25'),
    heroes: {
      Slayer: [
        marker("Slayer's Dominance", 444767),
        marker('Executioner', 445584),
      ],
      Colossus: [marker('Demolish', 436358)],
    },
    talents: [
      marker('Rend', 772),
      marker('Cleave', 845),
      marker("Executioner's Precision", 386634),
      marker('Broad Strokes'),
      marker('Master of Warfare', 1269314, 1269306),
    ],
    branches: [
      {
        max: 1,
        text: 'Compare Rend maintenance and Avatar/Colossus Smash alignment. Two Sudden Death stacks raise Execute above the ordinary Mortal Strike priority.',
      },
      {
        requires: ['Master of Warfare'],
        text: 'Inspect Heroic Strike opportunities separately from ordinary Slam filler.',
      },
      {
        hero: 'Slayer',
        text: 'The listed opener places Bladestorm after Avatar/Smash, before Mortal Strike.',
      },
      {
        hero: 'Colossus',
        text: 'The listed opener follows Avatar/Smash with Mortal Strike, then Demolish.',
      },
      {
        requires: ["Executioner's Precision"],
        text: 'During execute, inspect Precision stacks before Mortal Strike and Rage before choosing Execute versus Overpower.',
      },
      {
        min: 2,
        requires: ['Cleave', 'Rend'],
        text: 'Cleave can apply Rend in the opener. Do not require a separate Rend cast for this build.',
      },
      {
        min: 2,
        requires: ['Broad Strokes'],
        text: 'Check Sweeping Strikes overlap: spend existing charges before another activation rather than overwriting them.',
      },
      {
        min: 2,
        text: 'The supplied rotation page does not define a complete numbered AoE priority. Use its cleave talent interactions and matched logs, not an invented universal sequence.',
      },
    ],
  },
];

export function methodGuideFor(result: AnalysisResult) {
  return METHOD_GUIDES.find(
    (g) =>
      g.className === result.target.className &&
      g.specName === result.target.specName,
  );
}
const normalized = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');
export function learnedMarker(metrics: RunMetrics, marker: Marker) {
  return (metrics.character?.talents ?? []).some(
    (t) =>
      t.rank > 0 &&
      (marker.ids.includes(t.spellId) ||
        (t.name && normalized(t.name) === normalized(marker.name))),
  );
}
export function methodBuild(guide: MethodGuide, metrics: RunMetrics) {
  const detected = Object.entries(guide.heroes)
    .filter(([, markers]) => markers.some((m) => learnedMarker(metrics, m)))
    .map(([name]) => name);
  return {
    hero: detected.length === 1 ? detected[0] : null,
    conflict: detected.length > 1,
    talents: guide.talents.map((m) => ({
      name: m.name,
      present: learnedMarker(metrics, m),
    })),
  };
}
export function methodBranches(
  guide: MethodGuide,
  metrics: RunMetrics,
  hero: string | null,
  targets: number,
) {
  const build = methodBuild(guide, metrics);
  return guide.branches
    .filter(
      (b) =>
        (!b.hero || b.hero === hero) &&
        targets >= (b.min ?? 1) &&
        targets <= (b.max ?? Infinity),
    )
    .map((b) => ({
      ...b,
      missing: (b.requires ?? []).filter(
        (name) => !build.talents.some((t) => t.name === name && t.present),
      ),
    }));
}
