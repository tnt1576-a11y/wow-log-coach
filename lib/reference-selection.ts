import {
  AppError,
  fightContentType,
  type FightOption,
  type ReferenceRun,
} from './domain';

/** Kill-length matching limits cooldown-count bias; it does not match phases. */
export function matchingRaidDuration(
  targetMs: number,
  referenceMs: number,
  tolerancePercent = 20,
): boolean {
  return (
    Number.isFinite(targetMs) &&
    Number.isFinite(referenceMs) &&
    targetMs > 0 &&
    referenceMs > 0 &&
    Math.abs(referenceMs - targetMs) <= (targetMs * tolerancePercent) / 100
  );
}

export function matchingFightContext(
  target: FightOption,
  reference: FightOption,
  durationTolerancePercent = 20,
): boolean {
  if (
    fightContentType(target) !== fightContentType(reference) ||
    !target.encounterId ||
    target.encounterId !== reference.encounterId
  )
    return false;
  if (fightContentType(target) === 'raid') {
    return Boolean(
      target.difficulty &&
      target.difficulty === reference.difficulty &&
      reference.kill === true &&
      matchingRaidDuration(
        target.endTime - target.startTime,
        reference.endTime - reference.startTime,
        durationTolerancePercent,
      ),
    );
  }
  return target.keystoneLevel === reference.keystoneLevel;
}

export function candidateDateStatus(
  startTime: number,
  cutoff: number,
  upper: number,
) {
  if (!Number.isFinite(startTime) || startTime <= 0) return 'missing';
  return startTime < cutoff || startTime > upper ? 'outside' : 'accepted';
}

export function playerIdentity(name: string, server?: string): string {
  return (name + '@' + (server ?? '')).toLocaleLowerCase();
}

export function referenceKey(
  run: Pick<ReferenceRun, 'reportCode' | 'fightId' | 'sourceId' | 'player'>,
): string {
  return [run.reportCode, run.fightId, run.sourceId ?? run.player].join(':');
}

export function rankedCandidates(
  runs: ReferenceRun[],
  excludedIdentity: string,
): ReferenceRun[] {
  const seen = new Set<string>();
  return [...runs]
    .sort(
      (a, b) =>
        (b.rankingDps ?? b.dps) - (a.rankingDps ?? a.dps) ||
        b.startTime - a.startTime ||
        referenceKey(a).localeCompare(referenceKey(b)),
    )
    .filter((run) => {
      const key = referenceKey(run);
      if (
        playerIdentity(run.player, run.server) === excludedIdentity ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    });
}

/** Deduplicate players only AFTER a run passes all filters. A player's
 * higher-DPS but ineligible parse must not hide their next eligible parse. */
export async function selectReferences<T extends { run: ReferenceRun }>(
  runs: ReferenceRun[],
  excludedIdentity: string,
  resolve: (run: ReferenceRun) => Promise<T | null>,
  size = 20,
  control: {
    stopOnQuota?: boolean;
    checkCancelled?: () => void;
    rethrowFatal?: (error: unknown) => void;
    onProgress?: (
      checked: number,
      selected: number,
      filtered: number,
      failed: number,
    ) => void;
  } = {},
): Promise<{
  stopReason?: string;
  selected: T[];
  checked: number;
  failed: number;
  filtered: number;
}> {
  let stopReason: string | undefined;
  const width = control.stopOnQuota ? 1 : 4;
  const queue = rankedCandidates(runs, excludedIdentity);
  const selected: T[] = [];
  const players = new Set<string>();
  let checked = 0,
    failed = 0,
    filtered = 0;
  for (
    let index = 0;
    index < queue.length && selected.length < size;
    index += width
  ) {
    control.checkCancelled?.();
    const batch = queue
      .slice(index, index + width)
      .filter((run) => !players.has(playerIdentity(run.player, run.server)));
    const results = await Promise.all(
      batch.map(async (run) => {
        checked++;
        try {
          return await resolve(run);
        } catch (error) {
          if (
            control.stopOnQuota &&
            error instanceof AppError &&
            ['WCL_QUOTA_GUARD', 'WCL_RATE_LIMITED'].includes(error.code)
          ) {
            stopReason = error.message;
            return undefined;
          }
          control.rethrowFatal?.(error);
          if (
            error instanceof AppError &&
            [429, 499, 503, 504].includes(error.status)
          )
            throw error;
          failed++;
          return undefined;
        }
      }),
    );
    for (const result of results) {
      if (result === null) {
        filtered++;
        continue;
      }
      if (!result) continue;
      const key = playerIdentity(result.run.player, result.run.server);
      if (
        key === excludedIdentity ||
        players.has(key) ||
        selected.length >= size
      )
        continue;
      players.add(key);
      selected.push(result);
    }
    control.onProgress?.(checked, selected.length, filtered, failed);
    if (stopReason) break;
  }
  return {
    selected,
    checked,
    failed,
    filtered,
    ...(stopReason ? { stopReason } : {}),
  };
}
