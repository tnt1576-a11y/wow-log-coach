import type { CharacterSnapshot } from '../domain';

function learned(character?: CharacterSnapshot | null) {
  return new Map(
    (character?.talents ?? [])
      .filter(
        (talent) =>
          Number.isInteger(talent.spellId) &&
          talent.spellId > 0 &&
          Number.isInteger(talent.rank) &&
          talent.rank > 0,
      )
      .map((talent) => [talent.spellId, talent]),
  );
}

/** Positive learned entries only. Missing entries do not prove unselected talents. */
export function compareRecordedBuilds(
  yours?: CharacterSnapshot | null,
  theirs?: CharacterSnapshot | null,
) {
  const yourTalents = learned(yours),
    theirTalents = learned(theirs);
  const ids = [...new Set([...yourTalents.keys(), ...theirTalents.keys()])];
  const rows = ids
    .map((id) => {
      const you = yourTalents.get(id),
        reference = theirTalents.get(id);
      return {
        id,
        name: you?.name || reference?.name || 'Talent ' + id,
        you: you?.rank ?? null,
        reference: reference?.rank ?? null,
        status:
          you && reference
            ? you.rank === reference.rank
              ? 'shared'
              : 'different-rank'
            : 'one-sided',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  return {
    yourCount: yourTalents.size,
    referenceCount: theirTalents.size,
    available: yourTalents.size > 0 && theirTalents.size > 0,
    differentRanks: rows.filter((row) => row.status === 'different-rank'),
    oneSided: rows.filter((row) => row.status === 'one-sided'),
    shared: rows.filter((row) => row.status === 'shared'),
    rows,
  };
}
