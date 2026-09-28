import type { CastEvent, PullEvidence, RunEvidence } from './domain';

export function matchingBoss(
  pull: PullEvidence | undefined,
  references: PullEvidence[],
): PullEvidence | undefined {
  if (!pull?.boss || !pull.encounterId) return undefined;
  const matches = references.filter(
    (candidate) => candidate.boss && candidate.encounterId === pull.encounterId,
  );
  // Multiple attempts need an explicit choice; do not quietly pick a wipe.
  return matches.length === 1 ? matches[0] : undefined;
}

/** Both clocks start at their own pull boundary; neither run is stretched. */
export function pairedWindow(
  target: RunEvidence,
  reference: RunEvidence,
  targetPull: PullEvidence,
  referencePull: PullEvidence,
  requestedOffset = 0,
  requestedSize = 30,
) {
  const size =
    Number.isFinite(requestedSize) && requestedSize > 0 ? requestedSize : 30;
  const duration = (run: RunEvidence, pull: PullEvidence) =>
    Math.max(0, Math.min(run.duration, pull.end) - pull.start);
  const commonDuration = Math.min(
    duration(target, targetPull),
    duration(reference, referencePull),
  );
  const lastPage = Math.max(0, (Math.ceil(commonDuration / size) - 1) * size);
  const requestedPage = Number.isFinite(requestedOffset)
    ? Math.floor(Math.max(0, requestedOffset) / size) * size
    : 0;
  const offset = Math.min(requestedPage, lastPage);
  const end = Math.min(commonDuration, offset + size);
  const events = (run: RunEvidence, pull: PullEvidence) =>
    run.casts
      .filter(
        (cast) =>
          cast.time >= pull.start + offset && cast.time < pull.start + end,
      )
      .map((cast) => ({
        ...cast,
        time: cast.time - pull.start,
        ...(cast.beganAt === undefined
          ? {}
          : { beganAt: cast.beganAt - pull.start }),
      }))
      .sort((a, b) => a.time - b.time);
  return {
    offset,
    end,
    size,
    seconds: end - offset,
    commonDuration,
    target: events(target, targetPull),
    reference: events(reference, referencePull),
    complete: target.castsComplete && reference.castsComplete,
  };
}

export function compareCastWindow(target: CastEvent[], reference: CastEvent[]) {
  const groups = new Map<
    number,
    {
      id: number;
      name: string;
      icon?: string;
      yours: CastEvent[];
      theirs: CastEvent[];
    }
  >();
  const add = (casts: CastEvent[], side: 'yours' | 'theirs') => {
    for (const cast of casts) {
      if (!Number.isFinite(cast.time)) continue;
      let group = groups.get(cast.id);
      if (!group) {
        group = {
          id: cast.id,
          name: cast.name,
          icon: cast.icon,
          yours: [],
          theirs: [],
        };
        groups.set(cast.id, group);
      }
      group.icon ??= cast.icon;
      group[side].push(cast);
    }
  };
  add(target, 'yours');
  add(reference, 'theirs');
  return [...groups.values()]
    .map((group) => {
      group.yours.sort((a, b) => a.time - b.time);
      group.theirs.sort((a, b) => a.time - b.time);
      return {
        ...group,
        delta: group.yours.length - group.theirs.length,
        firstDelta:
          group.yours.length && group.theirs.length
            ? group.yours[0].time - group.theirs[0].time
            : null,
      };
    })
    .sort(
      (a, b) =>
        a.delta - b.delta ||
        Math.abs(b.firstDelta ?? 0) - Math.abs(a.firstDelta ?? 0) ||
        b.theirs.length - a.theirs.length ||
        a.name.localeCompare(b.name),
    );
}

/** A shared chronological list, not ordinal pairing of unrelated button presses. */
export function mergedCastSequence(
  target: CastEvent[],
  reference: CastEvent[],
) {
  const rows = new Map<
    number,
    { time: number; yours: CastEvent[]; theirs: CastEvent[] }
  >();
  for (const [side, casts] of [
    ['yours', target],
    ['theirs', reference],
  ] as const) {
    for (const cast of casts) {
      if (!Number.isFinite(cast.time)) continue;
      const row = rows.get(cast.time) ?? {
        time: cast.time,
        yours: [],
        theirs: [],
      };
      row[side].push(cast);
      rows.set(cast.time, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.time - b.time);
}
