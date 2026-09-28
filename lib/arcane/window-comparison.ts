import type { RunEvidence } from '../domain';
import { castDecisionTime } from '../cast-sequence';
import { ARCANE } from './catalog';
import { auraIndex, type AuraState } from './state';

const CORE = [
  [ARCANE.barrage, 'Arcane Barrage'],
  [ARCANE.missiles, 'Arcane Missiles'],
  [ARCANE.blast, 'Arcane Blast'],
  [ARCANE.orb, 'Arcane Orb'],
  [ARCANE.bolt, 'Prismatic Bolt'],
  [ARCANE.surge, 'Arcane Surge'],
  [ARCANE.touch, 'Touch of the Magi'],
  [ARCANE.evocation, 'Evocation'],
] as const;
const STATES = [
  [ARCANE.salvo, 'Salvo', true],
  [ARCANE.clearcasting, 'Clearcasting', true],
  [ARCANE.soul, 'Arcane Soul', false],
  [ARCANE.surgeBuff, 'Arcane Surge', false],
] as const;

function availableSeconds(evidence: RunEvidence, start: number) {
  const pull = evidence.pulls.find(
    (entry) => start >= entry.start && start < entry.end,
  );
  if (!pull) return 0;
  const death = evidence.deaths
    .filter((entry) => entry.time >= start && entry.time < pull.end)
    .sort((a, b) => a.time - b.time)[0];
  return Math.max(
    0,
    Math.min(pull.end, evidence.duration, death?.time ?? Infinity) - start,
  );
}
function snapshot(evidence: RunEvidence, start: number) {
  const states = auraIndex(evidence.arcane?.auras ?? []);
  return STATES.map(([id, label, stacks]) => ({
    id,
    label,
    stacks,
    state: evidence.arcane?.complete
      ? states.before(id, start)
      : ({ active: null, stacks: null } as AuraState),
  }));
}

function manaSnapshot(evidence: RunEvidence, start: number) {
  // A time-only selector can be ambiguous when multiple spells begin together.
  // Do not borrow a nearby cast, even when it is only milliseconds away.
  const matches = evidence.casts.filter(
    (cast) => castDecisionTime(cast) === start,
  );
  if (matches.length !== 1 || !matches[0].mana) return null;
  const cast = matches[0],
    mana = cast.mana!;
  return {
    spell: cast.name,
    time: cast.time,
    afterDecision: cast.time - start,
    percent: (mana.amount / mana.maximum) * 100,
  };
}

export function compareArcaneDecisionWindows(
  yours: RunEvidence | undefined,
  theirs: RunEvidence | undefined,
  yourStart: number,
  theirStart: number,
) {
  if (!yours?.castsComplete || !theirs?.castsComplete)
    return {
      available: false as const,
      reason:
        'Complete cast events for both players are needed for spell-count comparison.',
    };
  if (!Number.isFinite(yourStart) || !Number.isFinite(theirStart))
    return {
      available: false as const,
      reason: 'Select a recorded decision for both players.',
    };
  const duration = Math.min(
    10,
    availableSeconds(yours, yourStart),
    availableSeconds(theirs, theirStart),
  );
  if (duration < 1)
    return {
      available: false as const,
      reason:
        'There is less than one comparable second before a pull ends or a player dies.',
    };
  const slice = (evidence: RunEvidence, start: number) =>
    evidence.casts.filter(
      (cast) =>
        castDecisionTime(cast) >= start &&
        castDecisionTime(cast) < start + duration,
    );
  const yourCasts = slice(yours, yourStart),
    theirCasts = slice(theirs, theirStart);
  const rows = CORE.map(([id, name]) => {
    const you = yourCasts.filter((cast) => cast.id === id).length;
    const reference = theirCasts.filter((cast) => cast.id === id).length;
    return {
      id,
      name,
      you,
      reference,
      difference: reference - you,
      icon:
        yourCasts.find((cast) => cast.id === id)?.icon ??
        theirCasts.find((cast) => cast.id === id)?.icon,
    };
  }).filter((row) => row.you > 0 || row.reference > 0);
  return {
    available: true as const,
    duration,
    rows,
    yourState: snapshot(yours, yourStart),
    theirState: snapshot(theirs, theirStart),
    yourMana: manaSnapshot(yours, yourStart),
    theirMana: manaSnapshot(theirs, theirStart),
    largestDifference:
      [...rows]
        .filter((row) => row.difference !== 0)
        .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))[0] ??
      null,
  };
}
