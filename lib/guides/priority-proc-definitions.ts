import { createProcGuide } from './proc-pack';
import { addOutlawPriority } from './outlaw-priority';
import { addAssassinationWindows } from './assassination-windows';
import { methodSource } from './method';

const season = { rankingZoneId: 55, partitionId: 1 };
const source = (slug: string, author: string, updated = '2026-08-10') => ({
  url: `https://www.icy-veins.com/wow/${slug}-pve-dps-rotation-cooldowns-abilities`,
  author: author + ' / Icy Veins',
  patch: '12.1',
  updated,
  reviewed: '2026-09-05',
});

export const unholyGuide = createProcGuide({
  ...season,
  className: 'DeathKnight',
  specName: 'Unholy',
  key: 'unholy',
  slug: 'unholy-death-knight',
  source: methodSource('unholy-death-knight', 'Taeznak', '2026-09-06'),
  limitation:
    'Runic Power, Runes, disease coverage, pet state, target count and cooldown readiness are not reconstructed. This is a proc follow-up check, not a full Unholy rotation score.',
  notes: [
    'Sudden Doom is detected from active aura 81340, not passive talent 49530.',
    'Forbidden Knowledge replacement casts count: Necrotic Coil and Graveyard. Their triggered damage variants do not.',
    'No old Festering Wound rule is applied to this season. Target count and build determine which spender is appropriate.',
  ],
  rules: [
    {
      id: 'sudden-doom',
      name: 'Sudden Doom',
      aura: 81340,
      consumers: [47541, 207317, 1242174, 383269],
      consumerLabel:
        'Death Coil, Epidemic or their Forbidden Knowledge replacements',
      why: 'Sudden Doom boosts an eligible spender and reduces its Runic Power cost. A window with no spender is a specific place to review your priorities.',
      tryNext:
        'Keep Sudden Doom visible alongside Runic Power. Fit the appropriate spender into your priority while a target is available; include Necrotic Coil or Graveyard during Forbidden Knowledge.',
      verify:
        'Check Runic Power and target access first. This proc reduces the cost; it does not establish that you could afford a cast. No single-target versus AoE verdict is made.',
    },
  ],
});

const assassinationBase = createProcGuide({
  ...season,
  className: 'Rogue',
  specName: 'Assassination',
  key: 'assassination',
  extraAuras: [32645],
  slug: 'assassination-rogue',
  source: source('assassination-rogue', 'Seliathan'),
  limitation:
    'Combo Points, effective finisher points, Energy, bleed maintenance and full talent state are not reconstructed. Kingsbane review uses recorded target windows and Envenom self buffs. Darkest Night is checked only when recorded; Fatebound is not judged by a Deathstalker rule.',
  notes: [
    'Darkest Night uses active aura 457280, not the short hidden helper 469637.',
    'An Envenom in the window is only a recorded follow-up, not proof of correct Combo Points or proc consumption.',
    'Supercharger can change effective finisher points. Bleed snapshotting and target maintenance need additional evidence and are not scored here.',
  ],
  rules: [
    {
      id: 'darkest-night',
      name: 'Darkest Night',
      aura: 457280,
      consumers: [32645],
      consumerLabel: 'Envenom',
      why: "Darkest Night makes an appropriately built Envenom valuable and helps maintain Deathstalker's Mark. A complete window without Envenom deserves a closer look.",
      tryNext:
        'When Darkest Night appears, plan an Envenom at the appropriate effective Combo Points for your build before the opportunity ends.',
      verify:
        'Check effective Combo Points, Energy and target changes. Do not rush a low-point Envenom just to make this check look better; point quality and Mark transfer are not measured.',
    },
  ],
});

export const assassinationGuide = {
  ...assassinationBase,
  pack: {
    ...assassinationBase.pack,
    review: (result: Parameters<typeof addAssassinationWindows>[0]) =>
      addAssassinationWindows(result, assassinationBase.pack.review(result)),
  },
};

const outlawBase = createProcGuide({
  ...season,
  className: 'Rogue',
  specName: 'Outlaw',
  key: 'outlaw',
  slug: 'outlaw-rogue',
  source: source('outlaw-rogue', 'Seliathan'),
  limitation:
    'Energy, Combo Points, full talents, Roll the Bones stages and dynamic cooldown resets are not reconstructed. Opportunity windows are not a charge-waste count or a complete Outlaw rotation score.',
  notes: [
    'Only observed Opportunity aura 195627 and manual Pistol Shot 185763 are paired.',
    'Fan the Hammer changes stacks consumed and Combo Points generated. Six-stack builder review compares only Sinister Strike with Pistol Shot; it does not grade finisher priority or effective points.',
    'The coach does not apply the old six-buff Roll the Bones model or fixed Between the Eyes cooldown expectations.',
  ],
  rules: [
    {
      id: 'opportunity',
      name: 'Opportunity',
      aura: 195627,
      consumers: [185763],
      consumerLabel: 'Pistol Shot',
      why: 'Opportunity improves Pistol Shot. A full window with no Pistol Shot can point to a missed builder opportunity, but spending it immediately is not always correct.',
      tryNext:
        "Track Opportunity stacks next to Combo Points. Plan a Pistol Shot when your build's priority calls for it, leaving room for the points it generates.",
      verify:
        'Check Combo Points, Energy, Fan the Hammer and higher-priority finishers. One cast may consume several stacks; faster response is not automatically better.',
    },
  ],
});

export const outlawGuide = {
  ...outlawBase,
  pack: {
    ...outlawBase.pack,
    review: (result: Parameters<typeof addOutlawPriority>[0]) =>
      addOutlawPriority(result, outlawBase.pack.review(result)),
  },
};

export const armsGuide = createProcGuide({
  ...season,
  className: 'Warrior',
  specName: 'Arms',
  key: 'arms',
  slug: 'arms-warrior',
  source: methodSource('arms-warrior', 'Danwarr', '2026-08-25'),
  limitation:
    'Rage, target health, melee access, full talents and cooldown readiness are not reconstructed. These checks use actual proc buffs and do not impose one priority on Slayer and Colossus.',
  notes: [
    'Sudden Death uses observed Arms aura 52437, not Fury aura 280776. Both base Execute 163201 and its Massacre variant 281000 count; damage effects do not.',
    'Martial Prowess uses aura 316440 and manual Mortal Strike 12294. Missing aura evidence does not imply the talent was selected.',
    'One Mortal Strike inside a window does not establish correct stack spending. Execute phases and hero talents can change your priority.',
    'Observed Opportunist aura 456120 is reviewed separately from Martial Prowess. Manual Overpower 7384 counts, not its Dreadnaught damage effect.',
  ],
  rules: [
    {
      id: 'sudden-death',
      name: 'Sudden Death',
      aura: 52437,
      consumers: [163201, 281000],
      consumerLabel: 'Execute',
      why: 'Sudden Death creates an Execute opportunity outside the normal health restriction. An entire window without Execute is worth reviewing.',
      tryNext:
        'Make Sudden Death easy to see and consider Execute in your current priority while you can reach a target.',
      verify:
        'Check Rage, melee access, hero talents and competing priorities. No unused-charge count or damage-loss estimate is inferred.',
    },
    {
      id: 'martial-prowess',
      name: 'Martial Prowess',
      aura: 316440,
      consumers: [12294],
      consumerLabel: 'Mortal Strike',
      why: 'Martial Prowess strengthens Mortal Strike. Its complete buff window gives a concrete place to check whether you followed builders with the empowered attack.',
      tryNext:
        'Watch Martial Prowess alongside Mortal Strike and Rage, and plan the empowered hit according to your current phase and build.',
      verify:
        'Check Mortal Strike availability, Rage and Execute-phase priorities. This does not prove the number of stacks spent or that Mortal Strike should always come next.',
    },
    {
      id: 'opportunist',
      name: 'Opportunist',
      aura: 456120,
      consumers: [7384],
      consumerLabel: 'Overpower',
      why: 'Opportunist strengthens Overpower after a Tactician reset. A complete buff window without Overpower gives you a specific place to review your priorities.',
      tryNext:
        'Track Opportunist alongside Overpower and inspect competing priorities. This is a descriptive proc-window check, not a Method two-stack priority rule.',
      verify:
        'Check your recorded stacks, hero build, competing procs and melee access. This is not an instruction to wait for two stacks every time, a cooldown-readiness test, or a count of stacks wasted.',
    },
  ],
});

export const PRIORITY_PROC_GUIDES = [
  unholyGuide,
  assassinationGuide,
  outlawGuide,
  armsGuide,
];
