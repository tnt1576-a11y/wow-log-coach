import type { AnalysisResult } from '../domain';
import { castDecisionTime } from '../cast-sequence';
import { auraIndex } from '../arcane/state';
import type { GuideCheck, GuidedSpecReview } from './types';

const OPPORTUNITY = 195627,
  SINISTER = 193315,
  PISTOL = 185763;
const VERIFY =
  'Check Energy, Combo Points, target access and higher-priority finishers. This is a priority review, not proof that a proc, Combo Points or damage were lost.';

export function addOutlawPriority(
  result: AnalysisResult,
  base: GuidedSpecReview,
): GuidedSpecReview {
  const evidence = result.evidence,
    proc = base.checks.find((check) => check.id === 'opportunity');
  const blocked = !proc || proc.status === 'unavailable';
  const auras =
    evidence?.guide?.auras.filter((event) => event.id === OPPORTUNITY) ?? [];
  const state = auraIndex(auras);
  const decisions = blocked
    ? []
    : (evidence?.casts ?? []).flatMap((cast) => {
        if (cast.id !== SINISTER && cast.id !== PISTOL) return [];
        const time = castDecisionTime(cast);
        if (
          !proc.procWindows?.some(
            (window) =>
              time > window.start + 0.2 &&
              (cast.id === PISTOL
                ? time <= window.end + 0.2
                : time < window.end),
          )
        )
          return [];
        // Establish six stacks before the action; never count the cast that creates stack six.
        const before = state.before(OPPORTUNITY, time - 0.15);
        if (!before.active || before.stacks !== 6) return [];
        if (
          auras.some((event) => event.time >= time - 0.15 && event.time < time)
        )
          return [];
        // A simultaneous removal may be Pistol Shot's own consumption. Other changes are ambiguous.
        if (
          auras.some(
            (event) =>
              Math.abs(event.time - time) < 0.001 &&
              !(
                cast.id === PISTOL &&
                ['removebuff', 'removebuffstack'].includes(event.type)
              ),
          )
        )
          return [];
        return [
          {
            time,
            spellId: cast.id,
            detail:
              cast.id === SINISTER
                ? 'Six Opportunity stacks were recorded before this Sinister Strike. The guide normally places Pistol Shot ahead of Sinister Strike here. ' +
                  VERIFY
                : "Six Opportunity stacks were recorded before this Pistol Shot. This matches the guide's builder priority; finisher priority and effective Combo Points are not evaluated.",
          },
        ];
      });
  const moments = decisions.filter((decision) => decision.spellId === SINISTER);
  const check: GuideCheck = {
    id: 'opportunity-builder-priority',
    title: 'Builder choice at six Opportunity stacks',
    status: blocked
      ? 'unavailable'
      : !decisions.length
        ? 'not-applicable'
        : moments.length
          ? 'review'
          : 'observed',
    detail: blocked
      ? (proc?.detail ?? 'Complete Outlaw proc evidence is required.')
      : 'Compares Sinister Strike and Pistol Shot choices with six stacks already recorded in a complete buff window. Finishers and other abilities are not graded. ' +
        VERIFY,
    eligible: decisions.length,
    moments,
    decisions,
  };
  return {
    ...base,
    checks: [...base.checks, check],
    summaries: [
      ...base.summaries,
      {
        label: 'Builders at six stacks',
        value: blocked ? '-' : moments.length + ' / ' + decisions.length,
        note: 'Sinister Strike / assessed builder choices; review suggested',
      },
    ],
    lessons: [
      ...(moments.length
        ? [
            {
              id: check.id,
              title: 'Spend Opportunity before another Sinister Strike',
              short: 'Builder priority',
              spellId: SINISTER,
              sequence: [OPPORTUNITY, PISTOL],
              spellLabels: {
                [OPPORTUNITY]: 'Opportunity · six stacks',
                [PISTOL]: 'Pistol Shot',
                [SINISTER]: 'Sinister Strike',
              },
              why: 'Another Sinister Strike can create Opportunity while you are already holding six stacks. The guide prioritizes Pistol Shot over that builder at six.',
              tryNext:
                'Track Opportunity stacks near Combo Points. When choosing a builder at six stacks, consider Pistol Shot before Sinister Strike; a higher-priority finisher may come first.',
              verify: VERIFY,
              check,
            },
          ]
        : []),
      ...base.lessons,
    ],
  };
}
