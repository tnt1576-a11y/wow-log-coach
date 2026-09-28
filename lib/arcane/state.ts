import type { RunEvidence } from '../domain';
import { finite, record, rows } from '../evidence';
import { ARCANE_AURAS } from './catalog';

export type AuraEvent = NonNullable<RunEvidence['arcane']>['auras'][number];
export function parseArcaneAuras(
  data: unknown,
  sourceId: number,
  start: number,
  end: number,
): AuraEvent[] {
  const types = new Set([
    'applybuff',
    'applybuffstack',
    'refreshbuff',
    'removebuff',
    'removebuffstack',
  ]);
  return rows(data)
    .flatMap((event): AuraEvent[] => {
      const id = finite(event.abilityGameID),
        timestamp = finite(event.timestamp);
      if (
        event.sourceID !== sourceId ||
        event.targetID !== sourceId ||
        id === null ||
        !ARCANE_AURAS.has(id) ||
        timestamp === null ||
        timestamp < start ||
        timestamp > end ||
        !types.has(String(event.type))
      )
        return [];
      const stacks = finite(event.stack);
      return [
        {
          time: (timestamp - start) / 1000,
          id,
          type: String(event.type) as AuraEvent['type'],
          stacks: stacks !== null && stacks >= 0 ? stacks : null,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}

export type AuraState = { active: boolean | null; stacks: number | null };
const UNKNOWN: AuraState = { active: null, stacks: null };
export function auraIndex(events: AuraEvent[]) {
  const index = new Map<number, Array<AuraState & { time: number }>>();
  for (const event of [...events].sort((a, b) => a.time - b.time)) {
    const history = index.get(event.id) ?? [];
    const prior = history.at(-1) ?? UNKNOWN;
    let state: AuraState;
    if (event.type === 'removebuff') state = { active: false, stacks: 0 };
    else if (event.type === 'refreshbuff')
      state = {
        active: true,
        stacks: event.stacks ?? (prior.active ? prior.stacks : null),
      };
    else if (event.type === 'applybuff')
      state = { active: true, stacks: event.stacks ?? 1 };
    else
      state = {
        active: event.stacks === null ? null : event.stacks > 0,
        stacks: event.stacks,
      };
    history.push({ ...state, time: event.time });
    index.set(event.id, history);
  }
  return {
    before(id: number, time: number): AuraState {
      const history = index.get(id) ?? [];
      let left = 0,
        right = history.length;
      // Use pre-action state: same-timestamp removals may be the cast's own consumption.
      while (left < right) {
        const middle = (left + right) >>> 1;
        if (history[middle].time < time) left = middle + 1;
        else right = middle;
      }
      return history[left - 1] ?? UNKNOWN;
    },
  };
}

export function arcanePageComplete(value: unknown): boolean {
  const page = record(value);
  return (
    Array.isArray(page.data) &&
    (page.nextPageTimestamp === null || page.nextPageTimestamp === undefined)
  );
}
