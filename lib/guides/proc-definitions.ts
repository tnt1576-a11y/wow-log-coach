import { createProcGuide } from './proc-pack';
import { PRIORITY_PROC_GUIDES } from './priority-proc-definitions';
import { methodSource } from './method';

export const frostDeathKnightGuide = createProcGuide({
  className: 'DeathKnight',
  specName: 'Frost',
  key: 'frost-death-knight',
  slug: 'frost-death-knight',
  rankingZoneId: 55,
  partitionId: 1,
  source: methodSource('frost-death-knight', 'Taeznak', '2026-08-11'),
  limitation:
    'Runes, Runic Power, enemy count, Razorice, cooldown readiness, melee access, full talents and hero tree are not reconstructed. Killing Streak changes charge consumption. The coach checks whether a complete proc window contains a relevant cast; it does not count individual charges wasted or prescribe Obliterate versus Frostscythe.',
  notes: [
    'Killing Machine uses logged proc aura 51124, not passive talent 51128. Rime uses aura 59052, not passive 59057.',
    'Only manual Obliterate, Frostscythe and Howling Blast cast IDs count. Triggered damage and Howling Blast 237680 are excluded.',
    'Both hero trees can use the core procs. Target count and talent choices determine the exact priority and remain review context.',
  ],
  rules: [
    {
      id: 'killing-machine',
      name: 'Killing Machine',
      aura: 51124,
      consumers: [49020, 207230],
      consumerLabel: 'Obliterate or Frostscythe',
      why: 'Killing Machine changes the value of the next eligible melee spender. A complete window with no matching cast is worth inspecting.',
      tryNext:
        'Keep Killing Machine visible and plan an eligible melee spender while the target is reachable.',
      verify:
        'Check Runes, melee access, target count and Killing Streak. One cast can consume multiple charges; this is not a wasted-charge count.',
    },
    {
      id: 'rime',
      name: 'Rime',
      aura: 59052,
      consumers: [49184],
      consumerLabel: 'Howling Blast',
      why: 'Rime enables a free empowered Howling Blast. Its observed window gives a specific place to review follow-through.',
      tryNext:
        'Track Rime and fit Howling Blast into the next useful gap in your priority before the window ends.',
      verify:
        'Check higher-priority actions, target access and encounter downtime. A missing cast does not establish that the proc could safely be used.',
    },
  ],
});

export const elementalGuide = createProcGuide({
  className: 'Shaman',
  specName: 'Elemental',
  key: 'elemental',
  slug: 'elemental-shaman',
  rankingZoneId: 55,
  partitionId: 1,
  source: methodSource('elemental-shaman', 'Celz', '2026-09-01'),
  limitation:
    'Maelstrom, Flame Shock target coverage, enemy count, talent/hero loadout, cooldown readiness and target access are not reconstructed. Tempest and talents can alter priority and charge state. Follow-through is measured per observed window, not as a fixed two-charge rule or a damage-loss estimate.',
  notes: [
    'Stormkeeper and Lava Surge checks activate from observed self buffs; absent talents or proc events do not create a missed-use claim.',
    'Only manual Lightning Bolt, Chain Lightning and Lava Burst casts count. Overload, pet, and triggered damage events do not.',
    'Shorter response time is descriptive, not automatically better. Maelstrom, Ascendance, Tempest and target changes can justify waiting.',
  ],
  rules: [
    {
      id: 'stormkeeper',
      name: 'Stormkeeper',
      aura: 191634,
      consumers: [188196, 188443],
      consumerLabel: 'Lightning Bolt or Chain Lightning',
      why: 'Stormkeeper empowers the next eligible lightning casts. A complete window without either cast is a useful review location.',
      tryNext:
        'Plan a reachable target and your next lightning casts when activating Stormkeeper, while leaving room to spend Maelstrom.',
      verify:
        'Check Maelstrom, Tempest, Ascendance timing and target availability. The check does not infer charge cap, charges consumed, or missed cooldown uses.',
    },
    {
      id: 'lava-surge',
      descriptiveOnly: true,
      name: 'Lava Surge',
      aura: 77762,
      consumers: [51505],
      consumerLabel: 'Lava Burst',
      why: 'Lava Surge makes a Lava Burst instant. A complete proc window without that cast can reveal an opportunity to review movement and spell priority.',
      tryNext:
        'Make Lava Surge visible and consider the instant Lava Burst when movement or the current priority makes it useful.',
      verify:
        'Descriptive only: Method AoE priorities may omit Lava Burst without Purging Flames. Enemy count and build context are required; an unused Lava Surge is not automatically a mistake.',
    },
  ],
});

export const PROC_GUIDES = [
  frostDeathKnightGuide,
  elementalGuide,
  ...PRIORITY_PROC_GUIDES,
];
