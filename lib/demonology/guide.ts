import { castDecisionTime } from '../cast-sequence';
import type { AnalysisResult } from '../domain';
import { auraIndex } from '../arcane/state';
import type {
  GuideCheck,
  GuideLesson,
  GuideMoment,
  GuidedSpecPack,
} from '../guides/types';
import { DEMONOLOGY, DEMONOLOGY_GUIDE } from './catalog';

function buildDemonologyChecks(result: AnalysisResult) {
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === DEMONOLOGY_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === DEMONOLOGY_GUIDE.partitionId;
  const castCoverage = evidence?.castsComplete === true;
  const stateCoverage =
    evidence?.guide?.specName === 'Demonology' && evidence.guide.complete;
  const baseBlock =
    result.target.className !== 'Warlock' ||
    result.target.specName !== 'Demonology'
      ? 'This guide belongs to Demonology Warlocks.'
      : !seasonMatches
        ? 'This Demonology ruleset is reviewed for the 12.1 Season 2 partition only.'
        : !castCoverage
          ? 'Complete cast events are required.'
          : !evidence?.pulls.length
            ? 'Pull boundaries are required.'
            : null;
  const stateBlock =
    baseBlock ??
    (!stateCoverage
      ? 'Complete Demonology self-buff events are required.'
      : null);
  const coreObserved =
    evidence?.guide?.auras.some(
      (event) => event.id === DEMONOLOGY.demonicCore,
    ) ?? false;
  const coreBlock =
    stateBlock ??
    (!coreObserved
      ? 'No Demonic Core state was recorded, so stack-dependent checks are unavailable.'
      : null);
  const casts = (evidence?.casts ?? []).filter((cast) =>
    evidence?.pulls.some(
      (pull) =>
        castDecisionTime(cast) >= pull.start &&
        castDecisionTime(cast) < pull.end,
    ),
  );
  const coreState = auraIndex(
    evidence?.guide?.specName === 'Demonology' ? evidence.guide.auras : [],
  );
  const stacksBefore = (time: number) => {
    const value = coreState.before(DEMONOLOGY.demonicCore, time).stacks;
    return value !== null && Number.isInteger(value) && value >= 0 && value <= 4
      ? value
      : null;
  };
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

  const tyrantWindows = casts.flatMap((cast) => {
    if (cast.id !== DEMONOLOGY.tyrant) return [];
    const start = cast.time;
    const decisionTime = castDecisionTime(cast);
    const pull = evidence?.pulls.find(
      (item) => start >= item.start && start < item.end,
    );
    const end = start + 20;
    if (
      !pull ||
      end > pull.end - 0.5 ||
      evidence?.deaths.some((death) => death.time >= start && death.time <= end)
    )
      return [];
    const hands = casts.filter(
      (entry) =>
        entry.id === DEMONOLOGY.handOfGuldan &&
        castDecisionTime(entry) >= start &&
        castDecisionTime(entry) <= end,
    ).length;
    return [{ start, end, hands, decisionTime }];
  });
  add(
    'tyrant-hands',
    "Hand of Gul'dan during Tyrant",
    baseBlock,
    tyrantWindows.length,
    tyrantWindows.flatMap((window): GuideMoment[] =>
      window.hands > 0
        ? []
        : [
            {
              time: window.decisionTime,
              spellId: DEMONOLOGY.tyrant,
              detail:
                "No Hand of Gul'dan was recorded in this complete 20-second post-Tyrant window. Inspect Soul Shards, Core stacks, target access, and the planned pull transition.",
            },
          ],
    ),
    'App heuristic: compare Hand activity in complete 20-second post-Tyrant slices, not measured buff durations. Method also requires build-dependent demon setup; shards and active demons are not reconstructed.',
    'not-applicable',
  );
  checks[checks.length - 1].decisions = baseBlock
    ? []
    : tyrantWindows.map((window) => ({
        time: window.decisionTime,
        spellId: DEMONOLOGY.tyrant,
        detail:
          window.hands +
          " Hand of Gul'dan casts were recorded in this complete 20-second Tyrant window. Compare setup and follow-through; Soul Shards, demon counts and target access are not reconstructed.",
      }));

  const siphons = casts
    .filter((cast) => cast.id === DEMONOLOGY.powerSiphon)
    .map((cast) => ({
      cast,
      stacks: stacksBefore(castDecisionTime(cast)),
    }));
  const knownSiphons = siphons.filter(
    (item): item is typeof item & { stacks: number } => item.stacks !== null,
  );
  add(
    'power-siphon',
    'Power Siphon Core pressure',
    coreBlock,
    knownSiphons.length,
    knownSiphons.flatMap(({ cast, stacks }): GuideMoment[] =>
      stacks <= 2
        ? []
        : [
            {
              time: castDecisionTime(cast),
              spellId: DEMONOLOGY.powerSiphon,
              detail:
                'Power Siphon was recorded at ' +
                stacks +
                ' Demonic Core stacks. Method avoids Siphon at 3+; two can also be too many when Dreadstalkers are expiring. Pet state is unavailable.',
            },
          ],
    ),
    'Checks established Core state for 3+ stacks; two-stack pet-expiry exceptions cannot be assessed. ' +
      (siphons.length - knownSiphons.length) +
      ' casts have unknown stack counts and are excluded. At least two Wild Imps are also required, so a passing stack check is not a complete Power Siphon verdict.',
    siphons.length ? 'unavailable' : 'not-applicable',
  );
  checks[checks.length - 1].decisions = coreBlock
    ? []
    : knownSiphons.map(({ cast, stacks }) => ({
        time: castDecisionTime(cast),
        spellId: DEMONOLOGY.powerSiphon,
        detail:
          'Power Siphon with ' +
          stacks +
          ' recorded Demonic Core stacks. Pet expiry can make even two stacks unsuitable; Wild Imp count and competing priorities still need review.',
      }));

  const demonbolts = casts
    .filter((cast) => cast.id === DEMONOLOGY.demonbolt)
    .map((cast) => ({
      cast,
      stacks: stacksBefore(castDecisionTime(cast)),
    }));
  const knownDemonbolts = demonbolts.filter(
    (item): item is typeof item & { stacks: number } => item.stacks !== null,
  );
  add(
    'demonbolt-core',
    'Demonbolt with Demonic Core',
    coreBlock,
    knownDemonbolts.length,
    [],
    'Descriptive distribution of Demonbolt casts with established Core counts; unknown counts are excluded. Pre-casts and deliberate hardcasts are not automatically failures.',
    demonbolts.length ? 'unavailable' : 'not-applicable',
  );

  const coreEvents = (
    evidence?.guide?.specName === 'Demonology' ? evidence.guide.auras : []
  )
    .filter((event) => event.id === DEMONOLOGY.demonicCore)
    .sort((a, b) => a.time - b.time);
  let priorStacks: number | null = null;
  let explicitTransitions = 0;
  const capPressure: GuideMoment[] = [];
  for (const event of coreEvents) {
    if (event.type === 'removebuff') {
      priorStacks = 0;
      continue;
    }
    if (
      event.stacks === null ||
      !Number.isInteger(event.stacks) ||
      event.stacks < 0 ||
      event.stacks > 4
    ) {
      priorStacks = null;
      continue;
    }
    if (
      event.type === 'applybuff' ||
      event.type === 'applybuffstack' ||
      event.type === 'refreshbuff'
    ) {
      if (priorStacks !== null) {
        explicitTransitions++;
        if (priorStacks >= 4 && event.stacks >= 4)
          capPressure.push({
            time: event.time,
            spellId: DEMONOLOGY.demonbolt,
            detail:
              'A new recorded Demonic Core application arrived while the prior explicit state was already at four stacks. Review whether a Demonbolt could have made room.',
          });
      }
      priorStacks = event.stacks;
    } else priorStacks = event.stacks;
  }
  add(
    'core-cap',
    'Demonic Core four-stack pressure',
    coreBlock,
    explicitTransitions,
    capPressure,
    'Requires explicit stack transitions. Soul Shards, Doom timing, movement, and priority actions can justify holding; this is a review cue, not an instant-spend rule.',
    'not-applicable',
  );

  const tyrantCore = casts
    .filter((cast) => cast.id === DEMONOLOGY.tyrant)
    .map((cast) => stacksBefore(castDecisionTime(cast)));
  const knownTyrantCore = tyrantCore.filter(
    (value): value is number => value !== null,
  );
  add(
    'tyrant-core',
    'Demonic Core entering Tyrant',
    coreBlock,
    knownTyrantCore.length,
    [],
    'Descriptive entry-state distribution. Hero talents and Reign of Tyranny change setup. Soul Shards and active demons are required for a full judgment.',
    tyrantCore.length ? 'unavailable' : 'not-applicable',
  );

  const averageHands = tyrantWindows.length
    ? tyrantWindows.reduce((sum, item) => sum + item.hands, 0) /
      tyrantWindows.length
    : null;
  const coreDemonbolts = knownDemonbolts.filter(
    (item) => item.stacks > 0,
  ).length;
  const averageTyrantCore = knownTyrantCore.length
    ? knownTyrantCore.reduce((sum, value) => sum + value, 0) /
      knownTyrantCore.length
    : null;
  return {
    checks,
    seasonMatches,
    castCoverage,
    stateCoverage,
    summaries: [
      {
        label: 'Tyrant windows',
        value: baseBlock ? '-' : String(tyrantWindows.length),
        note: 'complete 20s windows',
      },
      {
        label: "Hand of Gul'dan",
        value:
          baseBlock || averageHands === null ? '-' : averageHands.toFixed(1),
        note: 'average casts per Tyrant',
      },
      {
        label: 'Demonbolt',
        value:
          coreBlock || !knownDemonbolts.length
            ? '-'
            : coreDemonbolts + ' / ' + knownDemonbolts.length,
        note:
          'casts with Core / known state; ' +
          (demonbolts.length - knownDemonbolts.length) +
          ' unknown excluded',
      },
      {
        label: 'Tyrant entry Core',
        value:
          coreBlock || averageTyrantCore === null
            ? '-'
            : averageTyrantCore.toFixed(1),
        note:
          'average observed stacks; ' +
          (tyrantCore.length - knownTyrantCore.length) +
          ' unknown excluded',
      },
    ],
  };
}

const LESSONS: Record<string, Omit<GuideLesson, 'id' | 'check'>> = {
  'tyrant-hands': {
    title: "Build Hands of Gul'dan during Tyrant",
    short: "Tyrant Hand of Gul'dan",
    why: 'A quiet post-Tyrant slice is worth inspecting, but the setup must also match hero talents and Reign of Tyranny.',
    tryNext:
      'Compare setup and shard spending with a matching hero build. The displayed 20-second slice is an app comparison window, not a required buff duration.',
    verify:
      'Confirm Soul Shards, active demons, target access, pull ending, and whether the Tyrant window was intentionally delayed.',
    spellId: DEMONOLOGY.handOfGuldan,
    sequence: [
      DEMONOLOGY.tyrant,
      DEMONOLOGY.demonbolt,
      DEMONOLOGY.handOfGuldan,
    ],
  },
  'power-siphon': {
    title: 'Use Power Siphon before Core stacks are high',
    short: 'Power Siphon Core state',
    why: 'The current priority uses Power Siphon at two or fewer Demonic Core stacks to avoid crowding the proc resource.',
    tryNext:
      'Check Core, imps and Dreadstalker expiry before Siphon; three or more Core is a review cue, and two is not automatically safe.',
    verify:
      'The log does not reconstruct Wild Imp count, Soul Shards, or whether a priority window forced the cast.',
    spellId: DEMONOLOGY.powerSiphon,
    sequence: [
      DEMONOLOGY.handOfGuldan,
      DEMONOLOGY.powerSiphon,
      DEMONOLOGY.demonbolt,
    ],
  },
  'core-cap': {
    title: 'Review Demonic Core at four stacks',
    short: 'Demonic Core cap pressure',
    why: 'A new application while the explicit state remains at four stacks can indicate lost room for another proc.',
    tryNext:
      'At four Core stacks, look for the next deliberate Demonbolt before another demon can generate a proc.',
    verify:
      'Confirm stack-event ordering, Soul Shards, Doom timing, movement, and whether the application truly overwrote a stack.',
    spellId: DEMONOLOGY.demonbolt,
    sequence: [DEMONOLOGY.demonbolt, DEMONOLOGY.handOfGuldan],
  },
};

export function buildDemonologyReview(result: AnalysisResult) {
  const review = buildDemonologyChecks(result);
  const lessons = review.checks
    .filter((check) => check.status === 'review' && LESSONS[check.id])
    .map((check) => ({ ...LESSONS[check.id], id: check.id, check }))
    .sort((a, b) => b.check.moments.length - a.check.moments.length);
  return { ...review, lessons };
}

export const demonologyGuidePack: GuidedSpecPack = {
  className: 'Warlock',
  specName: 'Demonology',
  slug: 'demonology-warlock',
  source: DEMONOLOGY_GUIDE,
  limitation:
    'Soul Shards, Wild Imp and other demon counts, Doom target state, target count/lifetime, cooldown readiness, full talent/hero loadout, immunity, and forced downtime are not reconstructed. The coach reports recorded Core and Tyrant-window facts without inventing summon or resource opportunities.',
  notes: [
    'Method distinguishes demon-extension setup from Soul Harvester Core generation. The app’s 20-second post-Tyrant slice is descriptive, not a universal setup rule.',
    'Power Siphon checks only the observable two-or-fewer Core threshold; at least two Wild Imps are also required and remain a verification item.',
    'Demonbolt/Core and Tyrant-entry Core are descriptive distributions. Pre-casts and intentional hardcasts are not automatic failures.',
    'Season 2 tier bonuses are passive and do not create a separate rotation verdict.',
  ],
  review: buildDemonologyReview,
};
