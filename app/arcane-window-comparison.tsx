import type { RunEvidence } from '@/lib/domain';
import { compareArcaneDecisionWindows } from '@/lib/arcane/window-comparison';
import type { AuraState } from '@/lib/arcane/state';
import { GameIcon } from './coaching-report';

function manaText(
  snapshot: { percent: number; spell: string; afterDecision: number } | null,
) {
  if (!snapshot) return 'Not recorded for this selected cast';
  return (
    snapshot.percent.toFixed(1) +
    '% - ' +
    snapshot.spell +
    (snapshot.afterDecision > 0
      ? ' (successful cast event +' +
        snapshot.afterDecision.toFixed(1) +
        's after selection)'
      : ' (successful cast event)')
  );
}

function stateText(state: AuraState, stacks: boolean) {
  if (state.active === null) return 'Unknown';
  if (!state.active) return stacks ? '0' : 'Inactive';
  return stacks
    ? state.stacks === null
      ? 'Active; stacks unknown'
      : String(state.stacks)
    : 'Active';
}

export function ArcaneWindowComparison({
  yours,
  theirs,
  yourStart,
  theirStart,
  referenceName,
}: {
  yours: RunEvidence | undefined;
  theirs: RunEvidence | undefined;
  yourStart: number;
  theirStart: number;
  referenceName: string;
}) {
  const comparison = compareArcaneDecisionWindows(
    yours,
    theirs,
    yourStart,
    theirStart,
  );
  if (!comparison.available)
    return <p className="training-note">{comparison.reason}</p>;
  const difference = comparison.largestDifference;
  return (
    <section
      className="arcane-window-comparison"
      aria-label="Arcane decision window comparison"
    >
      <h4>What changed after this decision?</h4>
      <p>
        The next {comparison.duration.toFixed(1)} seconds for each player,
        starting at the selected cast.
        {comparison.duration < 10 &&
          ' Both windows stop at the shorter pull or first recorded death.'}
      </p>
      <div className="arcane-window-table-wrap">
        <table>
          <caption>Recorded core spell casts in equal time</caption>
          <thead>
            <tr>
              <th scope="col">Spell</th>
              <th scope="col">You</th>
              <th scope="col">{referenceName}</th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <span>
                    <GameIcon id={row.id} name={row.name} icon={row.icon} />
                    {row.name}
                  </span>
                </th>
                <td>{row.you}</td>
                <td>{row.reference}</td>
                <td>
                  {row.difference === 0
                    ? 'Same'
                    : Math.abs(row.difference) +
                      (row.difference > 0 ? ' more' : ' fewer')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {difference && (
        <p className="arcane-window-question">
          {referenceName} recorded {Math.abs(difference.difference)}{' '}
          {difference.difference > 0 ? 'more' : 'fewer'} {difference.name}{' '}
          casts. Check the starting buffs below and the sequence above to see
          whether that choice was available to you.
        </p>
      )}
      <div className="arcane-window-table-wrap">
        <table>
          <caption>Recorded state immediately before the selected cast</caption>
          <thead>
            <tr>
              <th scope="col">State</th>
              <th scope="col">You</th>
              <th scope="col">{referenceName}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.yourState.map((entry, index) => (
              <tr key={entry.id}>
                <th scope="row">{entry.label}</th>
                <td>{stateText(entry.state, entry.stacks)}</td>
                <td>
                  {stateText(comparison.theirState[index].state, entry.stacks)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="arcane-window-table-wrap">
        <table aria-describedby="arcane-mana-limit">
          <caption>Mana context for these casts</caption>
          <thead>
            <tr>
              <th scope="col">You</th>
              <th scope="col">{referenceName}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{manaText(comparison.yourMana)}</td>
              <td>{manaText(comparison.theirMana)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="training-side-note" id="arcane-mana-limit">
        Percent of recorded maximum; not verified mana before payment. Use this
        as context for mana recovery or filler choices, not proof that another
        spell was affordable. Missing mana is not zero.
      </p>
      <p className="training-side-note">
        Unknown means the state was not established by the log. Cast counts
        include channel starts, not ticks. Compare Arcane Soul separately from
        ordinary rotation. Charges, pre-cast mana, target count, other talents,
        and cooldown readiness still need checking; more casts of a spell do not
        by themselves prove a better decision.
      </p>
    </section>
  );
}
