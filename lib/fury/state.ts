import type { RunEvidence } from '../domain';
import { finite, record, rows } from '../evidence';
import { FURY_AURAS } from './catalog';

export type FuryAuraEvent = NonNullable<RunEvidence['guide']>['auras'][number];

export function parseFuryAuras(
  data: unknown,
  sourceId: number,
  start: number,
  end: number,
): FuryAuraEvent[] {
  const types = new Set([
    'applybuff',
    'applybuffstack',
    'refreshbuff',
    'removebuff',
    'removebuffstack',
  ]);
  return rows(data)
    .flatMap((event): FuryAuraEvent[] => {
      const id = finite(event.abilityGameID);
      const timestamp = finite(event.timestamp);
      if (
        event.sourceID !== sourceId ||
        event.targetID !== sourceId ||
        id === null ||
        !FURY_AURAS.has(id) ||
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
          type: String(event.type) as FuryAuraEvent['type'],
          stacks: stacks !== null && stacks >= 0 ? stacks : null,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}

export function furyPageComplete(value: unknown): boolean {
  const page = record(value);
  return (
    Array.isArray(page.data) &&
    (page.nextPageTimestamp === null || page.nextPageTimestamp === undefined)
  );
}
