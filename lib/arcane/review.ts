import type { AnalysisResult, CastEvent } from '../domain';
import { ARCANE, ARCANE_GUIDE, type BuildOverrides } from './catalog';
import { arcaneBuild } from './build';
import { auraIndex, type AuraState } from './state';
import { castDecisionTime } from '../cast-sequence';

export interface ArcaneMoment {
  time: number;
  spellId: number;
  detail: string;
  salvo?: number;
  clearcasting?: number;
}
export interface ArcaneCheck {
  id: string;
  title: string;
  status: 'review' | 'observed' | 'unavailable' | 'not-applicable';
  detail: string;
  eligible: number;
  moments: ArcaneMoment[];
  decisions?: ArcaneMoment[];
}

export function buildArcaneReview(
  result: AnalysisResult,
  overrides: BuildOverrides = {},
) {
  const build = arcaneBuild(result.targetMetrics, result.evidence, overrides);
  const evidence = result.evidence;
  const seasonMatches =
    result.target.rankingZoneId === ARCANE_GUIDE.rankingZoneId &&
    result.cohort.partition?.id === ARCANE_GUIDE.partitionId;
  const castCoverage = Boolean(evidence?.castsComplete);
  const buffCoverage = Boolean(evidence?.arcane?.complete);
  const casts = (evidence?.casts ?? []).filter((cast) =>
    evidence?.pulls.some(
      (pull) => cast.time >= pull.start && cast.time < pull.end,
    ),
  );
  const states = auraIndex(evidence?.arcane?.auras ?? []);
  const at = (cast: CastEvent, id: number): AuraState =>
    states.before(id, cast.beganAt ?? cast.time);
  const matching = (id: number) => casts.filter((cast) => cast.id === id);
  const checks: ArcaneCheck[] = [];
  const baseBlock = !seasonMatches
    ? 'This ruleset is reviewed for the 12.1 Season 2 partition only. Re-run the analysis if season metadata is missing.'
    : !castCoverage
      ? 'Complete cast events are required.'
      : !evidence?.pulls.length
        ? 'Pull boundaries are needed to exclude out-of-combat casts.'
        : null;
  const stateBlock =
    baseBlock ??
    (!buffCoverage
      ? 'Complete buff events are required; absent state is not treated as zero.'
      : null);
  function add(
    id: string,
    title: string,
    block: string | null,
    eligible: number,
    moments: ArcaneMoment[],
    detail: string,
    notApplicable = false,
  ) {
    checks.push({
      id,
      title,
      status: notApplicable
        ? 'not-applicable'
        : block || !eligible
          ? 'unavailable'
          : moments.length
            ? 'review'
            : 'observed',
      detail:
        block ??
        (!eligible && !notApplicable
          ? 'No eligible casts with the required state were recorded. ' + detail
          : detail),
      eligible: block ? 0 : eligible,
      moments: block ? [] : moments,
    });
  }

  const byTime = (a: CastEvent, b: CastEvent) => a.time - b.time;
  const surges = matching(ARCANE.surge).sort(byTime);
  const touches = matching(ARCANE.touch).sort(byTime);
  const barrages = matching(ARCANE.barrage).sort(byTime);
  const burstSetups = surges.map((surge) => {
    const pull = evidence?.pulls.find(
      (entry) => surge.time >= entry.start && surge.time < entry.end,
    );
    const death = evidence?.deaths
      .filter((d) => d.time >= surge.time && d.time < (pull?.end ?? 0))
      .sort((a, b) => a.time - b.time)[0];
    const observedEnd = Math.min(
      pull?.end ?? surge.time,
      evidence?.duration ?? surge.time,
      death?.time ?? Infinity,
    );
    const touch = touches.find(
      (cast) =>
        cast.time >= surge.time &&
        cast.time <= surge.time + 20 &&
        cast.time < observedEnd,
    );
    return {
      time: surge.time,
      startedAt: surge.beganAt ?? surge.time,
      delay: touch ? touch.time - surge.time : null,
      pullRemaining: (pull?.end ?? surge.time) - surge.time,
      pullEnd: observedEnd,
      observedSeconds: Math.max(0, observedEnd - surge.time),
      endedByDeath: Boolean(death && observedEnd === death.time),
    };
  });
  const fullSetups = burstSetups.filter((setup) => setup.observedSeconds >= 20);
  const burstSequenceMoments = fullSetups.flatMap((setup): ArcaneMoment[] => {
    const window = casts.filter(
      (cast) =>
        cast.time >= setup.time &&
        cast.time <= setup.time + 20 &&
        cast.time < setup.pullEnd,
    );
    const missiles = window.find((cast) => cast.id === ARCANE.missiles);
    const touch = window.find((cast) => cast.id === ARCANE.touch);
    const ordered = Boolean(missiles && touch && missiles.time <= touch.time);
    if (ordered) return [];
    const missing = [!missiles && 'Missiles', !touch && 'Touch'].filter(
      Boolean,
    );
    return [
      {
        time: setup.time,
        spellId: ARCANE.surge,
        detail: missing.length
          ? 'No ' +
            missing.join(', ') +
            ' cast was recorded in the following 20s of this Surge.'
          : 'The recorded order after Surge was not Missiles, then Touch.',
      },
    ];
  });
  add(
    'burst-sequence',
    'Surge burst sequence',
    baseBlock,
    fullSetups.length,
    burstSequenceMoments,
    'Method lists Surge, Missiles, then Touch as opener anchors. Barrage is not mandatory between them. Intervening utility and trinkets are allowed. This 20-second comparison is an app review heuristic, not proof of a mistake.',
  );
  add(
    'surge-touch',
    'Arcane Surge / Touch setup',
    baseBlock,
    fullSetups.length,
    fullSetups
      .filter((setup) => setup.delay === null || setup.delay > 8)
      .map((setup) => ({
        time: setup.startedAt,
        spellId: ARCANE.surge,
        detail:
          setup.delay === null
            ? 'No Touch cast recorded in the following 20s of this pull.'
            : 'Touch followed Surge by ' + setup.delay.toFixed(1) + 's.',
      })),
    'Review cooldown overlap and the planned damage target. The 8s review threshold is a conservative app heuristic, not a guide rule or proof Touch was ready. Windows with less than 20s before a pull ends, the log ends, or a recorded death are excluded.',
  );

  const cadence = touches.flatMap((touch) => {
    const pull = evidence?.pulls.find(
      (entry) => touch.time >= entry.start && touch.time < entry.end,
    );
    if (!pull) return [];
    const death = evidence?.deaths
      .filter((d) => d.time >= touch.time && d.time < pull.end)
      .sort((a, b) => a.time - b.time)[0];
    const end = Math.min(
      pull.end,
      evidence?.duration ?? pull.end,
      death?.time ?? Infinity,
    );
    if (end - touch.time < 55) return [];
    const next = touches.find(
      (candidate) => candidate.time > touch.time && candidate.time < end,
    );
    return [{ touch, next, delay: next ? next.time - touch.time : null }];
  });
  add(
    'touch-cadence',
    'Touch of the Magi cadence',
    baseBlock,
    cadence.length,
    cadence
      .filter((entry) => entry.delay === null || entry.delay > 55)
      .map((entry) => ({
        time: entry.touch.time,
        spellId: ARCANE.touch,
        detail:
          entry.delay === null
            ? 'No following Touch was recorded despite at least 55s remaining in this pull.'
            : 'The next Touch in this pull was ' +
              entry.delay.toFixed(1) +
              's later.',
      })),
    'The guide describes Touch as a 45s cooldown and warns that delaying it can delay the next Surge. The 55s review threshold allows 10s of context; cooldown availability, downtime, target access and planned holds are not reconstructed.',
  );

  add(
    'touch-order',
    'Legacy Barrage / Touch order',
    'Method does not establish a mandatory Barrage-before-Touch rule. This legacy check is disabled.',
    0,
    [],
    '',
  );

  const evocations = matching(ARCANE.evocation).filter(
    (cast) => at(cast, ARCANE.surgeBuff).active !== null,
  );
  const evocationBlocked =
    build.talents.evocation.source === 'conflict'
      ? 'Talent confirmation conflicts with recorded Evocation usage.'
      : stateBlock;
  add(
    'evocation-surge',
    'Evocation during Arcane Surge',
    evocationBlocked,
    evocations.length,
    evocations
      .filter((cast) => at(cast, ARCANE.surgeBuff).active)
      .map((cast) => ({
        time: cast.beganAt ?? cast.time,
        spellId: cast.id,
        detail:
          'Evocation began while the recorded Arcane Surge buff was active.',
      })),
    'App overlap heuristic, not a Method requirement. Mana is unavailable; verify an emergency or mechanic before changing usage.',
    build.talents.evocation.value === false,
  );

  const fillers = matching(ARCANE.blast).filter(
    (cast) => at(cast, ARCANE.soul).active !== null,
  );
  add(
    'soul-filler',
    'Arcane Blast during Arcane Soul',
    stateBlock ??
      (build.hero.value === 'unknown'
        ? 'Confirm the hero tree before using this check.'
        : null),
    fillers.length,
    fillers
      .filter((cast) => at(cast, ARCANE.soul).active)
      .map((cast) => ({
        time: cast.beganAt ?? cast.time,
        spellId: cast.id,
        detail:
          'Arcane Blast began while Arcane Soul was already active. Check Barrage priority for this Sunfury window.',
      })),
    'Uses cast-start state where available, so a filler begun before the buff is not flagged simply for finishing inside it.',
    build.hero.value === 'Spellslinger',
  );

  const threshold = build.hero.value === 'Sunfury' ? 12 : 15;
  const missiles = matching(ARCANE.missiles);
  const inSetup = (cast: CastEvent) =>
    surges.some(
      (surge) =>
        castDecisionTime(cast) >= castDecisionTime(surge) - 3 &&
        castDecisionTime(cast) <= surge.time + 25,
    ) ||
    touches.some(
      (touch) =>
        castDecisionTime(cast) >= touch.time - 3 &&
        castDecisionTime(cast) <= touch.time + 20,
    );
  const normalMissiles = missiles.filter(
    (cast) =>
      !inSetup(cast) &&
      at(cast, ARCANE.surgeBuff).active === false &&
      (build.hero.value === 'Spellslinger' ||
        at(cast, ARCANE.soul).active === false) &&
      at(cast, ARCANE.clearcasting).active === true &&
      // Method lists a three-stack AoE exception for Spellslinger. Without
      // reliable enemy count / full proc context, exclude possible exceptions.
      (build.hero.value !== 'Spellslinger' ||
        (at(cast, ARCANE.clearcasting).stacks !== null &&
          at(cast, ARCANE.clearcasting).stacks! < 3)) &&
      at(cast, ARCANE.salvo).stacks !== null,
  );
  add(
    'missiles-salvo',
    'Missiles at high Arcane Salvo',
    stateBlock ??
      (build.hero.value === 'unknown'
        ? 'The guide uses different Salvo thresholds for Sunfury and Spellslinger. Hero tree is unknown or conflicting.'
        : null),
    normalMissiles.length,
    normalMissiles
      .filter((cast) => at(cast, ARCANE.salvo).stacks! >= threshold)
      .map((cast) => ({
        time: cast.beganAt ?? cast.time,
        spellId: cast.id,
        salvo: at(cast, ARCANE.salvo).stacks!,
        clearcasting: at(cast, ARCANE.clearcasting).stacks ?? undefined,
        detail:
          'Missiles started at ' +
          at(cast, ARCANE.salvo).stacks +
          ' Salvo, above the guide\u2019s normal ' +
          build.hero.value +
          ' Missiles threshold (<' +
          threshold +
          ').',
      })),
    'Outside detected burst setups only. Review Arcane Charges, proc expiry, and target transitions; the log does not prove which alternative was usable. This is not automatically a wasted channel.',
  );

  const bolts = matching(ARCANE.bolt).filter(
    (cast) => at(cast, ARCANE.cumulative).stacks !== null,
  );
  const tierThreshold = build.hero.value === 'Sunfury' ? 8 : 6;
  const lowerStackBolts = bolts.filter(
    (cast) => at(cast, ARCANE.cumulative).stacks! < tierThreshold,
  );
  add(
    'tier-bolt',
    'Four-piece / Prismatic Bolt context',
    stateBlock ??
      (build.talents.apex.source === 'conflict'
        ? 'Prismatic Bolt confirmation conflicts with recorded usage.'
        : build.hero.value === 'unknown'
          ? 'Hero tree is required for the four-piece branch.'
          : build.talents.tier4.value === null
            ? 'The Season 2 four-piece is unknown. Missing gear data is not evidence of having or lacking it.'
            : null),
    bolts.length,
    [],
    lowerStackBolts.length +
      ' of ' +
      bolts.length +
      ' state-known Bolt casts had fewer than ' +
      tierThreshold +
      ' Cumulative Power stacks. Low-stack Bolt is also allowed at a lower guide priority; these are context, not mistakes.',
    build.talents.tier4.value === false || build.talents.apex.value === false,
  );

  add(
    'resource-priority',
    'Mana, Arcane Charges, and AoE priority',
    'Exact resource state, attackable target count, and cooldown/charge readiness are not reconstructed. No automatic ST/AoE or resource-spending verdict is issued.',
    0,
    [],
    '',
  );
  add(
    'channel-completion',
    'Missile channel completion',
    'Cast starts alone do not establish a full or clipped channel. Haste, Overpowered Missiles, tier effects, tick events, and permitted interruptions must be accounted for.',
    0,
    [],
    '',
  );

  const examples: Record<string, ArcaneMoment[]> = {
    'surge-touch': fullSetups.map((setup) => ({
      time: setup.startedAt,
      spellId: ARCANE.surge,
      detail:
        setup.delay === null
          ? 'No Touch was recorded in the following 20s.'
          : 'Touch followed successful Surge by ' +
            setup.delay.toFixed(1) +
            's. Compare the setup; this is not proof that Touch was ready earlier.',
    })),
    'missiles-salvo': normalMissiles.map((cast) => ({
      time: castDecisionTime(cast),
      spellId: cast.id,
      detail:
        'Missiles began with ' +
        at(cast, ARCANE.salvo).stacks +
        ' Salvo and recorded Clearcasting, outside established Surge/Soul state and detected setups. Charges and alternative spell availability are not known.',
    })),
    'tier-bolt': bolts.map((cast) => ({
      time: castDecisionTime(cast),
      spellId: cast.id,
      detail:
        'Prismatic Bolt began with ' +
        at(cast, ARCANE.cumulative).stacks +
        ' recorded Cumulative Power stacks. Different stack thresholds can apply at different guide priorities.',
    })),
  };
  for (const check of checks) {
    if (examples[check.id])
      check.decisions =
        check.status === 'review' || check.status === 'observed'
          ? examples[check.id].filter((entry) =>
              evidence?.pulls.some(
                (pull) => entry.time >= pull.start && entry.time < pull.end,
              ),
            )
          : [];
  }

  const spends = barrages.flatMap((cast) => {
    const state = at(cast, ARCANE.salvo);
    return state.stacks === null
      ? []
      : [{ time: cast.time, stacks: state.stacks }];
  });
  const bins = [
    [0, 9],
    [10, 19],
    [20, 24],
    [25, Infinity],
  ].map(([min, max]) => ({
    label: max === Infinity ? '25+' : min + '-' + max,
    count: spends.filter((spend) => spend.stacks >= min && spend.stacks <= max)
      .length,
  }));
  return {
    build,
    seasonMatches,
    castCoverage,
    buffCoverage,
    checks,
    burstSetups: baseBlock ? [] : burstSetups,
    spend: {
      bins: stateBlock ? [] : bins,
      known: stateBlock ? 0 : spends.length,
      total: barrages.length,
    },
    missileStates: {
      total: missiles.length,
      known: stateBlock
        ? 0
        : missiles.filter(
            (cast) =>
              at(cast, ARCANE.salvo).stacks !== null &&
              at(cast, ARCANE.clearcasting).active !== null,
          ).length,
    },
  };
}

export function arcaneGuideBranches(
  build: ReturnType<typeof arcaneBuild>,
  scenario: 'single' | 'aoe',
) {
  const notes: string[] = [];
  if (build.hero.value === 'unknown')
    notes.push(
      'Select or verify the hero tree before applying its priority thresholds.',
    );
  else
    notes.push(
      build.hero.value +
        ': normal Missiles priority requires Clearcasting and Salvo below ' +
        (build.hero.value === 'Sunfury' ? 12 : 15) +
        '. Burst setups are separate.',
    );
  if (build.hero.value === 'Sunfury')
    notes.push(
      'Arcane Soul adds a Barrage-priority window. The normal low-Salvo Missiles branch still comes before it.',
    );
  if (
    build.talents.highVoltage.value === true &&
    build.hero.value === 'Sunfury'
  )
    notes.push(
      'High Voltage is recorded. Method also lists a 12+ Salvo / Clearcasting Barrage branch; charge readiness still needs inspection.',
    );
  if (build.talents.tier4.value === true && build.hero.value !== 'unknown')
    notes.push(
      'Four-piece: the high-priority Bolt threshold is ' +
        (build.hero.value === 'Sunfury' ? 8 : 6) +
        ' Cumulative Power stacks. Lower-priority Bolt remains allowed.',
    );
  if (scenario === 'aoe') {
    if (build.talents.pulse.value === true)
      notes.push(
        'Arcane Pulse has a talent-dependent AoE branch; charge state and availability still matter.',
      );
    if (build.talents.orbMastery.value === true)
      notes.push(
        'Orb Mastery enables the guide\u2019s use-Orb-when-available AoE branch.',
      );
    notes.push(
      'AoE also permits an early Barrage branch using Orb readiness. This view does not declare every trash pull to be an AoE opportunity.',
    );
  }
  if (build.talents.evocation.value === true)
    notes.push(
      'Evocation usage is mana-recovery context, not a Method cast-count target.',
    );
  if (build.talents.presence.value === true)
    notes.push(
      'Presence of Mind adds an instant-Blast movement option. A cast gap alone does not establish that movement or this talent was the right answer.',
    );
  if (build.talents.overpowered.value === true)
    notes.push(
      'Overpowered Missiles changes channel behavior. Channel duration alone is not a reliable clipping test; the proc and tick sequence must be considered.',
    );
  return notes;
}
