import type { AnalysisResult, CastEvent } from './domain';

export type DefensiveKind = 'personal' | 'group' | 'recovery' | 'external';
export interface DefensiveSpell {
  id: number;
  name: string;
  icon: string;
  className: string;
  kind: DefensiveKind;
}
// Observed spell IDs only, not a claim that a talent is available to this player.
// Verified names/icons 2026-09-03. See docs/DEFENSIVES.md. No fixed cooldowns or durations.
export const DEFENSIVE_SPELLS: DefensiveSpell[] = [
  {
    id: 48707,
    name: 'Anti-Magic Shell',
    icon: 'spell_shadow_antimagicshell',
    className: 'DeathKnight',
    kind: 'personal',
  },
  {
    id: 48792,
    name: 'Icebound Fortitude',
    icon: 'spell_deathknight_iceboundfortitude',
    className: 'DeathKnight',
    kind: 'personal',
  },
  {
    id: 49039,
    name: 'Lichborne',
    icon: 'spell_shadow_raisedead',
    className: 'DeathKnight',
    kind: 'personal',
  },
  {
    id: 51052,
    name: 'Anti-Magic Zone',
    icon: 'spell_deathknight_antimagiczone',
    className: 'DeathKnight',
    kind: 'group',
  },
  {
    id: 198589,
    name: 'Blur',
    icon: 'ability_demonhunter_blur',
    className: 'DemonHunter',
    kind: 'personal',
  },
  {
    id: 196555,
    name: 'Netherwalk',
    icon: 'spell_warlock_demonsoul',
    className: 'DemonHunter',
    kind: 'personal',
  },
  {
    id: 196718,
    name: 'Darkness',
    icon: 'ability_demonhunter_darkness',
    className: 'DemonHunter',
    kind: 'group',
  },
  {
    id: 22812,
    name: 'Barkskin',
    icon: 'spell_nature_stoneclawtotem',
    className: 'Druid',
    kind: 'personal',
  },
  {
    id: 61336,
    name: 'Survival Instincts',
    icon: 'ability_druid_tigersroar',
    className: 'Druid',
    kind: 'personal',
  },
  {
    id: 22842,
    name: 'Frenzied Regeneration',
    icon: 'ability_bullrush',
    className: 'Druid',
    kind: 'recovery',
  },
  {
    id: 108238,
    name: 'Renewal',
    icon: 'spell_nature_natureblessing',
    className: 'Druid',
    kind: 'recovery',
  },
  {
    id: 363916,
    name: 'Obsidian Scales',
    icon: 'inv_artifact_dragonscales',
    className: 'Evoker',
    kind: 'personal',
  },
  {
    id: 374348,
    name: 'Renewing Blaze',
    icon: 'ability_evoker_masterylifebinder_red',
    className: 'Evoker',
    kind: 'recovery',
  },
  {
    id: 186265,
    name: 'Aspect of the Turtle',
    icon: 'ability_hunter_pet_turtle',
    className: 'Hunter',
    kind: 'personal',
  },
  {
    id: 264735,
    name: 'Survival of the Fittest',
    icon: 'spell_nature_spiritarmor',
    className: 'Hunter',
    kind: 'personal',
  },
  {
    id: 109304,
    name: 'Exhilaration',
    icon: 'ability_hunter_onewithnature',
    className: 'Hunter',
    kind: 'recovery',
  },
  {
    id: 45438,
    name: 'Ice Block',
    icon: 'spell_frost_frost',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 342245,
    name: 'Alter Time',
    icon: 'spell_mage_altertime',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 11426,
    name: 'Ice Barrier',
    icon: 'spell_ice_lament',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 235450,
    name: 'Prismatic Barrier',
    icon: 'spell_magearmor',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 235313,
    name: 'Blazing Barrier',
    icon: 'ability_mage_moltenarmor',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 55342,
    name: 'Mirror Image',
    icon: 'spell_magic_lesserinvisibilty',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 414658,
    name: 'Ice Cold',
    icon: 'spell_fire_bluefire',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 115203,
    name: 'Fortifying Brew',
    icon: 'ability_monk_fortifyingale_new',
    className: 'Monk',
    kind: 'personal',
  },
  {
    id: 122783,
    name: 'Diffuse Magic',
    icon: 'spell_monk_diffusemagic',
    className: 'Monk',
    kind: 'personal',
  },
  {
    id: 122278,
    name: 'Dampen Harm',
    icon: 'ability_monk_dampenharm',
    className: 'Monk',
    kind: 'personal',
  },
  {
    id: 122470,
    name: 'Touch of Karma',
    icon: 'ability_monk_touchofkarma',
    className: 'Monk',
    kind: 'personal',
  },
  {
    id: 498,
    name: 'Divine Protection',
    icon: 'spell_holy_divineprotection',
    className: 'Paladin',
    kind: 'personal',
  },
  {
    id: 642,
    name: 'Divine Shield',
    icon: 'spell_holy_divineshield',
    className: 'Paladin',
    kind: 'personal',
  },
  {
    id: 184662,
    name: 'Shield of Vengeance',
    icon: 'ability_paladin_shieldofthetemplar',
    className: 'Paladin',
    kind: 'personal',
  },
  {
    id: 47585,
    name: 'Dispersion',
    icon: 'spell_shadow_dispersion',
    className: 'Priest',
    kind: 'personal',
  },
  {
    id: 19236,
    name: 'Desperate Prayer',
    icon: 'spell_holy_testoffaith',
    className: 'Priest',
    kind: 'recovery',
  },
  {
    id: 1966,
    name: 'Feint',
    icon: 'ability_rogue_feint',
    className: 'Rogue',
    kind: 'personal',
  },
  {
    id: 31224,
    name: 'Cloak of Shadows',
    icon: 'spell_shadow_nethercloak',
    className: 'Rogue',
    kind: 'personal',
  },
  {
    id: 5277,
    name: 'Evasion',
    icon: 'spell_shadow_shadowward',
    className: 'Rogue',
    kind: 'personal',
  },
  {
    id: 185311,
    name: 'Crimson Vial',
    icon: 'ability_rogue_crimsonvial',
    className: 'Rogue',
    kind: 'recovery',
  },
  {
    id: 108271,
    name: 'Astral Shift',
    icon: 'ability_shaman_astralshift',
    className: 'Shaman',
    kind: 'personal',
  },
  {
    id: 108270,
    name: 'Stone Bulwark Totem',
    icon: 'ability_shaman_stonebulwark',
    className: 'Shaman',
    kind: 'personal',
  },
  {
    id: 104773,
    name: 'Unending Resolve',
    icon: 'spell_shadow_demonictactics',
    className: 'Warlock',
    kind: 'personal',
  },
  {
    id: 108416,
    name: 'Dark Pact',
    icon: 'spell_shadow_deathpact',
    className: 'Warlock',
    kind: 'personal',
  },
  {
    id: 118038,
    name: 'Die by the Sword',
    icon: 'ability_warrior_challange',
    className: 'Warrior',
    kind: 'personal',
  },
  {
    id: 184364,
    name: 'Enraged Regeneration',
    icon: 'ability_warrior_focusedrage',
    className: 'Warrior',
    kind: 'recovery',
  },
  {
    id: 23920,
    name: 'Spell Reflection',
    icon: 'ability_warrior_shieldreflection',
    className: 'Warrior',
    kind: 'personal',
  },
  {
    id: 6262,
    name: 'Healthstone',
    icon: 'warlock_-healthstone',
    className: 'All',
    kind: 'recovery',
  },
  {
    id: 110959,
    name: 'Greater Invisibility',
    icon: 'ability_mage_greaterinvisibility',
    className: 'Mage',
    kind: 'personal',
  },
  {
    id: 414660,
    name: 'Mass Barrier',
    icon: 'ability_racial_magicalresistance',
    className: 'Mage',
    kind: 'group',
  },
  {
    id: 49998,
    name: 'Death Strike',
    icon: 'spell_deathknight_butcher2',
    className: 'DeathKnight',
    kind: 'recovery',
  },
  {
    id: 202168,
    name: 'Impending Victory',
    icon: 'spell_impending_victory',
    className: 'Warrior',
    kind: 'recovery',
  },
  {
    id: 34428,
    name: 'Victory Rush',
    icon: 'ability_warrior_devastate',
    className: 'Warrior',
    kind: 'recovery',
  },
  {
    id: 243435,
    name: 'Fortifying Brew',
    icon: 'ability_monk_fortifyingale_new',
    className: 'Monk',
    kind: 'personal',
  },
];
// External names/icons verified against Wowhead's spell endpoint on 2026-09-21.
// These IDs classify recorded events; they do not establish availability or effectiveness.
export const EXTERNAL_DEFENSIVES: DefensiveSpell[] = [
  {
    id: 33206,
    name: 'Pain Suppression',
    icon: 'spell_holy_painsupression',
    className: 'Priest',
    kind: 'external',
  },
  {
    id: 47788,
    name: 'Guardian Spirit',
    icon: 'spell_holy_guardianspirit',
    className: 'Priest',
    kind: 'external',
  },
  {
    id: 102342,
    name: 'Ironbark',
    icon: 'spell_druid_ironbark',
    className: 'Druid',
    kind: 'external',
  },
  {
    id: 6940,
    name: 'Blessing of Sacrifice',
    icon: 'spell_holy_sealofsacrifice',
    className: 'Paladin',
    kind: 'external',
  },
  {
    id: 1022,
    name: 'Blessing of Protection',
    icon: 'spell_holy_sealofprotection',
    className: 'Paladin',
    kind: 'external',
  },
  {
    id: 204018,
    name: 'Blessing of Spellwarding',
    icon: 'spell_holy_blessingofprotection',
    className: 'Paladin',
    kind: 'external',
  },
  {
    id: 116849,
    name: 'Life Cocoon',
    icon: 'ability_monk_chicocoon',
    className: 'Monk',
    kind: 'external',
  },
  {
    id: 357170,
    name: 'Time Dilation',
    icon: 'ability_evoker_timedilation',
    className: 'Evoker',
    kind: 'external',
  },
  {
    id: 374227,
    name: 'Zephyr',
    icon: 'ability_evoker_hoverblack',
    className: 'Evoker',
    kind: 'group',
  },
  {
    id: 97462,
    name: 'Rallying Cry',
    icon: 'ability_warrior_rallyingcry',
    className: 'Warrior',
    kind: 'group',
  },
  {
    id: 62618,
    name: 'Power Word: Barrier',
    icon: 'spell_holy_powerwordbarrier',
    className: 'Priest',
    kind: 'group',
  },
];
DEFENSIVE_SPELLS.push(...EXTERNAL_DEFENSIVES);
// Aura IDs distinct from the successful cast ID. Never counted as extra casts.
const DEFENSIVE_AURA_ALIASES: DefensiveSpell[] = [
  {
    id: 81782,
    name: 'Power Word: Barrier',
    icon: 'spell_holy_powerwordbarrier',
    className: 'Priest',
    kind: 'group',
  },
  {
    id: 145629,
    name: 'Anti-Magic Zone',
    icon: 'spell_deathknight_antimagiczone',
    className: 'DeathKnight',
    kind: 'group',
  },
];
export const DEFENSIVE_AURA_IDS = [
  ...DEFENSIVE_SPELLS,
  ...DEFENSIVE_AURA_ALIASES,
]
  .filter((spell) => spell.kind !== 'recovery')
  .map((spell) => spell.id);
export const defensiveAuraSpell = (id: number) =>
  defensiveSpell(id) ?? DEFENSIVE_AURA_ALIASES.find((spell) => spell.id === id);
export const defensiveSpell = (id: number) =>
  DEFENSIVE_SPELLS.find((spell) => spell.id === id);

export interface DangerMoment {
  id: string;
  kind: 'death' | 'damage' | 'hit';
  time: number;
  duration: number;
  value: number;
  label: string;
  pullId?: number;
}
export function defensiveCasts(result: AnalysisResult) {
  return (result.evidence?.casts ?? []).flatMap((cast) => {
    const definition = defensiveSpell(cast.id);
    return definition ? [{ ...cast, definition }] : [];
  });
}
export function dangerMoments(result: AnalysisResult): DangerMoment[] {
  const evidence = result.evidence;
  if (!evidence) return [];
  const findPull = (time: number) =>
    evidence.pulls.find((pull) => time >= pull.start && time < pull.end)?.id;
  const moments: DangerMoment[] = evidence.deaths.map((death, index) => ({
    id: 'death-' + index,
    kind: 'death',
    time: death.time,
    duration: 0,
    value: death.damage,
    label: death.name,
    pullId: findPull(death.time),
  }));
  const interval = evidence.incomingSampleSeconds ?? 0;
  if (interval > 0) {
    const peaks = [...(evidence.incoming ?? [])]
      .filter((point) => point.value > 0 && point.time < evidence.duration)
      .sort((a, b) => b.value - a.value);
    let count = 0;
    for (const peak of peaks) {
      if (
        moments.some(
          (moment) =>
            Math.abs(moment.time - peak.time) < Math.max(15, interval * 2),
        )
      )
        continue;
      moments.push({
        id: 'damage-' + peak.time,
        kind: 'damage',
        time: peak.time,
        duration: Math.min(interval, evidence.duration - peak.time),
        value: peak.value,
        label: 'High damage intake',
        pullId: findPull(peak.time),
      });
      if (++count >= 3) break;
    }
  }
  if (!(evidence.incoming ?? []).some((point) => point.value > 0)) {
    let count = 0;
    for (const hit of [...(evidence.incomingHits ?? [])].sort(
      (a, b) => b.amount - a.amount,
    )) {
      if (
        hit.amount <= 0 ||
        moments.some((moment) => Math.abs(moment.time - hit.time) < 15)
      )
        continue;
      moments.push({
        id: 'hit-' + hit.time + '-' + hit.id,
        kind: 'hit',
        time: hit.time,
        duration: 0,
        value: hit.amount,
        label: hit.name,
        pullId: findPull(hit.time),
      });
      if (++count >= 3) break;
    }
  }
  return moments;
}
export function castsAroundMoment(
  result: AnalysisResult,
  moment: DangerMoment,
  lookback = 10,
) {
  const pull = result.evidence?.pulls.find((item) => item.id === moment.pullId);
  return defensiveCasts(result)
    .filter(
      (cast) =>
        cast.time >= Math.max(pull?.start ?? 0, moment.time - lookback) &&
        cast.time < (pull?.end ?? Infinity) &&
        cast.time <=
          Math.min(pull?.end ?? Infinity, moment.time + moment.duration + 5),
    )
    .map((cast) => ({
      ...cast,
      offset: cast.time - moment.time,
      phase:
        cast.time < moment.time
          ? 'before'
          : moment.duration > 0 && cast.time <= moment.time + moment.duration
            ? 'during'
            : cast.time === moment.time
              ? 'at'
              : 'after',
    }));
}
export function defensiveUsage(result: AnalysisResult) {
  const classKey = result.target.className.replace(/\s/g, '').toLowerCase();
  return DEFENSIVE_SPELLS.filter(
    (spell) =>
      spell.className === 'All' || spell.className.toLowerCase() === classKey,
  )
    .map((spell) => ({
      ...spell,
      casts: defensiveCasts(result).filter((cast) => cast.id === spell.id),
      comparison: result.spells?.find((entry) => entry.id === spell.id),
      target: result.targetMetrics.casts?.find(
        (entry) => entry.id === spell.id,
      ),
    }))
    .filter(
      (spell) =>
        spell.casts.length ||
        (spell.target?.uses ?? 0) > 0 ||
        (spell.comparison?.referenceUsers ?? 0) > 0,
    );
}
export type ReviewFocus = {
  pullId?: number;
  time?: number;
  spellId?: number;
  defensiveOnly?: boolean;
};
export function pullForCast(result: AnalysisResult, cast: CastEvent) {
  return result.evidence?.pulls.find(
    (pull) => cast.time >= pull.start && cast.time < pull.end,
  );
}

export type IncomingDamageHit = {
  time: number;
  id?: number;
  name: string;
  icon?: string;
  amount: number;
  sourceId?: number;
  sourceName?: string;
};
export interface IncomingDamageSource {
  id?: number;
  name: string;
  icon?: string;
  sourceId?: number;
  sourceName?: string;
  amount: number;
  hits: number;
  largestHit: number;
  first: number;
  last: number;
}
export function groupIncomingDamage(
  hits: IncomingDamageHit[],
): IncomingDamageSource[] {
  const grouped = new Map<string, IncomingDamageSource>();
  for (const hit of hits) {
    const key = [
      hit.id ?? hit.name,
      hit.sourceId ?? hit.sourceName ?? 'unknown',
    ].join(':');
    const previous = grouped.get(key);
    if (previous) {
      previous.amount += hit.amount;
      previous.hits++;
      previous.largestHit = Math.max(previous.largestHit, hit.amount);
      previous.first = Math.min(previous.first, hit.time);
      previous.last = Math.max(previous.last, hit.time);
    } else
      grouped.set(key, {
        ...hit,
        hits: 1,
        largestHit: hit.amount,
        first: hit.time,
        last: hit.time,
      });
  }
  return [...grouped.values()].sort((a, b) => b.amount - a.amount);
}

/** Deaths use only the lead-up. Graph peaks use the sampled bin, never damage after death. */
export function incomingAroundMoment(
  result: AnalysisResult,
  moment: DangerMoment,
  lookback = 10,
) {
  const evidence = result.evidence;
  const pull = evidence?.pulls.find((item) => item.id === moment.pullId);
  const start = Math.max(
    pull?.start ?? 0,
    moment.kind === 'damage' ? moment.time : moment.time - lookback,
  );
  const end = Math.min(
    pull?.end ?? Infinity,
    moment.time + moment.duration,
    evidence?.duration ?? Infinity,
  );
  const fetched = (evidence?.incomingHits ?? []).filter(
    (hit) =>
      hit.time >= start &&
      hit.time < (pull?.end ?? Infinity) &&
      (moment.duration > 0 ? hit.time < end : hit.time <= end),
  );
  const death =
    moment.kind === 'death'
      ? evidence?.deaths.find((item) => item.time === moment.time)
      : undefined;
  const fallback =
    !fetched.length && death?.hits.length
      ? death.hits.filter((hit) => hit.time >= start && hit.time <= end)
      : [];
  const hits: IncomingDamageHit[] = fetched.length ? fetched : fallback;
  return {
    start,
    end,
    hits,
    sources: groupIncomingDamage(hits),
    complete: evidence?.incomingHitsComplete === true,
    deathFallback: !fetched.length && fallback.length > 0,
    total: hits.reduce((sum, hit) => sum + hit.amount, 0),
  };
}

export interface DefensiveAuraWindow {
  id: number;
  name: string;
  icon?: string;
  start: number;
  end: number | null;
  sourceId?: number;
  sourceName?: string;
  targetId?: number;
  targetName?: string;
  external: boolean | null;
  refreshed: boolean;
}
/** Pair observed edges only. An unclosed aura does not receive a guessed duration. */
export function defensiveAuraWindows(
  result: AnalysisResult,
): DefensiveAuraWindow[] {
  const events = [...(result.evidence?.defensiveAuras?.events ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const active = new Map<string, DefensiveAuraWindow>();
  const windows: DefensiveAuraWindow[] = [];
  for (const event of events) {
    if (event.targetId !== result.target.sourceId) continue;
    if (!defensiveAuraSpell(event.id)) continue;
    // Normalize again for saved evidence produced before actor sentinel filtering.
    const sourceId =
      typeof event.sourceId === 'number' &&
      Number.isSafeInteger(event.sourceId) &&
      event.sourceId > 0
        ? event.sourceId
        : undefined;
    const key = [event.id, sourceId ?? 'unknown', event.targetId].join(':');
    if (event.type === 'removebuff') {
      // Some removals lack an owner. Match only if exactly one possible application exists.
      const candidates =
        sourceId === undefined
          ? [...active.entries()].filter(
              ([, aura]) =>
                aura.id === event.id && aura.targetId === event.targetId,
            )
          : active.has(key)
            ? [[key, active.get(key)!] as const]
            : [];
      if (candidates.length === 1) {
        const [activeKey, current] = candidates[0];
        current.end = event.time;
        active.delete(activeKey);
      }
      continue;
    }
    const existing = active.get(key);
    if (existing) {
      existing.refreshed ||= event.type === 'refreshbuff';
      // A second application without a removal is not proof of continuous coverage.
      if (event.type === 'refreshbuff') continue;
      active.delete(key);
    }
    const window: DefensiveAuraWindow = {
      id: event.id,
      name: event.name,
      icon: event.icon ?? defensiveAuraSpell(event.id)?.icon,
      start: event.time,
      end: null,
      sourceId,
      sourceName: sourceId === undefined ? undefined : event.sourceName,
      targetId: event.targetId,
      targetName: event.targetName,
      external:
        sourceId === undefined ? null : sourceId !== result.target.sourceId,
      refreshed: event.type === 'refreshbuff',
    };
    active.set(key, window);
    windows.push(window);
  }
  return windows;
}

/** Strict boundaries avoid inferring event ordering at the same timestamp. */
export function auraContainsHit(aura: DefensiveAuraWindow, time: number) {
  return aura.end !== null && aura.start < time && time < aura.end;
}
export function aurasAroundMoment(
  result: AnalysisResult,
  moment: DangerMoment,
  lookback = 10,
) {
  const incoming = incomingAroundMoment(result, moment, lookback);
  return defensiveAuraWindows(result)
    .filter((aura) =>
      aura.end === null
        ? aura.start >= incoming.start && aura.start <= incoming.end
        : aura.start <= incoming.end && aura.end >= incoming.start,
    )
    .map((aura) => ({
      ...aura,
      overlappingHits: incoming.hits.filter((hit) =>
        auraContainsHit(aura, hit.time),
      ).length,
      observedAtMoment: auraContainsHit(aura, moment.time),
    }));
}

/** Same ability and enemy name, never the same dungeon clock or enemy actor ID across reports. */
export function matchingDamageMoments(
  target: AnalysisResult,
  reference: AnalysisResult,
  selected: DangerMoment,
  lookback = 10,
): DangerMoment[] {
  const sources = incomingAroundMoment(
    target,
    selected,
    lookback,
  ).sources.filter((source) => source.id);
  const matches = (reference.evidence?.incomingHits ?? []).filter((hit) =>
    sources.some(
      (source) =>
        source.id === hit.id &&
        (!source.sourceName || source.sourceName === hit.sourceName),
    ),
  );
  const chosen: typeof matches = [];
  for (const hit of [...matches].sort((a, b) => b.amount - a.amount)) {
    if (chosen.some((previous) => Math.abs(previous.time - hit.time) < 8))
      continue;
    chosen.push(hit);
    if (chosen.length >= 8) break;
  }
  return chosen
    .sort((a, b) => a.time - b.time)
    .map((hit, index) => ({
      id: 'matched-hit-' + index + '-' + hit.time,
      kind: 'hit',
      time: hit.time,
      duration: 0,
      label: hit.name + (hit.sourceName ? ' — ' + hit.sourceName : ''),
      value: hit.amount,
      pullId: reference.evidence?.pulls.find(
        (pull) => hit.time >= pull.start && hit.time < pull.end,
      )?.id,
    }));
}

export function damageAroundDefensiveUse(
  result: AnalysisResult,
  cast: CastEvent,
) {
  const pull = pullForCast(result, cast);
  return groupIncomingDamage(
    (result.evidence?.incomingHits ?? []).filter(
      (hit) =>
        hit.time >= Math.max(pull?.start ?? 0, cast.time - 3) &&
        hit.time <=
          Math.min(result.evidence?.duration ?? Infinity, cast.time + 8) &&
        hit.time < (pull?.end ?? Infinity),
    ),
  );
}
