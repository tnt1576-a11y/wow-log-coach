import type { CastEvent, PullEvidence, RunEvidence } from './domain';

export function pullWindow(
  evidence: RunEvidence,
  pull: PullEvidence | undefined,
  offset: number,
  seconds: number | 'all',
) {
  const pullStart = pull?.start ?? 0;
  const pullEnd = pull?.end ?? evidence.duration;
  const length = Math.max(0.001, pullEnd - pullStart);
  const windowLength = seconds === 'all' ? length : Math.min(seconds, length);
  const safeOffset = Math.min(
    Math.max(0, offset),
    Math.max(0, length - windowLength),
  );
  const start = pullStart + safeOffset;
  const end = Math.min(pullEnd, start + windowLength);
  const events = evidence.casts.filter(
    (event) => event.time >= start && event.time < end,
  );
  const points = evidence.damage.filter(
    (point) => point.time >= start && point.time <= end,
  );
  return { start, end, pullStart, offset: safeOffset, length, events, points };
}

export function spellLanes(events: CastEvent[], spellId = 'all') {
  const lanes = new Map<
    number,
    { id: number; name: string; icon?: string; events: CastEvent[] }
  >();
  for (const event of events) {
    if (spellId !== 'all' && event.id !== Number(spellId)) continue;
    const lane = lanes.get(event.id);
    if (lane) lane.events.push(event);
    else
      lanes.set(event.id, {
        id: event.id,
        name: event.name,
        icon: event.icon,
        events: [event],
      });
  }
  return [...lanes.values()].sort(
    (a, b) => b.events.length - a.events.length || a.id - b.id,
  );
}
