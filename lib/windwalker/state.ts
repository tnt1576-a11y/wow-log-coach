import type { RunEvidence } from '../domain';
import { finite, record, rows } from '../evidence';
import { WINDWALKER_AURAS } from './catalog';

export type WindwalkerAuraEvent = NonNullable<
  RunEvidence['guide']
>['auras'][number];

export function parseWindwalkerAuras(
  data: unknown,
  sourceId: number,
  start: number,
  end: number,
): WindwalkerAuraEvent[] {
  const types = new Set([
    'applybuff',
    'applybuffstack',
    'refreshbuff',
    'removebuff',
    'removebuffstack',
  ]);
  return rows(data)
    .flatMap((event): WindwalkerAuraEvent[] => {
      const id = finite(event.abilityGameID),
        timestamp = finite(event.timestamp);
      if (
        event.sourceID !== sourceId ||
        event.targetID !== sourceId ||
        id === null ||
        !WINDWALKER_AURAS.has(id) ||
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
          type: String(event.type) as WindwalkerAuraEvent['type'],
          stacks: stacks !== null && stacks >= 0 ? stacks : null,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}

export function windwalkerPageComplete(value: unknown): boolean {
  const page = record(value);
  return (
    Array.isArray(page.data) &&
    (page.nextPageTimestamp === null || page.nextPageTimestamp === undefined)
  );
}
