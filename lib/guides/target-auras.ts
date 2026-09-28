import type { RunEvidence } from '../domain';
import { finite, record, rows } from '../evidence';

export type TargetAuraEvent = {
  id: number;
  time: number;
  type: 'applydebuff' | 'refreshdebuff' | 'removedebuff';
  targetId: number;
  targetInstance: number | null;
};
export type TargetAuraEvidence = {
  specName: string;
  events: TargetAuraEvent[];
  complete: boolean;
  pages: number;
  warnings: string[];
};
export function parseTargetAuras(
  data: unknown,
  sourceId: number,
  start: number,
  end: number,
  tracked: number[],
): TargetAuraEvent[] {
  return rows(data)
    .flatMap((event): TargetAuraEvent[] => {
      const id = finite(event.abilityGameID),
        time = finite(event.timestamp),
        targetId = finite(event.targetID);
      if (
        event.sourceID !== sourceId ||
        id === null ||
        !tracked.includes(id) ||
        time === null ||
        time < start ||
        time > end ||
        targetId === null ||
        targetId <= 0 ||
        !['applydebuff', 'refreshdebuff', 'removedebuff'].includes(
          String(event.type),
        )
      )
        return [];
      const instance = finite(event.targetInstance);
      return [
        {
          id,
          time: (time - start) / 1000,
          targetId,
          targetInstance:
            instance !== null && Number.isInteger(instance) && instance > 0
              ? instance
              : null,
          type: event.type as TargetAuraEvent['type'],
        },
      ];
    })
    .sort((a, b) => a.time - b.time);
}
export type TargetWindow = {
  id: number;
  start: number;
  end: number;
  targetId: number;
  targetInstance: number | null;
  pullId: number;
};
export function closedTargetWindows(
  evidence: RunEvidence,
  id: number,
): TargetWindow[] {
  if (!evidence.targetAuras?.complete) return [];
  const open = new Map<
    string,
    { event: TargetAuraEvent; ambiguous: boolean }
  >();
  const windows: TargetWindow[] = [];
  for (const event of evidence.targetAuras.events
    .filter((event) => event.id === id)
    .sort((a, b) => a.time - b.time)) {
    const key = event.targetId + ':' + event.targetInstance;
    const prior = open.get(key);
    if (event.type === 'applydebuff') {
      open.set(key, { event, ambiguous: Boolean(prior) });
    } else if (event.type === 'refreshdebuff') {
      // A refreshed/re-applied target is not one unambiguous original window.
      if (prior) prior.ambiguous = true;
      else open.set(key, { event, ambiguous: true });
    } else {
      open.delete(key);
      if (!prior || prior.ambiguous || event.time <= prior.event.time) continue;
      const pull = evidence.pulls.find(
        (pull) => prior.event.time >= pull.start && prior.event.time < pull.end,
      );
      if (
        !pull ||
        event.time >= pull.end - 0.5 ||
        evidence.deaths.some(
          (death) =>
            death.time >= prior.event.time && death.time <= event.time + 0.5,
        )
      )
        continue;
      windows.push({
        id,
        start: prior.event.time,
        end: event.time,
        targetId: event.targetId,
        targetInstance: event.targetInstance,
        pullId: pull.id,
      });
    }
  }
  return windows;
}
export function targetPageComplete(value: unknown) {
  const page = record(value);
  return (
    Array.isArray(page.data) &&
    (page.nextPageTimestamp === null || page.nextPageTimestamp === undefined)
  );
}
