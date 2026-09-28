import type { RunEvidence } from './domain';
import { defensiveAuraSpell, DEFENSIVE_AURA_IDS } from './defensives';
import { finite, record, rows } from './evidence';

type IncomingHit = NonNullable<RunEvidence['incomingHits']>[number];
type AuraEvent = NonNullable<RunEvidence['defensiveAuras']>['events'][number];
const auraIds = new Set(DEFENSIVE_AURA_IDS);
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

// WCL uses nonpositive actor sentinels for missing/unknown owners.
function positiveActorId(value: unknown): number | undefined {
  const id = finite(value);
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function metadata(masterData: unknown) {
  const master = record(masterData);
  return {
    abilities: new Map(
      rows(master.abilities).map((ability) => [
        finite(ability.gameID),
        ability,
      ]),
    ),
    actors: new Map(
      rows(master.actors).map((actor) => [finite(actor.id), text(actor.name)]),
    ),
  };
}
function pageEvents(page: unknown) {
  return rows(Array.isArray(page) ? page : record(page).data);
}

/** Target-owned incoming events only. Amount is recorded damage, not pre-mitigation damage. */
export function parseIncomingHits(
  page: unknown,
  masterData: unknown,
  sourceId: number,
  startMs: number,
  endMs: number,
): IncomingHit[] {
  const { abilities, actors } = metadata(masterData);
  return pageEvents(page)
    .flatMap((event): IncomingHit[] => {
      const timestamp = finite(event.timestamp);
      const id =
        finite(event.abilityGameID) ?? finite(record(event.ability).gameID);
      const amount = finite(event.amount);
      if (
        event.type !== 'damage' ||
        finite(event.targetID) !== sourceId ||
        timestamp === null ||
        timestamp < startMs ||
        timestamp >= endMs ||
        id === null ||
        id <= 0 ||
        amount === null ||
        amount < 0
      )
        return [];
      const ability = abilities.get(id);
      const actorId = positiveActorId(event.sourceID);
      return [
        {
          time: (timestamp - startMs) / 1000,
          id,
          name:
            text(ability?.name) ??
            text(record(event.ability).name) ??
            'Spell ' + id,
          icon: text(ability?.icon),
          amount,
          sourceId: actorId,
          sourceName: actorId === undefined ? undefined : actors.get(actorId),
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}

/** Only observed tracked effects received by the selected player, including allied casters. */
export function parseDefensiveAuras(
  page: unknown,
  masterData: unknown,
  sourceId: number,
  startMs: number,
  endMs: number,
): AuraEvent[] {
  const { abilities, actors } = metadata(masterData);
  return pageEvents(page)
    .flatMap((event): AuraEvent[] => {
      const timestamp = finite(event.timestamp);
      const id =
        finite(event.abilityGameID) ?? finite(record(event.ability).gameID);
      const type = event.type;
      if (
        (type !== 'applybuff' &&
          type !== 'refreshbuff' &&
          type !== 'removebuff') ||
        finite(event.targetID) !== sourceId ||
        timestamp === null ||
        timestamp < startMs ||
        timestamp > endMs ||
        id === null ||
        !auraIds.has(id)
      )
        return [];
      const ability = abilities.get(id);
      const definition = defensiveAuraSpell(id);
      const actorId = positiveActorId(event.sourceID);
      return [
        {
          time: (timestamp - startMs) / 1000,
          id,
          name: text(ability?.name) ?? definition?.name ?? 'Spell ' + id,
          icon: text(ability?.icon) ?? definition?.icon,
          type,
          sourceId: actorId,
          sourceName: actorId === undefined ? undefined : actors.get(actorId),
          targetId: sourceId,
          targetName: actors.get(sourceId),
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}
