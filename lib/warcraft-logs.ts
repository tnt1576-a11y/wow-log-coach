// oxlint-disable typescript/no-explicit-any -- Warcraft Logs table and ranking fields are untyped JSON scalars.
import {
  AppError,
  fightContentType,
  type ContentType,
  type FightOption,
  type InspectionResult,
  type PlayerOption,
  type ReferenceRun,
  type RunMetrics,
  isDpsSpec,
  parseReportLocator,
} from './domain';
import {
  parseAbilities,
  parseCharacter,
  parseEvidence,
  parseLearnedTalents,
  record,
  rows,
} from './evidence';
import { arcanePageComplete, parseArcaneAuras } from './arcane/state';
import {
  demonologyPageComplete,
  parseDemonologyAuras,
} from './demonology/state';
import { firePageComplete, parseFireAuras } from './fire/state';
import { frostPageComplete, parseFrostAuras } from './frost/state';
import { furyPageComplete, parseFuryAuras } from './fury/state';
import { parseShadowAuras, shadowPageComplete } from './shadow/state';
import { PROC_GUIDES } from './guides/proc-definitions';
import {
  parseTargetAuras,
  targetPageComplete,
  type TargetAuraEvidence,
} from './guides/target-auras';
import { parseSurvivalAuras, survivalPageComplete } from './survival/state';
import {
  parseWindwalkerAuras,
  windwalkerPageComplete,
} from './windwalker/state';

import { graphql } from './wcl-transport';
import { parseDefensiveAuras, parseIncomingHits } from './defensive-evidence';
import { DEFENSIVE_AURA_IDS } from './defensives';
import { rethrowFatal, progress } from './analysis-context';
export { graphql, credentialsConfigured } from './wcl-transport';

const INSPECTION_QUERY = `
  query InspectReport($code: String!, $fightIDs: [Int]) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        revision
        zone {
          id
          name
          partitions { id name default }
        }
        masterData {
          actors { id name type subType server }
        }
        fights(fightIDs: $fightIDs) {
          id
          name
          startTime
          endTime
          encounterID
          difficulty
          size
          kill
          averageItemLevel
          friendlyPlayers
          friendlySpecs
          keystoneLevel
          keystoneBonus
          keystoneTime
          keystoneAffixes
          gameZone { id name }
        }
      }
    }
  }
`;

interface RawActor {
  id: number;
  name: string;
  type?: string;
  subType?: string;
  server?: string;
}
interface RawFight {
  id: number;
  name?: string;
  startTime: number;
  endTime: number;
  encounterID: number;
  difficulty?: number;
  size?: number;
  kill?: boolean;
  averageItemLevel?: number;
  friendlyPlayers?: number[];
  friendlySpecs?: string[];
  keystoneLevel?: number;
  keystoneBonus?: number;
  keystoneTime?: number;
  keystoneAffixes?: number[];
  gameZone?: { id?: number; name?: string };
}
interface RawReport {
  code: string;
  title: string;
  startTime: number;
  revision: number;
  zone?: {
    id: number;
    name: string;
    partitions?: Array<{ id: number; name: string; default: boolean }>;
  };
  masterData?: { actors?: RawActor[] };
  fights?: RawFight[];
}

export async function inspectReport(
  input: string,
  fightId?: number,
): Promise<InspectionResult> {
  const locator = parseReportLocator(input);
  const data = await graphql<{ reportData?: { report?: RawReport | null } }>(
    INSPECTION_QUERY,
    { code: locator.reportCode, fightIDs: fightId ? [fightId] : null },
  );
  const report = data.reportData?.report;
  if (!report)
    throw new AppError(
      'Warcraft Logs report not found.',
      404,
      'REPORT_NOT_FOUND',
    );

  const actors = new Map(
    (report.masterData?.actors ?? []).map((actor) => [actor.id, actor]),
  );
  const fights = (report.fights ?? [])
    .filter(
      (fight) =>
        ((fight.keystoneLevel ?? 0) > 0 &&
          (fight.keystoneBonus ?? 0) > 0 &&
          (fight.keystoneTime ?? 0) > 0 &&
          fight.kill !== false) ||
        (!(fight.keystoneLevel ?? 0) &&
          fight.encounterID > 0 &&
          (fight.size ?? 0) >= 10 &&
          [3, 4, 5].includes(fight.difficulty ?? 0) &&
          fight.kill === true &&
          fight.endTime > fight.startTime),
    )
    .map((fight): FightOption => {
      const players = (fight.friendlyPlayers ?? [])
        .map((id, index): PlayerOption | null => {
          const actor = actors.get(id);
          const specName = fight.friendlySpecs?.[index] ?? '';
          if (!actor || actor.type !== 'Player' || !isDpsSpec(specName))
            return null;
          return {
            id,
            name: actor.name,
            className: actor.subType ?? 'Unknown',
            specName,
            server: actor.server,
          };
        })
        .filter((player): player is PlayerOption => Boolean(player));
      return {
        id: fight.id,
        contentType: (fight.keystoneLevel ?? 0) > 0 ? 'mythic-plus' : 'raid',
        difficulty: fight.difficulty,
        kill: fight.kill,
        raidSize: (fight.keystoneLevel ?? 0) > 0 ? undefined : fight.size,
        name:
          fight.name ??
          fight.gameZone?.name ??
          report.zone?.name ??
          ((fight.keystoneLevel ?? 0) > 0 ? 'Mythic+ dungeon' : 'Raid boss'),
        startTime: fight.startTime,
        endTime: fight.endTime,
        keystoneLevel: fight.keystoneLevel ?? 0,
        keystoneBonus: fight.keystoneBonus ?? 0,
        keystoneTime: fight.keystoneTime ?? 0,
        keystoneAffixes: fight.keystoneAffixes ?? [],
        averageItemLevel: fight.averageItemLevel,
        encounterId: fight.encounterID,
        zoneId: undefined,
        zoneName: fight.gameZone?.name ?? report.zone?.name,
        players,
      };
    });

  if (!fights.length) {
    throw new AppError(
      'No completed in-time Retail Mythic+ run or Normal, Heroic, or Mythic raid boss kill was found in this report.',
      422,
      'NO_SUPPORTED_FIGHT',
    );
  }
  // A report can contain raid and dungeon fights. Its overall zone is not
  // reliable ranking context for a particular Mythic+ run.
  const encounterIds = [
    ...new Set(
      fights
        .map((fight) => fight.encounterId)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  const contexts = new Map<
    number,
    {
      id: number;
      partitions: Array<{ id: number; name: string; default: boolean }>;
    }
  >();
  for (let offset = 0; offset < encounterIds.length; offset += 20) {
    const batch = encounterIds.slice(offset, offset + 20);
    const variables = Object.fromEntries(
      batch.map((id, index) => ['id' + index, id]),
    );
    const definitions = batch
      .map((_, index) => '$id' + index + ': Int!')
      .join(', ');
    const fields = batch
      .map(
        (_, index) =>
          'e' +
          index +
          ': encounter(id: $id' +
          index +
          ') { zone { id partitions { id name default } } }',
      )
      .join('\n');
    const context = await graphql<{
      worldData: Record<
        string,
        {
          zone: {
            id: number;
            partitions: Array<{ id: number; name: string; default: boolean }>;
          };
        } | null
      >;
    }>(
      'query FightRankingContexts(' +
        definitions +
        ') { worldData { ' +
        fields +
        ' } }',
      variables,
    );
    batch.forEach((id, index) => {
      const zone = context.worldData?.['e' + index]?.zone;
      if (zone) contexts.set(id, zone);
    });
  }
  for (const fight of fights) {
    const context = contexts.get(fight.encounterId);
    fight.zoneId = context?.id;
    const partition = context?.partitions.find((item) => item.default);
    fight.rankingPartition = partition
      ? { id: partition.id, name: partition.name }
      : null;
  }
  const selectedFight =
    locator.fight === 'last'
      ? fights.at(-1)
      : fights.find((fight) => fight.id === locator.fight);
  const defaultFight =
    selectedFight ?? (fights.length === 1 ? fights[0] : null);
  const selectedSourceId = defaultFight?.players.some(
    (player) => player.id === locator.sourceId,
  )
    ? locator.sourceId
    : defaultFight?.players.length === 1
      ? defaultFight.players[0].id
      : null;
  const commonContext = fights.every(
    (fight) =>
      fight.zoneId === fights[0].zoneId &&
      fight.rankingPartition?.id === fights[0].rankingPartition?.id,
  );
  const partition =
    defaultFight?.rankingPartition ??
    (commonContext ? fights[0].rankingPartition : null);

  return {
    reportCode: report.code,
    reportTitle: report.title,
    reportStartTime: report.startTime,
    partition: partition ? { id: partition.id, name: partition.name } : null,
    fights,
    selectedFightId: defaultFight?.id ?? null,
    selectedSourceId,
  };
}

/** Verify percentile and partition before paying for a full candidate profile. */
export async function fetchRunRanking(
  code: string,
  fightId: number,
  player: Pick<PlayerOption, 'name' | 'server' | 'className' | 'specName'>,
  contentType: ContentType = 'mythic-plus',
) {
  const data = await graphql<{
    reportData?: { report?: { rankings?: unknown } };
  }>(
    'query PlayerRanking($code: String!, $fightIDs: [Int]) { reportData { report(code: $code) { rankings(fightIDs: $fightIDs, playerMetric: dps) } } }',
    { code, fightIDs: [fightId] },
  );
  const rankings = data.reportData?.report?.rankings;
  return {
    percentile: extractPlayerPercentile(
      rankings,
      player,
      contentType === 'raid' ? 'rankPercent' : 'bracketPercent',
      fightId,
    ),
    partitionId: extractRankingPartition(rankings, fightId),
  };
}

const TABLE_QUERY = `
  query PlayerTables($code: String!, $fightIDs: [Int], $sourceID: Int, $guide: Boolean!) {
    reportData {
      report(code: $code) {
        rankings(fightIDs: $fightIDs, playerMetric: dps)
        playerDetails(fightIDs: $fightIDs, includeCombatantInfo: true)
        combatants: events(dataType: CombatantInfo, fightIDs: $fightIDs, sourceID: $sourceID, limit: 100) @include(if: $guide) { data nextPageTimestamp }
        damage: table(dataType: DamageDone, fightIDs: $fightIDs, sourceID: $sourceID, viewBy: Ability)
        casts: table(dataType: Casts, fightIDs: $fightIDs, sourceID: $sourceID)
        buffs: table(dataType: Buffs, fightIDs: $fightIDs, sourceID: $sourceID)
        taken: table(dataType: DamageTaken, fightIDs: $fightIDs, sourceID: $sourceID, viewBy: Ability)
        interrupts: table(dataType: Interrupts, fightIDs: $fightIDs, sourceID: $sourceID)
        deaths: table(dataType: Deaths, fightIDs: $fightIDs, sourceID: $sourceID)
      }
    }
  }
`;

export async function fetchRunProfile(
  code: string,
  fightId: number,
  sourceId: number,
  durationMs: number,
  player: PlayerOption,
  contentType: ContentType = 'mythic-plus',
): Promise<{
  metrics: RunMetrics;
  percentile: number | null;
  partitionId: number | null;
}> {
  const data = await graphql<{
    reportData?: { report?: Record<string, unknown> | null };
  }>(TABLE_QUERY, {
    code,
    fightIDs: [fightId],
    sourceID: sourceId,
    guide: Boolean(guideStateConfig(player)),
  });
  const report = data.reportData?.report;
  if (!report)
    throw new AppError(
      'Could not load player tables for this run.',
      502,
      'TABLES_MISSING',
    );
  if (
    report.damage === null ||
    report.damage === undefined ||
    report.casts === null ||
    report.casts === undefined
  ) {
    throw new AppError(
      'Damage or cast tables are unavailable for this player. Missing tables cannot be compared as zero.',
      502,
      'TABLES_MISSING',
    );
  }
  const durationSeconds = Math.max(1, durationMs / 1000);
  const damageEntries = tableEntries(report.damage);
  const casts = parseAbilities(
    report.casts,
    durationSeconds,
    'casts',
    sourceId,
  );
  const takenEntries = tableEntries(report.taken);
  const interruptEntries = tableEntries(report.interrupts);
  const deathEntries = tableEntries(report.deaths);
  const damage = tableTotal(report.damage, damageEntries);
  const recordedActiveTimes = damageEntries
    .map((entry) => numberValue(entry.activeTime))
    .filter((value) => value > 0);
  const activeTimeMs = recordedActiveTimes.length
    ? Math.max(...recordedActiveTimes)
    : durationMs;
  const castTotal = casts.reduce((sum, entry) => sum + entry.uses, 0);

  const metrics: RunMetrics = {
    dps: damage / durationSeconds,
    activeDps: damage / Math.max(1, activeTimeMs / 1000),
    damage,
    durationSeconds,
    castsPerMinute: castTotal / (durationSeconds / 60),
    interrupts: Math.round(tableTotal(report.interrupts, interruptEntries)),
    deaths:
      deathEntries.length ||
      Math.round(numberValue(unwrapTable(report.deaths).total)),
    damageTakenPerSecond:
      tableTotal(report.taken, takenEntries) / durationSeconds,
    abilities: parseAbilities(report.damage, durationSeconds, 'damage'),
    buffs: parseAbilities(report.buffs, durationSeconds, 'buffs'),
    buffsAvailable: report.buffs !== null && report.buffs !== undefined,
    casts,
    damageTaken: parseAbilities(report.taken, durationSeconds, 'damage'),
    character: parseCharacter(report.playerDetails, sourceId),
  };
  const talentSnapshots = rows(record(report.combatants).data)
    .filter((event) => event.sourceID === sourceId)
    .map(parseLearnedTalents)
    .filter((talents) => talents.length);
  // A changing loadout is not one fixed build. Retain only talents present in
  // every returned snapshot; an absent talent remains unknown, not unselected.
  const commonTalents =
    talentSnapshots[0]?.filter((talent) =>
      talentSnapshots.every((snapshot) =>
        snapshot.some(
          (item) =>
            item.spellId === talent.spellId && item.rank === talent.rank,
        ),
      ),
    ) ?? [];
  if (talentSnapshots.length) {
    if (metrics.character) metrics.character.talents = commonTalents;
    else
      metrics.character = {
        itemLevel: null,
        gear: [],
        stats: {},
        talentCount: commonTalents.length,
        talents: commonTalents,
        potionUse: null,
        healthstoneUse: null,
      };
  }
  return {
    metrics,
    percentile: extractPlayerPercentile(
      report.rankings,
      player,
      contentType === 'raid' ? 'rankPercent' : 'bracketPercent',
      fightId,
    ),
    partitionId: extractRankingPartition(report.rankings, fightId),
  };
}

export function extractRankingPartition(
  value: unknown,
  fightId: number,
): number | null {
  const data =
    value && typeof value === 'object'
      ? (value as Record<string, any>).data
      : null;
  const fight = Array.isArray(data)
    ? data.find((row) => row?.fightID === fightId)
    : undefined;
  const partition = fight?.partition;
  return typeof partition === 'number' &&
    Number.isInteger(partition) &&
    partition > 0
    ? partition
    : null;
}

export function extractBracketPercentile(
  value: unknown,
  player: PlayerOption,
): number | null {
  return extractPlayerPercentile(value, player, 'bracketPercent');
}

export function extractPlayerPercentile(
  value: unknown,
  player: Pick<PlayerOption, 'name' | 'server' | 'className' | 'specName'>,
  metric: 'bracketPercent' | 'rankPercent',
  fightId?: number,
): number | null {
  if (!value || typeof value !== 'object') return null;
  const data = (value as Record<string, any>).data;
  if (!Array.isArray(data)) return null;
  for (const fight of data) {
    if (fightId !== undefined && fight.fightID !== fightId) continue;
    const roles = fight?.roles;
    if (!roles || typeof roles !== 'object') continue;
    for (const role of Object.values(roles) as any[]) {
      const characters = Array.isArray(role?.characters) ? role.characters : [];
      const match = characters.find((character: any) => {
        const serverName =
          typeof character?.server?.name === 'string'
            ? character.server.name
            : '';
        return (
          String(character?.name ?? '').toLocaleLowerCase() ===
            player.name.toLocaleLowerCase() &&
          String(character?.class ?? '') === player.className &&
          String(character?.spec ?? '') === player.specName &&
          (!player.server || !serverName || serverName === player.server)
        );
      });
      if (!match) continue;
      if (match[metric] === null || match[metric] === undefined) return null;
      const percentile = Number(match[metric]);
      return Number.isFinite(percentile) && percentile >= 0 && percentile <= 100
        ? percentile
        : null;
    }
  }
  return null;
}

function unwrapTable(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, any>;
  return record.data && typeof record.data === 'object' ? record.data : record;
}

function tableEntries(value: unknown): Array<Record<string, any>> {
  const table = unwrapTable(value);
  const entries = table.entries ?? table.auras ?? table.events ?? [];
  return Array.isArray(entries)
    ? entries.filter((entry) => entry && typeof entry === 'object')
    : [];
}

function tableTotal(
  value: unknown,
  entries: Array<Record<string, any>>,
): number {
  const table = unwrapTable(value);
  const direct = numberValue(table.total);
  if (direct > 0) return direct;
  return entries.reduce(
    (sum, entry) => sum + numberValue(entry.total ?? entry.amount),
    0,
  );
}

function numberValue(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

const EVIDENCE_QUERY = `
  query PlayerEvidence($code: String!, $fightIDs: [Int], $sourceID: Int, $start: Float, $end: Float) {
    reportData {
      report(code: $code) {
        masterData { abilities { gameID name icon } actors { id name } }
        fights(fightIDs: $fightIDs) {
          dungeonPulls { id name encounterID startTime endTime x y maps { id } }
        }
        castEvents: events(dataType: Casts, fightIDs: $fightIDs, sourceID: $sourceID, includeResources: true, limit: 10000) { data nextPageTimestamp }
        damageGraph: graph(dataType: DamageDone, fightIDs: $fightIDs, sourceID: $sourceID, startTime: $start, endTime: $end)
        deaths: table(dataType: Deaths, fightIDs: $fightIDs, sourceID: $sourceID)
      }
    }
  }
`;

export async function fetchRunEvidence(
  code: string,
  fight: FightOption,
  sourceId: number,
) {
  const variables = {
    code,
    fightIDs: [fight.id],
    sourceID: sourceId,
    start: fight.startTime,
    end: fight.endTime,
  };
  const player = fight.players.find((entry) => entry.id === sourceId);
  const guide = guideStateConfig(player);
  const [
    data,
    incoming,
    trackedState,
    targetState,
    damageEvents,
    defensiveEvents,
  ] = await Promise.all([
    graphql<{ reportData?: { report?: Record<string, unknown> } }>(
      EVIDENCE_QUERY,
      variables,
    ),
    graphql<{ reportData?: { report?: { incomingGraph?: unknown } } }>(
      `
        query Incoming(
          $code: String!
          $fightIDs: [Int]
          $sourceID: Int
          $start: Float
          $end: Float
        ) {
          reportData {
            report(code: $code) {
              incomingGraph: graph(
                dataType: DamageTaken
                fightIDs: $fightIDs
                sourceID: $sourceID
                startTime: $start
                endTime: $end
              )
            }
          }
        }
      `,
      variables,
    ).catch((error) => {
      rethrowFatal(error);
      return undefined;
    }),
    guide
      ? fetchTrackedAuraState(
          code,
          fight,
          sourceId,
          guide.label,
          guide.parseAuras,
          guide.pageComplete,
        ).catch((error) => {
          rethrowFatal(error);
          return {
            auras: [],
            complete: false,
            pages: 0,
            warnings: [
              guide.label +
                ' buff events could not be loaded. State-dependent guide checks are unavailable.',
            ],
          };
        })
      : Promise.resolve(undefined),
    player?.className === 'Rogue' && player.specName === 'Assassination'
      ? fetchAssassinationTargetState(code, fight, sourceId).catch((error) => {
          rethrowFatal(error);
          return {
            specName: 'Assassination',
            events: [],
            complete: false,
            pages: 0,
            warnings: [
              'Target debuff events could not be loaded. Kingsbane window review is unavailable.',
            ],
          };
        })
      : Promise.resolve(undefined),
    fetchReceivedEvents(code, fight, sourceId, 'damage').catch((error) => {
      rethrowFatal(error);
      return { events: [], complete: false, pages: 0 };
    }),
    fetchReceivedEvents(code, fight, sourceId, 'defensives').catch((error) => {
      rethrowFatal(error);
      return { events: [], complete: false, pages: 0 };
    }),
  ]);
  const report = data.reportData?.report;
  // A raid attempt is one encounter, aligned from its own pull start.
  const evidenceReport =
    fightContentType(fight) === 'raid'
      ? {
          ...report,
          fights: [
            {
              dungeonPulls: [
                {
                  id: fight.id,
                  name: fight.name,
                  encounterID: fight.encounterId,
                  startTime: fight.startTime,
                  endTime: fight.endTime,
                },
              ],
            },
          ],
        }
      : report;
  const evidence = parseEvidence(
    {
      ...evidenceReport,
      incomingGraph: incoming?.reportData?.report?.incomingGraph,
    },
    sourceId,
    fight.startTime,
    fight.endTime,
  );
  evidence.incomingHits = parseIncomingHits(
    damageEvents.events,
    report?.masterData,
    sourceId,
    fight.startTime,
    fight.endTime,
  );
  evidence.incomingHitsComplete = damageEvents.complete;
  evidence.incomingHitPages = damageEvents.pages;
  evidence.defensiveAuras = {
    events: parseDefensiveAuras(
      defensiveEvents.events,
      report?.masterData,
      sourceId,
      fight.startTime,
      fight.endTime,
    ),
    complete: defensiveEvents.complete,
    pages: defensiveEvents.pages,
    warnings: defensiveEvents.complete
      ? []
      : [
          'Defensive aura events are incomplete. Missing protection does not prove a defensive was unused.',
        ],
  };
  if (!damageEvents.complete)
    evidence.warnings.push(
      'Incoming damage events are incomplete; source-level defensive review shows only recorded hits.',
    );
  evidence.warnings.push(...evidence.defensiveAuras.warnings);
  if (guide?.key === 'arcane') evidence.arcane = trackedState;
  else if (guide?.key === 'fire') evidence.fire = trackedState;
  else if (guide?.key === 'frost') evidence.frost = trackedState;
  if (guide && trackedState)
    evidence.guide = { specName: guide.label, ...trackedState };
  if (targetState) evidence.targetAuras = targetState;
  if (!evidence.incoming?.length)
    evidence.warnings.push(
      'Incoming-damage graph unavailable. Defensive casts and death review still use available events.',
    );
  return evidence;
}

/**
 * WCL incoming views (DamageTaken and Buffs) use sourceID for the receiving
 * player. This is a view filter: returned raw events still identify that
 * player as targetID and retain the enemy or allied caster as sourceID.
 * Filtering these views by targetID instead selects the attacker/caster.
 */
async function fetchReceivedEvents(
  code: string,
  fight: FightOption,
  sourceId: number,
  kind: 'damage' | 'defensives',
): Promise<{ events: unknown[]; complete: boolean; pages: number }> {
  const events: unknown[] = [];
  let cursor = fight.startTime,
    complete = false,
    pages = 0;
  const type = kind === 'damage' ? 'DamageTaken' : 'Buffs';
  const filter =
    kind === 'defensives'
      ? DEFENSIVE_AURA_IDS.map((id) => 'ability.id = ' + id).join(' OR ')
      : null;
  for (; pages < 5;) {
    progress(
      'events',
      'Loading ' +
        (kind === 'damage' ? 'incoming damage' : 'defensive support') +
        ' page ' +
        (pages + 1) +
        '.',
    );
    const data = await graphql<{
      reportData?: { report?: { received?: unknown } };
    }>(
      'query Received' +
        (kind === 'damage' ? 'Damage' : 'Defensives') +
        '($code: String!, $fightIDs: [Int], $sourceID: Int, $start: Float, $end: Float, $filter: String) { reportData { report(code: $code) { received: events(dataType: ' +
        type +
        ', fightIDs: $fightIDs, sourceID: $sourceID, startTime: $start, endTime: $end, filterExpression: $filter, limit: 10000) { data nextPageTimestamp } } } }',
      {
        code,
        fightIDs: [fight.id],
        sourceID: sourceId,
        start: cursor,
        end: fight.endTime,
        filter,
      },
    );
    pages++;
    const page = record(data.reportData?.report?.received);
    if (!Array.isArray(page.data)) break;
    events.push(...page.data);
    if (
      page.nextPageTimestamp === null ||
      page.nextPageTimestamp === undefined
    ) {
      complete = true;
      break;
    }
    const next = Number(page.nextPageTimestamp);
    if (!Number.isFinite(next) || next <= cursor || next > fight.endTime) break;
    cursor = next;
  }
  return { events, complete, pages };
}

async function fetchAssassinationTargetState(
  code: string,
  fight: FightOption,
  sourceId: number,
): Promise<TargetAuraEvidence> {
  const events: TargetAuraEvidence['events'] = [];
  let cursor = fight.startTime,
    complete = false,
    pages = 0;
  for (; pages < 3;) {
    progress('events', 'Loading target debuff page ' + (pages + 1) + '.');
    const data = await graphql<{
      reportData?: { report?: { auras?: unknown } };
    }>(
      `
        query TargetAuras(
          $code: String!
          $fightIDs: [Int]
          $sourceID: Int
          $start: Float
          $end: Float
        ) {
          reportData {
            report(code: $code) {
              auras: events(
                dataType: Debuffs
                fightIDs: $fightIDs
                targetID: $sourceID
                hostilityType: Enemies
                filterExpression: "ability.id = 360194 OR ability.id = 385627"
                startTime: $start
                endTime: $end
                limit: 10000
              ) {
                data
                nextPageTimestamp
              }
            }
          }
        }
      `,
      {
        code,
        fightIDs: [fight.id],
        sourceID: sourceId,
        start: cursor,
        end: fight.endTime,
      },
    );
    pages++;
    const page = record(data.reportData?.report?.auras);
    if (!Array.isArray(page.data)) break;
    events.push(
      ...parseTargetAuras(
        page.data,
        sourceId,
        fight.startTime,
        fight.endTime,
        [360194, 385627],
      ),
    );
    if (targetPageComplete(page)) {
      complete = true;
      break;
    }
    const next = Number(page.nextPageTimestamp);
    if (!Number.isFinite(next) || next <= cursor || next > fight.endTime) break;
    cursor = next;
  }
  return {
    specName: 'Assassination',
    events,
    complete,
    pages,
    warnings: complete
      ? []
      : [
          'Target debuff events are incomplete. Kingsbane window review is unavailable.',
        ],
  };
}

type GuideStateConfig = {
  key: string;
  label: string;
  parseAuras: typeof parseArcaneAuras;
  pageComplete: typeof arcanePageComplete;
};

function guideStateConfig(player?: PlayerOption): GuideStateConfig | null {
  const procGuide = PROC_GUIDES.find(
    (guide) =>
      guide.pack.className === player?.className &&
      guide.pack.specName === player.specName,
  );
  if (procGuide) return procGuide.state;
  if (player?.className === 'Monk' && player.specName === 'Windwalker')
    return {
      key: 'windwalker',
      label: 'Windwalker',
      parseAuras: parseWindwalkerAuras,
      pageComplete: windwalkerPageComplete,
    };
  if (player?.className === 'Mage' && player.specName === 'Arcane')
    return {
      key: 'arcane',
      label: 'Arcane',
      parseAuras: parseArcaneAuras,
      pageComplete: arcanePageComplete,
    };
  if (player?.className === 'Mage' && player.specName === 'Fire')
    return {
      key: 'fire',
      label: 'Fire',
      parseAuras: parseFireAuras,
      pageComplete: firePageComplete,
    };
  if (player?.className === 'Mage' && player.specName === 'Frost')
    return {
      key: 'frost',
      label: 'Frost',
      parseAuras: parseFrostAuras,
      pageComplete: frostPageComplete,
    };
  if (player?.className === 'Priest' && player.specName === 'Shadow')
    return {
      key: 'shadow',
      label: 'Shadow',
      parseAuras: parseShadowAuras,
      pageComplete: shadowPageComplete,
    };
  if (player?.className === 'Warlock' && player.specName === 'Demonology')
    return {
      key: 'demonology',
      label: 'Demonology',
      parseAuras: parseDemonologyAuras,
      pageComplete: demonologyPageComplete,
    };
  if (player?.className === 'Warrior' && player.specName === 'Fury')
    return {
      key: 'fury',
      label: 'Fury',
      parseAuras: parseFuryAuras,
      pageComplete: furyPageComplete,
    };
  if (player?.className === 'Hunter' && player.specName === 'Survival')
    return {
      key: 'survival',
      label: 'Survival',
      parseAuras: parseSurvivalAuras,
      pageComplete: survivalPageComplete,
    };
  return null;
}

async function fetchTrackedAuraState(
  code: string,
  fight: FightOption,
  sourceId: number,
  label: string,
  parseAuras: typeof parseArcaneAuras,
  pageComplete: typeof arcanePageComplete,
) {
  const auras: ReturnType<typeof parseArcaneAuras> = [];
  let cursor = fight.startTime,
    complete = false,
    pages = 0;
  for (; pages < 3;) {
    progress('events', 'Loading ' + label + ' buff page ' + (pages + 1) + '.');
    const data = await graphql<{
      reportData?: { report?: { auras?: unknown } };
    }>(
      `
        query TrackedAuras(
          $code: String!
          $fightIDs: [Int]
          $sourceID: Int
          $start: Float
          $end: Float
        ) {
          reportData {
            report(code: $code) {
              auras: events(
                dataType: Buffs
                fightIDs: $fightIDs
                sourceID: $sourceID
                startTime: $start
                endTime: $end
                limit: 10000
              ) {
                data
                nextPageTimestamp
              }
            }
          }
        }
      `,
      {
        code,
        fightIDs: [fight.id],
        sourceID: sourceId,
        start: cursor,
        end: fight.endTime,
      },
    );
    pages++;
    const page = record(data.reportData?.report?.auras);
    auras.push(
      ...parseAuras(page.data, sourceId, fight.startTime, fight.endTime),
    );
    if (pageComplete(page)) {
      complete = true;
      break;
    }
    const next = Number(page.nextPageTimestamp);
    if (!Number.isFinite(next) || next <= cursor || next > fight.endTime) break;
    cursor = next;
  }
  return {
    auras,
    complete,
    pages,
    warnings: complete
      ? []
      : [
          label +
            ' buff events are incomplete. State-dependent guide findings are disabled.',
        ],
  };
}

const RANKINGS_QUERY = `
  query ComparisonRankings(
    $encounterID: Int!,
    $bracket: Int,
    $difficulty: Int,
    $partition: Int,
    $page: Int,
    $className: String,
    $specName: String
  ) {
    worldData {
      encounter(id: $encounterID) {
        characterRankings(
          bracket: $bracket,
          difficulty: $difficulty,
          partition: $partition,
          page: $page,
          className: $className,
          specName: $specName,
          metric: dps,
          includeOtherPlayers: false
        )
      }
    }
    rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
  }
`;

export async function fetchRankingPage(
  encounterId: number,
  keyLevel: number,
  partition: number | null,
  className: string,
  specName: string,
  page: number,
  raidDifficulty?: number,
): Promise<{
  runs: ReferenceRun[];
  hasMore: boolean;
  rateLimit?: Record<string, number>;
}> {
  const data = await graphql<{
    worldData?: { encounter?: { characterRankings?: unknown } | null };
    rateLimitData?: Record<string, number>;
  }>(RANKINGS_QUERY, {
    encounterID: encounterId,
    bracket:
      raidDifficulty === undefined ? rankingBracketForKeyLevel(keyLevel) : null,
    difficulty: raidDifficulty ?? null,
    partition,
    page,
    className,
    specName,
  });
  const raw = data.worldData?.encounter?.characterRankings;
  const root =
    raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const list = findRankings(root);
  const runs = list
    .map(normalizeRanking)
    .filter((run): run is ReferenceRun => Boolean(run));
  const pageNumber = numberValue(root.page ?? root.currentPage) || page;
  const totalPages = numberValue(root.pageCount ?? root.totalPages);
  const hasMore =
    typeof root.hasMorePages === 'boolean'
      ? root.hasMorePages
      : totalPages
        ? pageNumber < totalPages
        : runs.length > 0;
  return { runs, hasMore, rateLimit: data.rateLimitData };
}

export function rankingBracketForKeyLevel(keyLevel: number): number {
  return Math.max(1, Math.trunc(keyLevel) - 1);
}

function findRankings(root: Record<string, any>): any[] {
  if (Array.isArray(root.rankings)) return root.rankings;
  if (root.data && Array.isArray(root.data.rankings)) return root.data.rankings;
  if (Array.isArray(root.data)) return root.data;
  return [];
}

function normalizeRanking(entry: any): ReferenceRun | null {
  if (!entry || typeof entry !== 'object') return null;
  const report = entry.report ?? {};
  const code = String(report.code ?? entry.reportCode ?? '');
  const fightId = numberValue(
    report.fightID ?? report.fightId ?? entry.fightID ?? entry.fightId,
  );
  const player = String(entry.name ?? entry.playerName ?? '');
  if (!code || !fightId || !player) return null;
  const startTime = normalizeTimestamp(entry.startTime ?? report.startTime);
  const percentile = numberValue(
    entry.rankPercent ??
      entry.percentile ??
      entry.historicalPercent ??
      entry.percent,
  );
  const amount = numberValue(entry.amount ?? entry.total);
  if (amount <= 0) return null;
  const duration = numberValue(entry.duration);
  const affixSource = entry.affixes ?? report.affixes ?? [];
  const affixes = Array.isArray(affixSource)
    ? affixSource
        .map((affix: any) =>
          numberValue(typeof affix === 'object' ? affix.id : affix),
        )
        .filter(Boolean)
    : [];
  return {
    player,
    className: String(entry.class ?? entry.className ?? ''),
    specName: String(entry.spec ?? entry.specName ?? ''),
    reportCode: code,
    fightId,
    sourceId: numberValue(entry.sourceID ?? entry.sourceId) || undefined,
    percentile,
    dps: amount,
    rankingDps: amount,
    duration,
    startTime,
    affixes,
    server:
      typeof entry.server?.name === 'string'
        ? entry.server.name
        : typeof entry.server === 'string'
          ? entry.server
          : undefined,
    url: 'https://www.warcraftlogs.com/reports/' + code + '#fight=' + fightId,
  };
}

function normalizeTimestamp(value: unknown): number {
  const number = numberValue(value);
  return number > 0 && number < 10_000_000_000 ? number * 1000 : number;
}

export function dateCutoff(
  preset: '14' | '30' | '90' | 'all' | 'custom',
  from?: string,
): number {
  if (preset === 'all') return 0;
  if (preset === 'custom' && from)
    return new Date(from + 'T00:00:00.000Z').getTime();
  return Date.now() - Number(preset) * 24 * 60 * 60 * 1000;
}
