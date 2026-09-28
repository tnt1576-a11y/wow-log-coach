import type { AnalysisResult, RunEvidence } from '../domain';
import { castDecisionTime } from '../cast-sequence';
import { finite, record, rows } from '../evidence';
import { closedGuideAuraWindows } from './aura';
import type {
  GuideCheck,
  GuideLesson,
  GuideSummary,
  GuidedSpecPack,
} from './types';

type AuraEvent = NonNullable<RunEvidence['guide']>['auras'][number];
export type ProcRule = {
  id: string;
  name: string;
  aura: number;
  consumers: number[];
  consumerLabel: string;
  why: string;
  tryNext: string;
  verify: string;
  /** Context-dependent priorities may be explored without generating a lesson. */
  descriptiveOnly?: boolean;
};
export type ProcGuideDefinition = Omit<GuidedSpecPack, 'review'> & {
  key: string;
  rankingZoneId: number;
  partitionId: number;
  rules: ProcRule[];
  extraAuras?: number[];
};

export function createProcGuide(definition: ProcGuideDefinition) {
  const tracked = new Set([
    ...definition.rules.map((rule) => rule.aura),
    ...(definition.extraAuras ?? []),
  ]);
  function parseAuras(
    data: unknown,
    sourceId: number,
    start: number,
    end: number,
  ): AuraEvent[] {
    const types = new Set([
      'applybuff',
      'applybuffstack',
      'refreshbuff',
      'removebuff',
      'removebuffstack',
    ]);
    return rows(data)
      .flatMap((event): AuraEvent[] => {
        const id = finite(event.abilityGameID),
          time = finite(event.timestamp);
        if (
          event.sourceID !== sourceId ||
          event.targetID !== sourceId ||
          id === null ||
          !tracked.has(id) ||
          time === null ||
          time < start ||
          time > end ||
          !types.has(String(event.type))
        )
          return [];
        const stacks = finite(event.stack);
        return [
          {
            id,
            time: (time - start) / 1000,
            type: String(event.type) as AuraEvent['type'],
            stacks: stacks !== null && stacks >= 0 ? stacks : null,
          },
        ];
      })
      .sort((a, b) => a.time - b.time);
  }
  function review(result: AnalysisResult) {
    const evidence = result.evidence;
    const seasonMatches =
      result.target.rankingZoneId === definition.rankingZoneId &&
      result.cohort.partition?.id === definition.partitionId;
    const castCoverage = evidence?.castsComplete === true;
    const stateCoverage =
      evidence?.guide?.specName === definition.specName &&
      evidence.guide.complete;
    const block =
      result.target.className !== definition.className ||
      result.target.specName !== definition.specName
        ? 'This guide belongs to a different specialization.'
        : !seasonMatches
          ? 'This guide is reviewed for the 12.1 Season 2 partition.'
          : !castCoverage
            ? 'Complete player cast events are required.'
            : !stateCoverage
              ? 'Complete tracked self-buff events are required.'
              : !evidence?.pulls.length
                ? 'Pull boundaries are required.'
                : null;
    const checks: GuideCheck[] = [],
      lessons: GuideLesson[] = [],
      summaries: GuideSummary[] = [];
    for (const rule of definition.rules) {
      const windows = closedGuideAuraWindows(
        result,
        definition.specName,
        rule.aura,
      ).filter(
        (window) =>
          evidence?.guide?.auras.some(
            (event) =>
              event.id === rule.aura &&
              event.time === window.start &&
              event.type === 'applybuff',
          ) &&
          !evidence.deaths.some(
            (death) => death.time >= window.start && death.time <= window.end,
          ),
      );
      const rawOutcomes = windows.map((window) => {
        const consumer = evidence?.casts
          .filter(
            (cast) =>
              rule.consumers.includes(cast.id) &&
              castDecisionTime(cast) >= window.start &&
              castDecisionTime(cast) <= window.end,
          )
          .sort((a, b) => castDecisionTime(a) - castDecisionTime(b))[0];
        return {
          window,
          consumer,
          ambiguous:
            !consumer &&
            evidence?.casts.some(
              (cast) =>
                rule.consumers.includes(cast.id) &&
                castDecisionTime(cast) > window.end &&
                castDecisionTime(cast) <= window.end + 0.2,
            ),
          delay: consumer
            ? Math.max(0, castDecisionTime(consumer) - window.start)
            : null,
        };
      });
      const outcomes = rawOutcomes.filter((item) => !item.ambiguous);
      const excluded = rawOutcomes.length - outcomes.length;
      const moments = outcomes
        .filter((item) => !item.consumer)
        .map(({ window }) => ({
          time: window.end,
          spellId: rule.consumers[0],
          detail:
            'A complete ' +
            rule.name +
            ' window ended without a recorded ' +
            rule.consumerLabel +
            '. ' +
            rule.verify,
        }));
      const check: GuideCheck = {
        id: rule.id,
        title: rule.name + ' follow-through',
        status: block
          ? 'unavailable'
          : !outcomes.length
            ? excluded
              ? 'unavailable'
              : 'not-applicable'
            : moments.length && !rule.descriptiveOnly
              ? 'review'
              : 'observed',
        detail:
          block ??
          'Measures complete observed windows containing at least one ' +
            rule.consumerLabel +
            '. ' +
            (excluded
              ? excluded +
                ' windows excluded: a matching cast arrived within 0.2s after buff removal, so event ordering is ambiguous. '
              : '') +
            'This does not prove every charge was used or that an unused window was avoidable. ' +
            rule.verify,
        eligible: block ? 0 : outcomes.length,
        moments: block || rule.descriptiveOnly ? [] : moments,
        procWindows: block
          ? []
          : outcomes.map(({ window, consumer }) => ({
              ...window,
              consumer: consumer ?? null,
            })),
      };
      checks.push(check);
      if (check.status === 'review')
        lessons.push({
          id: rule.id,
          title: 'Review ' + rule.name + ' follow-through',
          short: rule.name + ' usage',
          why: rule.why,
          tryNext: rule.tryNext,
          verify: rule.verify,
          spellId: rule.consumers[0],
          sequence: [rule.aura, rule.consumers[0]],
          spellLabels: {
            [rule.aura]: rule.name,
            [rule.consumers[0]]: rule.consumerLabel,
          },
          check,
        });
      const delays = outcomes
        .flatMap((item) => (item.delay === null ? [] : [item.delay]))
        .sort((a, b) => a - b);
      const median = delays.length
        ? (delays[Math.floor((delays.length - 1) / 2)] +
            delays[Math.floor(delays.length / 2)]) /
          2
        : null;
      summaries.push(
        {
          label: rule.name,
          value:
            block || (!outcomes.length && excluded > 0)
              ? '-'
              : outcomes.length - moments.length + ' / ' + outcomes.length,
          note: 'windows with a recorded follow-up',
        },
        {
          label: rule.name + ' response',
          value: block || median === null ? '-' : median.toFixed(1) + 's',
          note: 'median first cast; timing context',
        },
      );
    }
    return {
      checks,
      lessons: lessons.sort(
        (a, b) => b.check.moments.length - a.check.moments.length,
      ),
      summaries,
      seasonMatches,
      castCoverage,
      stateCoverage,
    };
  }
  return {
    pack: { ...definition, review } satisfies GuidedSpecPack,
    state: {
      key: definition.key,
      label: definition.specName,
      parseAuras,
      pageComplete(value: unknown) {
        const page = record(value);
        return (
          Array.isArray(page.data) &&
          (page.nextPageTimestamp === null ||
            page.nextPageTimestamp === undefined)
        );
      },
    },
  };
}
