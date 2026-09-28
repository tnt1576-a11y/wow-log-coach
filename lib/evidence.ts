// Warcraft Logs' JSON scalar tables are normalized at this boundary.
import { isCombatGearSlot } from './gear';
import type {
  AbilityMetric,
  CharacterSnapshot,
  GearItem,
  RunEvidence,
  CastEvent,
  DeathEvidence,
  PullEvidence,
} from './domain';

type Row = Record<string, unknown>;
export const record = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : {};
export const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.map(record) : [];
export const finite = (value: unknown): number | null =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value))
    ? Number(value)
    : null;
const num = (value: unknown) => finite(value) ?? 0;
const label = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

// Never carry this snapshot forward or infer the amount before payment.
// ResourceActor 1 is the event source; type 0 is mana. Missing is not zero.
export function parseCastMana(event: Row): CastEvent['mana'] {
  if (event.type !== 'cast' || event.resourceActor !== 1) return undefined;
  const entries = rows(event.classResources).filter(
    (entry) => entry.type === 0,
  );
  if (entries.length !== 1) return undefined;
  const { amount, max } = entries[0];
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    typeof max !== 'number' ||
    !Number.isFinite(max) ||
    max <= 0 ||
    amount > max
  )
    return undefined;
  return { amount, maximum: max };
}

function positiveSpellId(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = finite(value);
    if (parsed !== null && Number.isSafeInteger(parsed) && parsed > 0)
      return parsed;
  }
  return undefined;
}

export function iconUrl(value?: string): string | undefined {
  if (!value) return undefined;
  // Accept only icon filenames, never an API-supplied arbitrary URL.
  const slug = value.replace(/\.(jpg|png)$/i, '').toLowerCase();
  return /^[a-z0-9_-]+$/.test(slug)
    ? 'https://wow.zamimg.com/images/wow/icons/large/' + slug + '.jpg'
    : undefined;
}

export function unwrapTable(value: unknown): Row {
  const root = record(value);
  return root.data && typeof root.data === 'object' ? record(root.data) : root;
}

export function tableEntries(value: unknown): Row[] {
  const root = unwrapTable(value);
  return rows(root.entries ?? root.auras ?? root.events);
}

export function parseAbilities(
  value: unknown,
  durationSeconds: number,
  kind: 'damage' | 'casts' | 'buffs',
  sourceId?: number,
): AbilityMetric[] {
  const grouped = new Map<number, AbilityMetric>();
  for (const entry of tableEntries(value)) {
    if (
      kind === 'casts' &&
      sourceId &&
      finite(entry.actor) !== null &&
      num(entry.actor) !== sourceId
    )
      continue;
    const id = num(entry.guid ?? entry.id);
    if (!id) continue;
    // Damage totals are never cast counts. Buff tables use totalUses.
    const uses = num(
      kind === 'casts'
        ? (entry.total ?? entry.uses ?? entry.count)
        : (entry.totalUses ?? entry.uses ?? entry.count),
    );
    const uptime = finite(entry.totalUptime ?? entry.uptime);
    const current = grouped.get(id);
    const metric: AbilityMetric = {
      id,
      name: label(entry.name, 'Unknown ability'),
      icon: label(entry.abilityIcon ?? entry.icon) || undefined,
      total: num(entry.total ?? entry.amount),
      uses,
      perMinute: uses / Math.max(1 / 60, durationSeconds / 60),
      uptime:
        kind === 'buffs' && uptime !== null
          ? Math.min(
              100,
              Math.max(0, (uptime / (durationSeconds * 1000)) * 100),
            )
          : undefined,
    };
    if (current) {
      current.total += metric.total;
      current.uses += uses;
      current.perMinute += metric.perMinute;
    } else grouped.set(id, metric);
  }
  return [...grouped.values()].sort((a, b) =>
    kind === 'buffs' ? (b.uptime ?? 0) - (a.uptime ?? 0) : b.total - a.total,
  );
}

export function parseCharacter(
  value: unknown,
  sourceId: number,
): CharacterSnapshot | null {
  const root = unwrapTable(value);
  const details = record(root.playerDetails);
  const player = Object.values(details)
    .flatMap(rows)
    .find((item) => num(item.id) === sourceId);
  if (!player) return null;
  const info = record(player.combatantInfo);
  // The API can expose item level even when combatantInfo is an empty array.
  // Keep that evidence; never synthesize the missing gear or stat ratings.
  if (!Object.keys(info).length && finite(player.minItemLevel) === null)
    return null;
  const stats: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record(info.stats))) {
    const value = finite(record(entry).min);
    if (value !== null && key !== 'Item Level') stats[key] = value;
  }
  const gear: GearItem[] = rows(info.gear).flatMap((item) => {
    const id = num(item.id),
      slot = finite(item.slot),
      itemLevel = num(item.itemLevel);
    if (id <= 0 || slot === null || itemLevel <= 0 || !isCombatGearSlot(slot))
      return [];
    return [
      {
        id,
        slot,
        itemLevel,
        name: label(item.name, 'Item ' + id),
        icon: label(item.icon) || undefined,
        enchant:
          label(item.permanentEnchantName) ||
          (num(item.permanentEnchant)
            ? 'Enchant #' + num(item.permanentEnchant)
            : undefined),
        gems: rows(item.gems)
          .filter((gem) => num(gem.id) > 0)
          .map((gem) => ({
            id: num(gem.id),
            icon: label(gem.icon) || undefined,
          })),
        setId: num(item.setID) || undefined,
      },
    ];
  });
  return {
    itemLevel:
      finite(record(record(info.stats)['Item Level']).min) ??
      finite(player.minItemLevel),
    stats,
    gear,
    talentCount: rows(info.talentTree).length,
    talents: parseLearnedTalents(info),
    potionUse: finite(player.potionUse),
    healthstoneUse: finite(player.healthstoneUse),
  };
}

export function parseLearnedTalents(
  info: unknown,
): NonNullable<CharacterSnapshot['talents']> {
  const found = new Map<
    number,
    NonNullable<CharacterSnapshot['talents']>[number]
  >();
  for (const entry of [
    ...rows(record(info).talentTree),
    ...rows(record(info).talents),
  ]) {
    // WCL node IDs are not spell IDs. Never interpret a bare `id` as a spell.
    const spellId = finite(entry.spellID ?? entry.spellId);
    const rank = finite(entry.rank ?? entry.points);
    if (spellId !== null && spellId > 0 && rank !== null && rank > 0)
      found.set(spellId, {
        spellId,
        rank,
        name: label(entry.name) || undefined,
      });
  }
  return [...found.values()];
}

export function parseEvidence(
  report: unknown,
  sourceId: number,
  start: number,
  end: number,
  deathsTable?: unknown,
): RunEvidence {
  const root = record(report);
  const duration = Math.max(1, (end - start) / 1000);
  const abilities = new Map(
    rows(record(root.masterData).abilities).map((ability) => [
      num(ability.gameID),
      ability,
    ]),
  );
  const eventRoot = record(root.castEvents);
  const starts = new Map<number, number>();
  const beginTimes = new Map<Row, number>();
  const castRows = rows(eventRoot.data);
  for (const event of [...castRows].sort(
    (a, b) => num(a.timestamp) - num(b.timestamp),
  )) {
    if (num(event.sourceID) !== sourceId) continue;
    const id = num(event.abilityGameID),
      time = num(event.timestamp);
    if (event.type === 'begincast') starts.set(id, time);
    if (event.type === 'cast') {
      const begin = starts.get(id);
      if (begin !== undefined && time >= begin && time - begin <= 15000)
        beginTimes.set(event, begin);
      starts.delete(id);
    }
  }
  const casts: CastEvent[] = castRows
    .filter(
      (event) =>
        event.type === 'cast' &&
        num(event.sourceID) === sourceId &&
        num(event.timestamp) >= start &&
        num(event.timestamp) <= end,
    )
    .map((event) => {
      const id = num(event.abilityGameID),
        ability = abilities.get(id) ?? {};
      return {
        time: (num(event.timestamp) - start) / 1000,
        beganAt: beginTimes.has(event)
          ? (beginTimes.get(event)! - start) / 1000
          : undefined,
        targetId: finite(event.targetID) ?? undefined,
        targetInstance: finite(event.targetInstance) ?? undefined,
        mana: parseCastMana(event),
        id,
        name: label(ability.name, 'Spell ' + id),
        icon: label(ability.icon) || undefined,
      };
    })
    .sort((a, b) => a.time - b.time);
  const deaths: DeathEvidence[] = tableEntries(deathsTable ?? root.deaths)
    .filter(
      (event) =>
        num(event.id ?? event.targetID) === sourceId &&
        num(event.timestamp) >= start &&
        num(event.timestamp) <= end,
    )
    .map((death) => {
      const killing = record(death.killingBlow);
      return {
        time: (num(death.timestamp) - start) / 1000,
        id: positiveSpellId(killing.guid, killing.gameID),
        name: label(killing.name, 'Unknown killing blow'),
        icon: label(killing.abilityIcon ?? killing.icon) || undefined,
        damage: num(record(death.damage).total),
        healing: num(record(death.healing).total),
        window: num(death.deathWindow) / 1000,
        hits: rows(death.events)
          .filter(
            (hit) => hit.type === 'damage' && num(hit.targetID) === sourceId,
          )
          .map((hit) => ({
            time: (num(hit.timestamp) - start) / 1000,
            id: positiveSpellId(
              hit.abilityGameID,
              record(hit.ability).guid,
              record(hit.ability).gameID,
            ),
            name: label(record(hit.ability).name, 'Unknown hit'),
            icon:
              label(
                record(hit.ability).abilityIcon ?? record(hit.ability).icon,
              ) || undefined,
            amount: num(hit.amount),
          }))
          .sort((a, b) => a.time - b.time)
          .slice(-8),
      };
    });
  const fight = rows(root.fights)[0] ?? {};
  const pulls: PullEvidence[] = rows(fight.dungeonPulls)
    .filter((pull) => num(pull.endTime) > start && num(pull.startTime) < end)
    .map((pull) => {
      const pullStart = Math.max(0, (num(pull.startTime) - start) / 1000);
      const pullEnd = Math.min(duration, (num(pull.endTime) - start) / 1000);
      return {
        id: num(pull.id),
        name: label(pull.name, 'Trash pull'),
        start: pullStart,
        end: pullEnd,
        x: finite(pull.x),
        y: finite(pull.y),
        mapId: finite(rows(pull.maps)[0]?.id),
        boss: num(pull.encounterID) > 0,
        encounterId: num(pull.encounterID) || undefined,
        casts: casts.filter(
          (cast) => cast.time >= pullStart && cast.time < pullEnd,
        ).length,
        deaths: deaths.filter(
          (death) => death.time >= pullStart && death.time < pullEnd,
        ).length,
      };
    })
    .sort((a, b) => a.start - b.start);
  const castsComplete =
    Array.isArray(eventRoot.data) && !eventRoot.nextPageTimestamp;
  const warnings: string[] = [];
  if (!castsComplete)
    warnings.push(
      'Cast events are incomplete. Gap coaching is disabled; the timeline shows only available events.',
    );
  if (!pulls.length)
    warnings.push(
      'This report has no dungeon pull coordinates or pull windows.',
    );
  const graph = unwrapTable(root.damageGraph);
  const series = rows(graph.series).find(
    (item) => item.id === 'Total' || item.type === 'Total',
  );
  const damage =
    series && Array.isArray(series.data)
      ? series.data.flatMap((value, index) => {
          const time =
            (num(series.pointStart) +
              index * num(series.pointInterval) -
              start) /
            1000;
          const amount = finite(value);
          return time >= 0 && time <= duration && amount !== null
            ? [{ time, value: amount }]
            : [];
        })
      : [];
  return {
    reportStart: start,
    duration,
    casts,
    castsComplete,
    pulls,
    deaths,
    damage,
    incoming: parseIncomingGraph(root.incomingGraph, start, end).points,
    incomingSampleSeconds: parseIncomingGraph(root.incomingGraph, start, end)
      .interval,
    gaps: castsComplete ? findCastGaps(casts, pulls) : [],
    warnings,
  };
}

export function parseIncomingGraph(value: unknown, start: number, end: number) {
  const total = rows(unwrapTable(value).series).find(
    (item) => item.id === 'Total' || item.type === 'Total',
  );
  const interval = finite(total?.pointInterval);
  const origin = finite(total?.pointStart);
  if (
    !total ||
    !Array.isArray(total.data) ||
    interval === null ||
    interval <= 0 ||
    origin === null
  )
    return { points: [], interval: 0 };
  const points = total.data.flatMap((amount, index) => {
    const time = origin + index * interval;
    const value = finite(amount);
    return time >= start && time < end && value !== null && value >= 0
      ? [{ time: (time - start) / 1000, value }]
      : [];
  });
  return { points, interval: interval / 1000 };
}

export function findCastGaps(
  casts: CastEvent[],
  pulls: PullEvidence[],
): RunEvidence['gaps'] {
  // Only compare adjacent completed casts inside the same pull, not travel.
  // Channels, mechanics, stuns, and death can still explain these intervals.
  return pulls
    .flatMap((pull) => {
      const inside = casts.filter(
        (cast) => cast.time >= pull.start && cast.time < pull.end,
      );
      return inside.slice(1).flatMap((cast, index) =>
        cast.time - inside[index].time >= 5
          ? [
              {
                start: inside[index].time,
                end: cast.time,
                pullId: pull.id,
                pullName: pull.name,
              },
            ]
          : [],
      );
    })
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, 12);
}

export const GEAR_SLOTS: Record<number, string> = {
  0: 'Head',
  1: 'Neck',
  2: 'Shoulders',
  4: 'Chest',
  5: 'Waist',
  6: 'Legs',
  7: 'Feet',
  8: 'Wrists',
  9: 'Hands',
  10: 'Ring 1',
  11: 'Ring 2',
  12: 'Trinket 1',
  13: 'Trinket 2',
  14: 'Back',
  15: 'Main hand',
  16: 'Off hand',
};
