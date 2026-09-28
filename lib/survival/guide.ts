import { castDecisionTime } from '../cast-sequence';
import type { AnalysisResult } from '../domain';
import { auraStacksBefore, closedGuideAuraWindows } from '../guides/aura';
import type {
  GuideCheck,
  GuideLesson,
  GuideMoment,
  GuidedSpecPack,
} from '../guides/types';
import { SURVIVAL, SURVIVAL_GUIDE } from './catalog';

function buildSurvivalChecks(result: AnalysisResult) {
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === SURVIVAL_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === SURVIVAL_GUIDE.partitionId;
  const castCoverage = evidence?.castsComplete === true;
  const stateCoverage =
    evidence?.guide?.specName === 'Survival' && evidence.guide.complete;
  const baseBlock = !seasonMatches
    ? 'This Survival ruleset is reviewed for the 12.1 Season 2 partition only.'
    : !castCoverage
      ? 'Complete cast events are required.'
      : !evidence?.pulls.length
        ? 'Pull boundaries are required.'
        : null;
  const stateBlock =
    baseBlock ??
    (!stateCoverage ? 'Complete Survival self-buff events are required.' : null);
  const tipObserved =
    evidence?.guide?.auras.some(
      (event) => event.id === SURVIVAL.tipOfTheSpear,
    ) ?? false;
  const tipBlock =
    stateBlock ??
    (!tipObserved
      ? 'No Tip of the Spear state was recorded, so Tip-dependent casts cannot be assessed.'
      : null);
  const casts = (evidence?.casts ?? []).filter((cast) =>
    evidence?.pulls.some(
      (pull) =>
        castDecisionTime(cast) >= pull.start &&
        castDecisionTime(cast) < pull.end,
    ),
  );
  const checks: GuideCheck[] = [];
  function add(
    id: string,
    title: string,
    block: string | null,
    eligible: number,
    moments: GuideMoment[],
    detail: string,
    empty: GuideCheck['status'] = 'unavailable',
  ) {
    checks.push({
      id,
      title,
      status: block
        ? 'unavailable'
        : !eligible
          ? empty
          : moments.length
            ? 'review'
            : 'observed',
      detail: block ?? detail,
      eligible: block ? 0 : eligible,
      moments: block ? [] : moments,
    });
  }
  function tipCoverage(id: number, title: string) {
    const relevant = casts.filter((cast) => cast.id === id);
    add(
      'tip-' + id,
      title,
      tipBlock,
      relevant.length,
      relevant.flatMap((cast): GuideMoment[] => {
        const time = castDecisionTime(cast);
        const stacks = auraStacksBefore(
          result,
          'Survival',
          SURVIVAL.tipOfTheSpear,
          time,
        );
        return stacks > 0
          ? []
          : [
              {
                time,
                spellId: id,
                detail:
                  cast.name +
                  ' had no recorded Tip of the Spear stack immediately before the cast. Confirm same-timestamp aura ordering and whether the cast record is manual.',
              },
            ];
      }),
      'The current guide expects this damaging ability to consume Tip of the Spear. State is sampled immediately before each manual cast.',
    );
  }

  tipCoverage(SURVIVAL.raptorSwipe, 'Raptor Swipe had Tip of the Spear');
  tipCoverage(SURVIVAL.boomstick, 'Boomstick began with Tip of the Spear');

  const takedowns = casts.map((cast) => ({
    cast,
    stacks:
      cast.id === SURVIVAL.takedown
        ? auraStacksBefore(
            result,
            'Survival',
            SURVIVAL.tipOfTheSpear,
            castDecisionTime(cast),
          )
        : -1,
  })).filter((item) => item.stacks >= 0);
  add(
    'takedown-tip',
    'Takedown preparation by Tip stacks',
    tipBlock,
    takedowns.length,
    [],
    'Shows 2+, 1, and 0-stack Takedown entries without treating sub-two as automatic failure; the guide includes a zero-stack fallback and Twin Fangs changes the follow-up.',
    'not-applicable',
  );

  const moonlightWindows = closedGuideAuraWindows(
    result,
    'Survival',
    SURVIVAL.moonlightOverride,
  );
  add(
    'moonlight-conversion',
    'Moonlight Chakram override converted',
    stateBlock,
    moonlightWindows.length,
    moonlightWindows.flatMap((window): GuideMoment[] =>
      casts.some(
        (cast) =>
          cast.id === SURVIVAL.moonlightChakram &&
          castDecisionTime(cast) >= window.start &&
          castDecisionTime(cast) <= window.end + 0.2,
      )
        ? []
        : [
            {
              time: window.end,
              spellId: SURVIVAL.moonlightChakram,
              detail:
                'This complete Moonlight Chakram override ended without a recorded cast. Confirm target access and same-timestamp consumption.',
            },
          ],
    ),
    'Pairs each complete Sentinel override window with Moonlight Chakram. Open windows, deaths and pull endings are excluded.',
    'not-applicable',
  );

  const packWindows = [SURVIVAL.howl, SURVIVAL.leadFromTheFront]
    .flatMap((id) => closedGuideAuraWindows(result, 'Survival', id))
    .filter(
      (window, index, all) =>
        all.findIndex(
          (other) => Math.abs(other.start - window.start) < 0.05,
        ) === index,
    );
  add(
    'pack-leader-conversion',
    'Pack Leader window converted with Kill Command',
    stateBlock,
    packWindows.length,
    packWindows.flatMap((window): GuideMoment[] =>
      casts.some(
        (cast) =>
          cast.id === SURVIVAL.killCommand &&
          castDecisionTime(cast) >= window.start &&
          castDecisionTime(cast) <= window.end + 0.2,
      )
        ? []
        : [
            {
              time: window.end,
              spellId: SURVIVAL.killCommand,
              detail:
                'This complete Howl or Lead From the Front window ended without a recorded Kill Command. Confirm pet/target access and whether the aura was consumed at the same timestamp.',
            },
          ],
    ),
    'Pairs complete observed Pack Leader windows with Kill Command; it does not infer which hero tree should have been selected.',
    'not-applicable',
  );

  const atLeastTwo = takedowns.filter((item) => item.stacks >= 2).length;
  const one = takedowns.filter((item) => item.stacks === 1).length;
  const zero = takedowns.filter((item) => item.stacks === 0).length;
  const tippedSwipe = checks.find((item) => item.id === 'tip-1262343');
  const tippedBoomstick = checks.find((item) => item.id === 'tip-1261193');
  return {
    checks,
    seasonMatches,
    castCoverage,
    stateCoverage,
    summaries: [
      {
        label: 'Raptor Swipe',
        value: tippedSwipe?.eligible
          ? tippedSwipe.eligible - tippedSwipe.moments.length +
            ' / ' +
            tippedSwipe.eligible
          : '-',
        note: 'casts with recorded Tip',
      },
      {
        label: 'Boomstick',
        value: tippedBoomstick?.eligible
          ? tippedBoomstick.eligible - tippedBoomstick.moments.length +
            ' / ' +
            tippedBoomstick.eligible
          : '-',
        note: 'channels started with Tip',
      },
      {
        label: 'Takedown prep',
        value: atLeastTwo + ' / ' + one + ' / ' + zero,
        note: '2+ / 1 / 0 Tip stacks',
      },
      {
        label: 'Hero windows',
        value: String(moonlightWindows.length + packWindows.length),
        note: 'complete windows assessed',
      },
    ],
  };
}

const LESSONS: Record<string, Omit<GuideLesson, 'id' | 'check'>> = {
  'tip-1262343': {
    title: 'Tip every Raptor Swipe',
    short: 'Raptor Swipe Tip coverage',
    why: 'The current guide explicitly requires Raptor Swipe to consume Tip of the Spear.',
    tryNext: 'Before Raptor Swipe becomes available, reserve a Kill Command-generated Tip stack for it.',
    verify: 'Confirm same-timestamp aura ordering, target access, and that this was the manual Raptor Swipe cast.',
    spellId: SURVIVAL.raptorSwipe,
    sequence: [SURVIVAL.killCommand, SURVIVAL.raptorSwipe],
  },
  'tip-1261193': {
    title: 'Begin Boomstick with Tip active',
    short: 'Boomstick Tip coverage',
    why: 'Boomstick is a damaging ability and the current guide does not exempt it from Tip of the Spear preparation.',
    tryNext: 'Plan a Kill Command before Boomstick so the channel starts with a recorded Tip stack.',
    verify: 'Confirm same-timestamp aura ordering, mechanics, target count, and that the log entry is the manual cast rather than its triggered shot.',
    spellId: SURVIVAL.boomstick,
    sequence: [SURVIVAL.killCommand, SURVIVAL.boomstick],
  },
  'moonlight-conversion': {
    title: 'Use the Moonlight Chakram override',
    short: 'Sentinel conversion',
    why: 'The observed override is a concrete, finite opportunity to cast Moonlight Chakram.',
    tryNext: 'Track the override near your priority buttons and identify a valid target before it expires.',
    verify: 'Confirm target access, pull timing, and same-timestamp aura consumption.',
    spellId: SURVIVAL.moonlightChakram,
    sequence: [SURVIVAL.moonlightOverride, SURVIVAL.moonlightChakram],
  },
  'pack-leader-conversion': {
    title: 'Convert the Pack Leader window',
    short: 'Pack Leader conversion',
    why: 'Howl and Lead From the Front create a recorded window whose follow-up is Kill Command.',
    tryNext: 'After Takedown, keep Kill Command visible and confirm your pet can reach a target before the hero window ends.',
    verify: 'Confirm pet/target access, mechanics, and whether both auras represent the same hero activation.',
    spellId: SURVIVAL.killCommand,
    sequence: [SURVIVAL.takedown, SURVIVAL.killCommand],
  },
};

export function buildSurvivalReview(result: AnalysisResult) {
  const review = buildSurvivalChecks(result);
  const lessons = review.checks
    .filter((check) => check.status === 'review' && LESSONS[check.id])
    .map((check) => ({ ...LESSONS[check.id], id: check.id, check }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return { ...review, lessons };
}

export const survivalGuidePack: GuidedSpecPack = {
  className: 'Hunter',
  specName: 'Survival',
  slug: 'survival-hunter',
  source: SURVIVAL_GUIDE,
  limitation:
    'Focus, ability charges, enemy count, target debuffs, pet damage and uptime, positioning, cooldown readiness, full talent loadout, immunity and forced downtime are not reconstructed. Bomb/Kill Command cadence and target-choice advice therefore remain descriptive.',
  notes: [
    'Raptor Swipe and Boomstick are checked against Tip state immediately before their manual cast IDs; triggered damage records are not counted as extra casts.',
    'Takedown preparation is shown as a 2+ / 1 / 0 stack distribution because the guide includes a zero-stack fallback and Twin Fangs changes the follow-up.',
    'Sentinel and Pack Leader advice activates only when the corresponding override or hero aura is positively observed.',
    'The tool does not infer that one hero tree should have been selected over the other.',
  ],
  review: buildSurvivalReview,
};
