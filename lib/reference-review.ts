import { z } from 'zod';
import {
  AppError,
  affixMatchingApplies,
  fightContentType,
  fightPartition,
  type RunEvidence,
} from './domain';
import { matchingFightContext } from './reference-selection';
import {
  fetchRunEvidence,
  fetchRunProfile,
  inspectReport,
} from './warcraft-logs';

const actor = z.object({
  reportCode: z.string().regex(/^[A-Za-z0-9]{8,32}$/),
  fightId: z.number().int().positive(),
  sourceId: z.number().int().positive(),
});
export const referenceReviewSchema = z.object({
  target: actor,
  reference: actor,
  matchAffixes: z.boolean().default(true),
  raidDurationTolerancePercent: z.number().min(5).max(50).optional(),
});

// Bounded cache avoids downloading the same event stream for each tab change.
const cache = new Map<
  string,
  { expires: number; promise: Promise<RunEvidence> }
>();
export async function referenceReview(
  input: z.infer<typeof referenceReviewSchema>,
): Promise<RunEvidence> {
  const cacheKey = JSON.stringify(input);
  const now = Date.now();
  for (const [key, entry] of cache) if (entry.expires < now) cache.delete(key);
  const hit = cache.get(cacheKey);
  if (hit) return hit.promise;
  const promise = loadReview(input);
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { expires: now + 10 * 60_000, promise });
  void promise.catch(() => {
    if (cache.get(cacheKey)?.promise === promise) cache.delete(cacheKey);
  });
  return promise;
}

async function loadReview(input: z.infer<typeof referenceReviewSchema>) {
  const [target, reference] = await Promise.all([
    inspectReport(input.target.reportCode),
    inspectReport(input.reference.reportCode),
  ]);
  const targetFight = target.fights.find(
    (fight) => fight.id === input.target.fightId,
  );
  const referenceFight = reference.fights.find(
    (fight) => fight.id === input.reference.fightId,
  );
  const targetPlayer = targetFight?.players.find(
    (player) => player.id === input.target.sourceId,
  );
  const referencePlayer = referenceFight?.players.find(
    (player) => player.id === input.reference.sourceId,
  );
  const affixKey = (affixes: number[]) =>
    [...new Set(affixes)].sort((a, b) => a - b).join(',');
  if (
    !targetFight ||
    !referenceFight ||
    !targetPlayer ||
    !referencePlayer ||
    !targetFight.encounterId ||
    !matchingFightContext(
      targetFight,
      referenceFight,
      input.raidDurationTolerancePercent ?? 20,
    ) ||
    targetPlayer.className !== referencePlayer.className ||
    targetPlayer.specName !== referencePlayer.specName ||
    !fightPartition(target, targetFight) ||
    !fightPartition(reference, referenceFight) ||
    fightPartition(target, targetFight)?.id !==
      fightPartition(reference, referenceFight)?.id ||
    (input.matchAffixes &&
      affixMatchingApplies(targetFight) &&
      affixKey(targetFight.keystoneAffixes) !==
        affixKey(referenceFight.keystoneAffixes))
  ) {
    throw new AppError(
      'The selected reference no longer matches this encounter, difficulty or key, duration, spec, partition, or affix selection. Run the analysis again.',
      422,
      'REFERENCE_MISMATCH',
    );
  }
  // Inspection exposes today's default partition, not the partition recorded
  // for this particular fight. Reuse the profiles already cached by analysis
  // so old saved results cannot silently cross a later balance partition.
  const [targetProfile, referenceProfile] = await Promise.all([
    fetchRunProfile(
      target.reportCode,
      targetFight.id,
      targetPlayer.id,
      targetFight.endTime - targetFight.startTime,
      targetPlayer,
      fightContentType(targetFight),
    ),
    fetchRunProfile(
      reference.reportCode,
      referenceFight.id,
      referencePlayer.id,
      referenceFight.endTime - referenceFight.startTime,
      referencePlayer,
      fightContentType(referenceFight),
    ),
  ]);
  const expectedPartition = fightPartition(target, targetFight)!.id;
  if (
    targetProfile.partitionId !== expectedPartition ||
    referenceProfile.partitionId !== expectedPartition
  ) {
    throw new AppError(
      'The selected target or reference has no verified ranking in the current partition. Run the analysis again before comparing events.',
      422,
      'REFERENCE_PARTITION_MISMATCH',
    );
  }
  return fetchRunEvidence(
    reference.reportCode,
    referenceFight,
    referencePlayer.id,
  );
}
