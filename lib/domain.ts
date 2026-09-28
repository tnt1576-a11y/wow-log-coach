import { z } from 'zod';

export const DPS_SPECS = new Set([
  'Affliction',
  'Arcane',
  'Arms',
  'Assassination',
  'Augmentation',
  'Balance',
  'Beast Mastery',
  'Demonology',
  'Destruction',
  'Devastation',
  'Devourer',
  'Elemental',
  'Enhancement',
  'Feral',
  'Fire',
  'Frost',
  'Fury',
  'Havoc',
  'Marksmanship',
  'Outlaw',
  'Retribution',
  'Shadow',
  'Subtlety',
  'Survival',
  'Unholy',
  'Windwalker',
]);

export const analysisRequestSchema = z
  .object({
    reportUrl: z.string().min(1),
    fightId: z.number().int().positive(),
    sourceId: z.number().int().positive(),
    percentileMin: z.number().min(0).max(100).default(95),
    percentileMax: z.number().min(0).max(100).default(100),
    datePreset: z.enum(['14', '30', '90', 'all', 'custom']).default('14'),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    matchAffixes: z.boolean().default(true),
    raidDurationTolerancePercent: z.number().min(5).max(50).optional(),
  })
  .superRefine((value, context) => {
    if (value.percentileMin > value.percentileMax) {
      context.addIssue({
        code: 'custom',
        message: 'Minimum percentile cannot exceed maximum percentile.',
      });
    }
    if (value.datePreset === 'custom' && (!value.dateFrom || !value.dateTo)) {
      context.addIssue({
        code: 'custom',
        message: 'Custom dates require both a start and end date.',
      });
    }
    if (value.datePreset === 'custom' && value.dateFrom && value.dateTo) {
      const validDate = (date: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isFinite(Date.parse(date + 'T00:00:00.000Z')) &&
        new Date(date + 'T00:00:00.000Z').toISOString().slice(0, 10) === date;
      if (
        !validDate(value.dateFrom) ||
        !validDate(value.dateTo) ||
        value.dateFrom > value.dateTo
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Use valid custom dates with the start on or before the end.',
        });
      }
    }
  });

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

export interface ReportLocator {
  reportCode: string;
  fight: number | 'last' | null;
  sourceId: number | null;
}

export interface PlayerOption {
  id: number;
  name: string;
  className: string;
  specName: string;
  server?: string;
}

export type ContentType = 'mythic-plus' | 'raid';

export interface FightOption {
  /** Absent on saved Mythic+ analyses created before raid support. */
  contentType?: ContentType;
  difficulty?: number;
  kill?: boolean;
  raidSize?: number;
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  keystoneLevel: number;
  keystoneBonus: number;
  keystoneTime: number;
  keystoneAffixes: number[];
  averageItemLevel?: number;
  encounterId: number;
  zoneId?: number;
  /** Default partition of this fight's ranking encounter, not the report's zone. */
  rankingPartition?: { id: number; name: string } | null;
  zoneName?: string;
  players: PlayerOption[];
}

export interface InspectionResult {
  reportCode: string;
  reportTitle: string;
  reportStartTime: number;
  partition: { id: number; name: string } | null;
  fights: FightOption[];
  selectedFightId: number | null;
  selectedSourceId: number | null;
}

export function fightPartition(
  inspection: InspectionResult,
  fight: FightOption,
) {
  return fight.rankingPartition === undefined
    ? inspection.partition
    : fight.rankingPartition;
}

/** Saved results without a content type remain Mythic+ compatible. */
export function fightContentType(
  fight: Pick<FightOption, 'contentType'>,
): ContentType {
  return fight.contentType ?? 'mythic-plus';
}

export function affixMatchingApplies(
  fight: Pick<FightOption, 'contentType' | 'keystoneLevel'>,
): boolean {
  return (
    fightContentType(fight) === 'mythic-plus' &&
    fight.keystoneLevel > 0 &&
    fight.keystoneLevel < 12
  );
}

export function raidDifficultyLabel(difficulty?: number): string {
  return (
    (
      { 1: 'LFR', 3: 'Normal', 4: 'Heroic', 5: 'Mythic' } as Record<
        number,
        string
      >
    )[difficulty ?? 0] ?? 'Unknown difficulty'
  );
}

export function fightDurationMs(
  fight: Pick<
    FightOption,
    'contentType' | 'startTime' | 'endTime' | 'keystoneTime'
  >,
): number {
  return fightContentType(fight) === 'raid'
    ? fight.endTime - fight.startTime
    : fight.keystoneTime;
}

export interface ReferenceRun {
  contentType?: ContentType;
  difficulty?: number;
  encounterId?: number;
  raidSize?: number;
  /** WCL individual-DPS leaderboard amount; never a speed score. */
  rankingDps?: number;
  metrics?: RunMetrics;
  character?: CharacterSnapshot | null;
  player: string;
  className: string;
  specName: string;
  reportCode: string;
  fightId: number;
  sourceId?: number;
  percentile: number;
  dps: number;
  duration: number;
  startTime: number;
  affixes: number[];
  server?: string;
  url: string;
}

export interface MetricDistribution {
  nonZeroCount?: number;
  icon?: string;
  id: string;
  label: string;
  unit: 'number' | 'percent' | 'seconds' | 'perMinute' | 'damage';
  direction: 'higher' | 'lower' | 'context';
  target: number;
  median: number;
  p25: number;
  p75: number;
  targetPercentile: number;
  sampleSize: number;
}

export interface Finding {
  id: string;
  category:
    | 'damage'
    | 'rotation'
    | 'cooldowns'
    | 'utility'
    | 'survival'
    | 'context';
  severity: 'major' | 'moderate' | 'positive' | 'info';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  targetValue: number;
  medianValue: number;
  deltaPercent: number | null;
  metricId: string;
}

export interface AbilityMetric {
  id: number;
  name: string;
  icon?: string;
  total: number;
  uses: number;
  perMinute: number;
  uptime?: number;
}

export interface RunMetrics {
  dps: number;
  activeDps: number;
  damage: number;
  durationSeconds: number;
  castsPerMinute: number;
  interrupts: number;
  deaths: number;
  damageTakenPerSecond: number;
  abilities: AbilityMetric[];
  buffs: AbilityMetric[];
  buffsAvailable?: boolean;
  casts?: AbilityMetric[];
  damageTaken?: AbilityMetric[];
  character?: CharacterSnapshot | null;
}

export interface GearItem {
  id: number;
  slot: number;
  name: string;
  icon?: string;
  itemLevel: number;
  enchant?: string;
  gems: Array<{ id: number; icon?: string }>;
  setId?: number;
}

export interface CharacterSnapshot {
  /** Explicit learned spell IDs only; missing entries do not mean unselected. */
  talents?: Array<{ spellId: number; rank: number; name?: string }>;
  itemLevel: number | null;
  stats: Record<string, number>;
  gear: GearItem[];
  talentCount: number;
  potionUse: number | null;
  healthstoneUse: number | null;
}

export interface SpellComparison {
  damageIds?: number[];
  id: number;
  name: string;
  icon?: string;
  casts: MetricDistribution;
  damage: MetricDistribution;
  referenceUsers: number;
  targetUses: number;
}

export interface GearComparison {
  snapshotCount: number;
  itemLevel: MetricDistribution | null;
  stats: MetricDistribution[];
  slots: Array<{
    slot: number;
    target: GearItem | null;
    medianItemLevel: number;
    sampleSize: number;
    enchantedCount: number;
    gemmedCount: number;
    popular: Array<{ item: GearItem; count: number }>;
  }>;
}

export interface CastEvent {
  /** Source-owned mana attached to this successful cast, not proven pre-cost state. */
  mana?: { amount: number; maximum: number };
  beganAt?: number;
  targetId?: number;
  targetInstance?: number;
  time: number;
  id: number;
  name: string;
  icon?: string;
}
export interface PullEvidence {
  encounterId?: number;
  id: number;
  name: string;
  start: number;
  end: number;
  x: number | null;
  y: number | null;
  mapId: number | null;
  boss: boolean;
  casts: number;
  deaths: number;
}
export interface DeathEvidence {
  id?: number;
  time: number;
  name: string;
  icon?: string;
  damage: number;
  healing: number;
  window: number;
  hits: Array<{
    time: number;
    id?: number;
    name: string;
    icon?: string;
    amount: number;
  }>;
}
export interface IncomingHit {
  time: number;
  id: number;
  name: string;
  icon?: string;
  amount: number;
  sourceId?: number;
  sourceName?: string;
}

export interface DefensiveAuraEvent {
  time: number;
  id: number;
  name: string;
  icon?: string;
  type: 'applybuff' | 'refreshbuff' | 'removebuff';
  sourceId?: number;
  sourceName?: string;
  targetId?: number;
  targetName?: string;
}

export interface RunEvidence {
  incomingHits?: IncomingHit[];
  incomingHitsComplete?: boolean;
  incomingHitPages?: number;
  defensiveAuras?: {
    events: DefensiveAuraEvent[];
    complete: boolean;
    pages: number;
    warnings: string[];
  };
  /** Selected player's tracked debuffs on individual targets; separate from self buffs. */
  targetAuras?: import('./guides/target-auras').TargetAuraEvidence;
  /** Tracked self-buff state for the selected spec's curated guide pack. */
  guide?: {
    specName: string;
    auras: Array<{
      time: number;
      id: number;
      type:
        | 'applybuff'
        | 'applybuffstack'
        | 'refreshbuff'
        | 'removebuff'
        | 'removebuffstack';
      stacks: number | null;
    }>;
    complete: boolean;
    pages: number;
    warnings: string[];
  };
  arcane?: {
    auras: Array<{
      time: number;
      id: number;
      type:
        | 'applybuff'
        | 'applybuffstack'
        | 'refreshbuff'
        | 'removebuff'
        | 'removebuffstack';
      stacks: number | null;
    }>;
    complete: boolean;
    pages: number;
    warnings: string[];
  };
  fire?: {
    auras: Array<{
      time: number;
      id: number;
      type:
        | 'applybuff'
        | 'applybuffstack'
        | 'refreshbuff'
        | 'removebuff'
        | 'removebuffstack';
      stacks: number | null;
    }>;
    complete: boolean;
    pages: number;
    warnings: string[];
  };
  frost?: {
    auras: Array<{
      time: number;
      id: number;
      type:
        | 'applybuff'
        | 'applybuffstack'
        | 'refreshbuff'
        | 'removebuff'
        | 'removebuffstack';
      stacks: number | null;
    }>;
    complete: boolean;
    pages: number;
    warnings: string[];
  };
  incoming?: Array<{ time: number; value: number }>;
  incomingSampleSeconds?: number;
  reportStart: number;
  duration: number;
  casts: CastEvent[];
  castsComplete: boolean;
  pulls: PullEvidence[];
  deaths: DeathEvidence[];
  gaps: Array<{ start: number; end: number; pullId: number; pullName: string }>;
  damage: Array<{ time: number; value: number }>;
  warnings: string[];
}

export interface AnalysisResult {
  apiUsage?: {
    pointLimit: number;
    pointsSpent: number;
    limited: boolean;
    requests: number;
    cacheHits: number;
  };
  schemaVersion: 1;
  generatedAt: string;
  target: {
    contentType?: ContentType;
    difficulty?: number;
    encounterId?: number;
    raidName?: string;
    raidSize?: number;
    rankingZoneId?: number;
    reportCode: string;
    fightId: number;
    sourceId: number;
    player: string;
    className: string;
    specName: string;
    dungeon: string;
    keyLevel: number;
    duration: number;
    affixes: number[];
    url: string;
  };
  cohort: {
    affixMatchingApplicable?: boolean;
    durationTolerancePercent?: number;
    heroMatch?: {
      hero: 'Sunfury' | 'Spellslinger' | 'unknown';
      matched: boolean;
    };
    selection?: {
      metric: 'dps';
      pagesSearched: number;
      rankingRows: number;
      missingDateRows?: number;
      outsideDateRows?: number;
      eligibleCandidates: number;
      checkedRuns: number;
      failedRuns: number;
      filteredRuns: number;
      rejectionCounts?: Record<string, number>;
      searchLimited: boolean;
    };
    requestedSize: 20;
    actualSize: number;
    percentileMin: number;
    percentileMax: number;
    dateLabel: string;
    partition: { id: number; name: string } | null;
    affixesMatched: boolean;
    confidence: 'high' | 'medium' | 'insufficient';
  };
  metrics: MetricDistribution[];
  targetMetrics: RunMetrics;
  spells?: SpellComparison[];
  buffComparisons?: MetricDistribution[];
  gear?: GearComparison;
  evidence?: RunEvidence;
  findings: Finding[];
  references: ReferenceRun[];
  warnings: string[];
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'BAD_REQUEST',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function parseReportLocator(value: string): ReportLocator {
  const raw = value.trim();
  if (/^[A-Za-z0-9]{8,32}$/.test(raw)) {
    return { reportCode: raw, fight: null, sourceId: null };
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
  } catch {
    throw new AppError(
      'Enter a valid Warcraft Logs report URL or report code.',
      400,
      'INVALID_REPORT_URL',
    );
  }

  if (!/(^|\.)warcraftlogs\.com$/i.test(url.hostname)) {
    throw new AppError(
      'Only warcraftlogs.com report links are supported.',
      400,
      'INVALID_REPORT_HOST',
    );
  }

  const match = url.pathname.match(/\/reports\/([A-Za-z0-9]+)/i);
  if (!match) {
    throw new AppError(
      'The link does not contain a Warcraft Logs report code.',
      400,
      'MISSING_REPORT_CODE',
    );
  }

  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  const fightValue = params.get('fight') ?? url.searchParams.get('fight');
  const sourceValue = params.get('source') ?? url.searchParams.get('source');
  const fight = fightValue === 'last' ? 'last' : positiveInteger(fightValue);
  const sourceId = positiveInteger(sourceValue);

  return { reportCode: match[1], fight, sourceId };
}

function positiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isDpsSpec(specName: string): boolean {
  return DPS_SPECS.has(specName);
}
