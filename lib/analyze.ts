import type {
  AnalysisRequest,
  AnalysisResult,
  FightOption,
  ReferenceRun,
  RunMetrics,
} from './domain';
import {
  AppError,
  affixMatchingApplies,
  fightContentType,
  fightDurationMs,
  fightPartition,
  raidDifficultyLabel,
} from './domain';
import { buildDistributions, buildFindings } from './statistics';
import { compareBuffs, compareGear, compareSpells } from './comparisons';
import {
  playerIdentity,
  selectReferences,
  candidateDateStatus,
  matchingFightContext,
} from './reference-selection';
import { arcaneBuild } from './arcane/build';
import type { Hero } from './arcane/catalog';
import {
  dateCutoff,
  fetchRankingPage,
  fetchRunProfile,
  fetchRunRanking,
  fetchRunEvidence,
  inspectReport,
} from './warcraft-logs';

const MAX_REFERENCE_RUNS = 20;
import {
  progress,
  rethrowFatal,
  checkCancelled,
  isQuotaStop,
  analysisContext,
} from './analysis-context';
import { analysisBudgetStatus } from './wcl-transport';
const MAX_CANDIDATES = 60;
const MAX_RANKING_PAGES = 3;

export async function analyze(
  request: AnalysisRequest,
): Promise<AnalysisResult> {
  checkCancelled();
  progress('inspection', 'Checking the selected report, encounter and player.');
  const inspection = await inspectReport(request.reportUrl);
  const fight = inspection.fights.find((item) => item.id === request.fightId);
  if (!fight)
    throw new AppError(
      'The selected Mythic+ run or raid boss kill is not available.',
      422,
      'INVALID_FIGHT',
    );
  const contentType = fightContentType(fight);
  const raid = contentType === 'raid';
  const matchAffixes = request.matchAffixes && affixMatchingApplies(fight);
  const durationTolerancePercent = request.raidDurationTolerancePercent ?? 20;
  const player = fight.players.find((item) => item.id === request.sourceId);
  const partition = fightPartition(inspection, fight);
  if (fight.rankingPartition === null) {
    throw new AppError(
      'The encounter ranking partition could not be verified. Try inspecting the report again before comparing players.',
      422,
      'RANKING_CONTEXT_UNAVAILABLE',
    );
  }
  if (!player)
    throw new AppError(
      'The selected player is not an eligible DPS player in this fight.',
      422,
      'INVALID_PLAYER',
    );
  if (!fight.encounterId) {
    throw new AppError(
      'Warcraft Logs did not provide a ranking encounter for this fight.',
      422,
      'NO_RANKING_ENCOUNTER',
    );
  }

  progress('target', 'Loading your damage, casts, gear and rankings.');
  const targetProfile = await fetchRunProfile(
    inspection.reportCode,
    fight.id,
    player.id,
    fight.endTime - fight.startTime,
    player,
    contentType,
  );
  const targetMetrics = targetProfile.metrics;
  const isArcane = player.className === 'Mage' && player.specName === 'Arcane';
  const requiredHero: Hero = isArcane
    ? arcaneBuild(targetMetrics).hero.value
    : 'unknown';
  if (partition && targetProfile.partitionId !== partition.id) {
    throw new AppError(
      'This target has no verified DPS ranking in the current partition. Choose a log from the current partition so hotfix-separated rankings are not mixed.',
      422,
      'TARGET_PARTITION_MISMATCH',
    );
  }
  let stopReason: string | undefined;
  progress(
    'events',
    'Loading your casts, incoming damage, defensive support and encounter windows.',
  );
  const evidence = await fetchRunEvidence(
    inspection.reportCode,
    fight,
    player.id,
  ).catch((error) => {
    if (isQuotaStop(error)) {
      stopReason = error.message;
      return undefined;
    }
    rethrowFatal(error);
    return undefined;
  });
  progress(
    'rankings',
    'Searching individual-DPS rankings within your filters.',
  );
  const discovery = await discoverCandidates(
    request,
    partition?.id ?? null,
    fight,
    player.className,
    player.specName,
  );
  progress('references', 'Verifying candidate reports against your filters.', {
    candidates: discovery.candidates.length,
    checked: 0,
    selected: 0,
  });
  const rejectionCounts: Record<string, number> = {};
  const reject = (reason: string): null => {
    rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
    return null;
  };
  const selection = await selectReferences(
    discovery.candidates,
    playerIdentity(player.name, player.server),
    (candidate) =>
      resolveReference(
        candidate,
        matchAffixes ? fight.keystoneAffixes : null,
        fight,
        player.specName,
        request.percentileMin,
        request.percentileMax,
        player.className,
        partition?.id ?? null,
        discovery.cutoff,
        discovery.upper,
        requiredHero,
        durationTolerancePercent,
        reject,
      ),
    MAX_REFERENCE_RUNS,
    {
      stopOnQuota: true,
      checkCancelled,
      rethrowFatal,
      onProgress: (checked, selected, filtered, failed) =>
        progress(
          'references',
          'Verified ' +
            checked +
            ' candidate runs; ' +
            selected +
            ' qualify, ' +
            filtered +
            ' filtered, ' +
            failed +
            ' unavailable.',
          { checked, selected, rejectionCounts: { ...rejectionCounts } },
        ),
    },
  );
  stopReason ??= discovery.stopReason ?? selection.stopReason;
  const resolved = selection.selected;
  const failedReferences = selection.failed;
  const filteredReferences = selection.filtered;

  const referenceMetrics = resolved.map((item) => item.metrics);
  const metrics = buildDistributions(targetMetrics, referenceMetrics);
  checkCancelled();
  progress('summary', 'Building spell, gear and coaching comparisons.', {
    checked: selection.checked,
    selected: resolved.length,
  });
  const findings = referenceMetrics.length >= 8 ? buildFindings(metrics) : [];
  const warnings: string[] = [];
  if (stopReason)
    warnings.push(
      'API spending stopped early. The review retains your loaded data and ' +
        resolved.length +
        ' qualifying references. ' +
        stopReason,
    );
  else if (discovery.searchLimited && resolved.length < MAX_REFERENCE_RUNS)
    warnings.push(
      'Reference search is limited to 60 candidates across up to 3 ranking pages to protect API points. Collected matches are shown without widening your filters.',
    );
  if (raid)
    warnings.push(
      'Raid references require the same boss, ' +
        raidDifficultyLabel(fight.difficulty) +
        ' difficulty, spec and ranking partition, with kill durations within ±' +
        durationTolerancePercent +
        '%. Boss phases, add assignments, raid size and external offensive buffs can still explain differences. Cooldown timestamps are aligned to pull start, not automatically to phases.',
    );
  if (isArcane)
    warnings.push(
      requiredHero === 'unknown'
        ? 'Arcane hero tree could not be verified from the aggregate log data. References are not hero-matched; confirm builds before comparing rotations.'
        : 'Arcane references require recorded ' +
            requiredHero +
            ' evidence. Unknown or different hero trees are excluded. Other talents and tier bonuses are not fully matched.',
    );
  if (!evidence)
    warnings.push(
      'Detailed events or pull data could not be loaded. Aggregate comparisons are still available.',
    );
  if (!targetMetrics.character)
    warnings.push(
      'The selected player has no combatant gear/stat snapshot in this log.',
    );
  else if (
    !targetMetrics.character.gear.length ||
    !Object.keys(targetMetrics.character.stats).length
  ) {
    warnings.push(
      'This report exposes item level but omits some or all equipped-item and stat details. Missing details are unavailable, not zero.',
    );
  }
  if (evidence) warnings.push(...evidence.warnings);
  if (resolved.length < MAX_REFERENCE_RUNS) {
    warnings.push(
      'Only ' +
        resolved.length +
        ' distinct qualifying reference runs were fully analyzed in the searched sample at ' +
        request.percentileMin +
        '-' +
        request.percentileMax +
        ' percentile. Up to 20 can be included; 20 is not required to finish. Filters were not broadened.',
    );
  }
  if (resolved.length < 8) {
    warnings.push(
      'Fewer than 8 comparable runs were available, so cohort-based coaching conclusions are suppressed. Individual event checks do not depend on cohort size.',
    );
  }
  if (failedReferences) {
    warnings.push(
      failedReferences +
        ' candidate runs were skipped because their public data or tables were unavailable.',
    );
  }
  if (filteredReferences && resolved.length < MAX_REFERENCE_RUNS) {
    warnings.push(
      filteredReferences +
        (raid
          ? ' candidate runs failed percentile, boss, difficulty, duration, spec, date, partition, or hero-tree checks.'
          : ' candidate runs failed percentile, key, spec, affix, date, partition, or hero-tree checks.'),
    );
  }
  if (affixMatchingApplies(fight) && !request.matchAffixes) {
    warnings.push(
      'Affix matching is disabled. Route, utility, and damage-taking comparisons may be less comparable.',
    );
  }

  return {
    schemaVersion: 1,
    apiUsage: analysisBudgetStatus()
      ? {
          ...analysisBudgetStatus()!,
          requests: analysisContext.getStore()?.requests ?? 0,
          cacheHits: analysisContext.getStore()?.cacheHits ?? 0,
        }
      : undefined,
    generatedAt: new Date().toISOString(),
    target: {
      contentType,
      difficulty: raid ? fight.difficulty : undefined,
      encounterId: fight.encounterId,
      raidName: raid ? fight.zoneName : undefined,
      raidSize: raid ? fight.raidSize : undefined,
      rankingZoneId: fight.zoneId,
      reportCode: inspection.reportCode,
      fightId: fight.id,
      sourceId: player.id,
      player: player.name,
      className: player.className,
      specName: player.specName,
      dungeon: raid ? fight.name : (fight.zoneName ?? fight.name),
      keyLevel: fight.keystoneLevel,
      duration: fightDurationMs(fight),
      affixes: fight.keystoneAffixes,
      url:
        'https://www.warcraftlogs.com/reports/' +
        inspection.reportCode +
        '#fight=' +
        fight.id +
        '&source=' +
        player.id,
    },
    cohort: {
      affixMatchingApplicable: affixMatchingApplies(fight),
      durationTolerancePercent: raid ? durationTolerancePercent : undefined,
      heroMatch: isArcane
        ? { hero: requiredHero, matched: requiredHero !== 'unknown' }
        : undefined,
      selection: {
        metric: 'dps',
        pagesSearched: discovery.pagesSearched,
        rankingRows: discovery.rankingRows,
        missingDateRows: discovery.missingDateRows,
        outsideDateRows: discovery.outsideDateRows,
        eligibleCandidates: discovery.candidates.length,
        checkedRuns: selection.checked,
        failedRuns: selection.failed,
        filteredRuns: selection.filtered,
        rejectionCounts,
        searchLimited: discovery.searchLimited || Boolean(stopReason),
      },
      requestedSize: 20,
      actualSize: resolved.length,
      percentileMin: request.percentileMin,
      percentileMax: request.percentileMax,
      dateLabel: dateLabel(request),
      partition,
      affixesMatched: matchAffixes,
      confidence:
        resolved.length >= 15
          ? 'high'
          : resolved.length >= 8
            ? 'medium'
            : 'insufficient',
    },
    metrics,
    targetMetrics,
    spells: compareSpells(targetMetrics, referenceMetrics),
    buffComparisons: compareBuffs(targetMetrics, referenceMetrics),
    gear: compareGear(targetMetrics, referenceMetrics),
    evidence,
    findings,
    references: resolved.map((item) => ({
      ...item.run,
      metrics: item.metrics,
    })),
    warnings,
  };
}

async function discoverCandidates(
  request: AnalysisRequest,
  partition: number | null,
  fight: FightOption,
  className: string,
  specName: string,
) {
  const cutoff = dateCutoff(request.datePreset, request.dateFrom);
  const upper =
    request.datePreset === 'custom' && request.dateTo
      ? new Date(request.dateTo + 'T23:59:59.999Z').getTime()
      : Number.POSITIVE_INFINITY;
  const candidates: ReferenceRun[] = [];
  let pagesSearched = 0,
    rankingRows = 0,
    missingDateRows = 0,
    outsideDateRows = 0,
    searchLimited = false;

  let stopReason: string | undefined;
  for (
    let page = 1;
    page <= MAX_RANKING_PAGES && candidates.length < MAX_CANDIDATES;
    page += 1
  ) {
    const response = await fetchRankingPage(
      fight.encounterId,
      fight.keystoneLevel,
      partition,
      className,
      specName,
      page,
      fightContentType(fight) === 'raid' ? fight.difficulty : undefined,
    ).catch((error) => {
      if (isQuotaStop(error)) {
        stopReason = error.message;
        return null;
      }
      throw error;
    });
    if (!response) {
      searchLimited = true;
      break;
    }
    pagesSearched++;
    progress('rankings', 'Read ranking page ' + pagesSearched + '.', {
      pages: pagesSearched,
      candidates: candidates.length + response.runs.length,
    });
    rankingRows += response.runs.length;
    for (const run of response.runs) {
      const status = candidateDateStatus(run.startTime, cutoff, upper);
      if (status === 'missing') missingDateRows++;
      else if (status === 'outside') outsideDateRows++;
      else if (candidates.length < MAX_CANDIDATES) candidates.push(run);
    }
    searchLimited = response.hasMore || candidates.length >= MAX_CANDIDATES;
    if (!response.hasMore) break;
    // The transport guards every uncached API call using the latest quota.
    // A cached ranking page can contain stale quota metadata after a reset.
  }
  return {
    stopReason,
    candidates,
    cutoff,
    upper,
    pagesSearched,
    rankingRows,
    missingDateRows,
    outsideDateRows,
    searchLimited,
  };
}

async function resolveReference(
  candidate: ReferenceRun,
  requiredAffixes: number[] | null,
  requiredFight: FightOption,
  requiredSpec: string,
  percentileMin: number,
  percentileMax: number,
  requiredClass: string,
  requiredPartition: number | null,
  cutoff: number,
  upper: number,
  requiredHero: Hero = 'unknown',
  durationTolerancePercent = 20,
  reject: (reason: string) => null = () => null,
): Promise<{ run: ReferenceRun; metrics: RunMetrics } | null> {
  // Rankings identify the character by name, realm and spec. Actor IDs and
  // player tables are only needed after this inexpensive eligibility check.
  const ranking = await fetchRunRanking(
    candidate.reportCode,
    candidate.fightId,
    {
      name: candidate.player,
      server: candidate.server,
      className: requiredClass,
      specName: requiredSpec,
    },
    fightContentType(requiredFight),
  );
  if (requiredPartition !== null && ranking.partitionId !== requiredPartition)
    return reject('Ranking partition mismatch');
  if (ranking.percentile === null) return reject('Percentile unavailable');
  if (ranking.percentile < percentileMin || ranking.percentile > percentileMax)
    return reject('Outside percentile range');
  const inspection = await inspectReport(candidate.url, candidate.fightId);
  const fight = inspection.fights.find((item) => item.id === candidate.fightId);
  if (
    !fight ||
    !matchingFightContext(requiredFight, fight, durationTolerancePercent)
  )
    return reject('Encounter, key or raid context mismatch');
  if (
    requiredPartition !== null &&
    fightPartition(inspection, fight)?.id !== requiredPartition
  )
    return reject('Ranking partition mismatch');
  const startTime = inspection.reportStartTime + fight.startTime;
  if (startTime < cutoff || startTime > upper)
    return reject('Outside date range');
  if (requiredAffixes && !sameSet(fight.keystoneAffixes, requiredAffixes))
    return reject('Affixes do not match');
  const player = fight.players.find(
    (item) =>
      item.specName === requiredSpec &&
      item.className === requiredClass &&
      item.name.toLocaleLowerCase() === candidate.player.toLocaleLowerCase() &&
      (!candidate.server ||
        item.server?.toLocaleLowerCase() ===
          candidate.server.toLocaleLowerCase()),
  );
  if (!player) return reject('Player or specialization could not be verified');
  const profile = await fetchRunProfile(
    candidate.reportCode,
    fight.id,
    player.id,
    fight.endTime - fight.startTime,
    player,
    fightContentType(fight),
  );
  if (
    requiredHero !== 'unknown' &&
    arcaneBuild(profile.metrics).hero.value !== requiredHero
  )
    return reject('Hero tree does not match or is unavailable');
  if (
    (requiredPartition !== null && profile.partitionId !== requiredPartition) ||
    profile.percentile === null ||
    profile.percentile < percentileMin ||
    profile.percentile > percentileMax
  )
    return reject('Profile ranking failed final verification');
  return {
    run: {
      ...candidate,
      contentType: fightContentType(fight),
      difficulty: fight.difficulty,
      encounterId: fight.encounterId,
      raidSize: fight.raidSize,
      startTime,
      server: player.server ?? candidate.server,
      character: profile.metrics.character,
      percentile: profile.percentile,
      sourceId: player.id,
      className: player.className,
      specName: player.specName,
      duration: fightDurationMs(fight),
      affixes: fight.keystoneAffixes,
      dps: profile.metrics.dps,
      url: candidate.url + '&source=' + player.id,
    },
    metrics: profile.metrics,
  };
}

function sameSet(left: number[], right: number[]): boolean {
  return (
    [...new Set(left)].sort((a, b) => a - b).join(',') ===
    [...new Set(right)].sort((a, b) => a - b).join(',')
  );
}

function dateLabel(request: AnalysisRequest): string {
  if (request.datePreset === 'all') return 'All logs in current partition';
  if (request.datePreset === 'custom')
    return request.dateFrom + ' to ' + request.dateTo;
  return 'Last ' + request.datePreset + ' days';
}
