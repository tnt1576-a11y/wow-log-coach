import type { AnalysisResult, RunEvidence } from '../domain';
import { castDecisionTime } from '../cast-sequence';
import { closedTargetWindows } from './target-auras';
import type { GuideCheck, GuidedSpecReview } from './types';

const KINGSBANE = 385627,
  ENVENOM = 32645,
  DEATHMARK = 360194;
type Interval = { start: number; end: number };
function envenomState(evidence: RunEvidence) {
  const events = (evidence.guide?.auras ?? [])
    .filter(
      (event) =>
        event.id === ENVENOM &&
        ['applybuff', 'refreshbuff', 'removebuff'].includes(event.type),
    )
    .sort((a, b) => a.time - b.time);
  const intervals: Interval[] = [];
  let start: number | null = null;
  for (const event of events) {
    if (event.type === 'removebuff') {
      if (start !== null) intervals.push({ start, end: event.time });
      start = null;
    } else if (start === null) start = event.time;
  }
  if (start !== null) intervals.push({ start, end: evidence.duration });
  return { knownFrom: events[0]?.time ?? Infinity, intervals };
}
function gapsIn(window: Interval, active: Interval[]) {
  let cursor = window.start;
  const gaps: Interval[] = [];
  for (const interval of active.filter(
    (item) => item.end > window.start && item.start < window.end,
  )) {
    if (interval.start > cursor)
      gaps.push({ start: cursor, end: Math.min(interval.start, window.end) });
    cursor = Math.max(cursor, Math.min(window.end, interval.end));
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
  return gaps;
}
const clock = (time: number) =>
  Math.floor(time / 60) +
  ':' +
  Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
const VERIFY =
  'Review movement, target access, Energy and effective Combo Points before changing the sequence. Missing uptime is not measured damage loss; do not rush low-point Envenoms just to fill a gap.';

export function addAssassinationWindows(
  result: AnalysisResult,
  base: GuidedSpecReview,
): GuidedSpecReview {
  const evidence = result.evidence;
  let block =
    result.target.className !== 'Rogue' ||
    result.target.specName !== 'Assassination' ||
    !base.seasonMatches
      ? 'This check requires an Assassination log in the reviewed 12.1 Season 2 partition.'
      : !evidence?.castsComplete ||
          !evidence.guide?.complete ||
          evidence.guide.specName !== 'Assassination'
        ? 'Complete casts and tracked Envenom self-buff events are required.'
        : !evidence.targetAuras?.complete ||
            evidence.targetAuras.specName !== 'Assassination'
          ? 'Complete target-debuff events are required. Re-analyze this log to load Kingsbane windows.'
          : null;
  const state = evidence
    ? envenomState(evidence)
    : { knownFrom: Infinity, intervals: [] };
  if (!block && !Number.isFinite(state.knownFrom))
    block =
      'No Envenom buff state was established. Missing state cannot be treated as zero uptime.';
  const windows =
    !block && evidence
      ? closedTargetWindows(evidence, KINGSBANE).filter(
          (window) =>
            window.end - window.start >= 13.5 &&
            window.end - window.start <= 14.5 &&
            state.knownFrom <= window.start &&
            evidence.casts.some(
              (cast) =>
                cast.id === KINGSBANE &&
                Math.abs(castDecisionTime(cast) - window.start) <= 0.25 &&
                cast.targetId === window.targetId &&
                (cast.targetInstance ?? null) === window.targetInstance,
            ),
        )
      : [];
  const marks =
    !block && evidence ? closedTargetWindows(evidence, DEATHMARK) : [];
  const outcomes = windows.map((window) => {
    const gaps = gapsIn(window, state.intervals);
    const missing = gaps.reduce((sum, gap) => sum + gap.end - gap.start, 0);
    const overlap =
      window.targetInstance === null
        ? null
        : marks
            .filter(
              (mark) =>
                mark.targetId === window.targetId &&
                mark.targetInstance === window.targetInstance &&
                mark.end > window.start &&
                mark.start < window.end,
            )
            .reduce(
              (sum, mark) =>
                sum +
                Math.max(
                  0,
                  Math.min(mark.end, window.end) -
                    Math.max(mark.start, window.start),
                ),
              0,
            );
    const detail =
      'Kingsbane ' +
      clock(window.start) +
      '–' +
      clock(window.end) +
      ': Envenom was recorded active for ' +
      Math.round((1 - missing / (window.end - window.start)) * 100) +
      '% of this window. ' +
      (gaps.length
        ? 'Gaps: ' +
          gaps
            .map((gap) => clock(gap.start) + '–' + clock(gap.end))
            .join(', ') +
          '. '
        : 'No recorded Envenom gap. ') +
      (overlap === null
        ? 'Same-target Deathmark overlap cannot be verified without target-instance identity. '
        : 'At least ' +
          overlap.toFixed(1) +
          's of same-target Deathmark overlap is verified from complete windows; partial windows may add more. Standalone Kingsbane uses are not automatically wrong. ') +
      VERIFY;
    const cast = evidence!.casts.find(
      (cast) =>
        cast.id === KINGSBANE &&
        Math.abs(castDecisionTime(cast) - window.start) <= 0.25 &&
        cast.targetId === window.targetId &&
        (cast.targetInstance ?? null) === window.targetInstance,
    )!;
    return { window, gaps, missing, detail, time: castDecisionTime(cast) };
  });
  const flagged = outcomes.filter((item) =>
    item.gaps.some((gap) => gap.end - gap.start >= 1),
  );
  const check: GuideCheck = {
    id: 'kingsbane-envenom',
    title: 'Envenom coverage during Kingsbane',
    status: block
      ? 'unavailable'
      : !outcomes.length
        ? 'not-applicable'
        : flagged.length
          ? 'review'
          : 'observed',
    detail:
      block ??
      'Reviews recorded Envenom gaps of at least one second in complete, near-full-duration Kingsbane windows. Short, refreshed, interrupted or unknown-start windows are excluded. ' +
        VERIFY,
    eligible: outcomes.length,
    moments: flagged.map((item) => ({
      time: item.time,
      spellId: KINGSBANE,
      detail: item.detail,
    })),
    decisions: outcomes.map((item) => ({
      time: item.time,
      spellId: KINGSBANE,
      detail: item.detail,
    })),
  };
  const total = outcomes.reduce(
    (sum, item) => sum + item.window.end - item.window.start,
    0,
  );
  const missing = outcomes.reduce((sum, item) => sum + item.missing, 0);
  return {
    ...base,
    checks: [...base.checks, check],
    summaries: [
      ...base.summaries,
      {
        label: 'Envenom during Kingsbane',
        value: total ? Math.round((1 - missing / total) * 100) + '%' : '-',
        note: outcomes.length + ' assessed complete Kingsbane windows',
      },
    ],
    lessons: [
      ...(flagged.length
        ? [
            {
              id: check.id,
              title: 'Keep Envenom active during Kingsbane',
              short: 'Kingsbane setup',
              why: 'Envenom supports the poison applications that build Kingsbane damage. A recorded gap during this window is a focused place to review your setup and finishers.',
              tryNext:
                'Plan Envenom coverage before and during Kingsbane, accounting for Energy, effective Combo Points and upcoming mechanics. Compare an assessed reference window for its setup.',
              verify: VERIFY,
              spellId: KINGSBANE,
              check,
            },
          ]
        : []),
      ...base.lessons,
    ],
  };
}
