'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import type { AnalysisResult } from '@/lib/domain';
import { castDecisionTime, momentSequence } from '@/lib/cast-sequence';
import type { FireLesson } from '@/lib/fire/lessons';
import { referenceFireReview } from '@/lib/fire/lessons';
import { matchingBoss } from '@/lib/rotation-comparison';
import { referenceKey } from '@/lib/reference-selection';
import { GameIcon, compact, timestamp } from './coaching-report';
import { useReferenceEvidence } from './use-reference-evidence';

export function FireReference({
  result,
  lesson,
  time,
}: {
  result: AnalysisResult;
  lesson: FireLesson;
  time: number;
}) {
  const [selected, setSelected] = useState(
    result.references[0] ? referenceKey(result.references[0]) : '',
  );
  const [manual, setManual] = useState<{ context: string; id: number }>();
  const [chosenCast, setChosenCast] = useState<{
    context: string;
    time: number;
  }>();
  const reference = result.references.find(
    (run) => referenceKey(run) === selected,
  );
  const key = reference ? referenceKey(reference) : '';
  const { evidence, error, retry, unavailable } = useReferenceEvidence(
    result,
    reference,
  );
  const review = useMemo(
    () =>
      reference && evidence
        ? referenceFireReview(result, reference, evidence)
        : null,
    [result, reference, evidence],
  );
  const check = review?.checks.find((entry) => entry.id === lesson.id);
  const available = Boolean(
    check && check.status !== 'unavailable' && check.eligible > 0,
  );
  const yourRate =
    lesson.check.moments.length / Math.max(1, lesson.check.eligible);
  const refRate = available ? check!.moments.length / check!.eligible : null;
  const pull = result.evidence?.pulls.find(
    (entry) => time >= entry.start && time < entry.end,
  );
  const context = key + ':' + (pull?.id ?? '') + ':' + lesson.id;
  const automatic = matchingBoss(pull, evidence?.pulls ?? []);
  const refPull =
    manual?.context === context
      ? evidence?.pulls.find((entry) => entry.id === manual.id)
      : automatic;
  const anchors =
    evidence?.casts.filter(
      (cast) =>
        cast.id === lesson.spellId &&
        refPull &&
        castDecisionTime(cast) >= refPull.start &&
        castDecisionTime(cast) < refPull.end,
    ) ?? [];
  const anchorContext = context + ':' + (refPull?.id ?? '');
  const anchor =
    (chosenCast?.context === anchorContext
      ? anchors.find((cast) => cast.time === chosenCast.time)
      : undefined) ?? anchors[0];
  const sequence = anchor
    ? momentSequence(evidence, castDecisionTime(anchor), anchor.id)
    : [];
  return (
    <section className="training-reference">
      <div className="training-reference-heading">
        <span className="training-row-label">
          <i /> WHAT A TOP FIRE PARSE DOES
        </span>
        <label>
          <span className="sr-only">Fire coaching reference player</span>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {result.references.map((run, index) => (
              <option key={referenceKey(run)} value={referenceKey(run)}>
                #{index + 1} {run.player} &middot;{' '}
                {compact(run.rankingDps ?? run.dps)} DPS
              </option>
            ))}
          </select>
        </label>
      </div>
      {!reference && (
        <p className="training-note">
          No eligible Fire reference is available.
        </p>
      )}
      {reference && !evidence && (
        <output className="training-reference-loading">
          {unavailable || error || "Loading this player's Fire decisions..."}
          {error && (
            <button className="training-button" onClick={retry}>
              <RefreshCw size={14} /> Retry
            </button>
          )}
        </output>
      )}
      {evidence && (
        <>
          {available ? (
            <div className="training-recurrence">
              <p>This review pattern occurred in:</p>
              <div>
                <span>You</span>
                <i aria-hidden="true">
                  <b style={{ width: yourRate * 100 + '%' }} />
                </i>
                <strong>
                  {lesson.check.moments.length}/{lesson.check.eligible}
                </strong>
              </div>
              <div className="training-reference-rate">
                <span>{reference?.player}</span>
                <i aria-hidden="true">
                  <b style={{ width: refRate! * 100 + '%' }} />
                </i>
                <strong>
                  {check!.moments.length}/{check!.eligible}
                </strong>
              </div>
              <small>
                Eligible decisions across each run; lower is not automatically
                better.
              </small>
              {refRate !== null &&
                refRate >= yourRate &&
                check!.eligible >= 3 && (
                  <p className="training-pattern-warning">
                    This top parse shows the pattern at least as often. Check
                    talents and pull context before treating it as your damage
                    problem.
                  </p>
                )}
            </div>
          ) : (
            <p className="training-note">
              This Fire check cannot be fairly assessed for the reference
              because its event coverage or eligible decisions differ.
            </p>
          )}
          <details className="training-reference-example">
            <summary>
              Inspect their actual spell sequence <ChevronDown size={16} />
            </summary>
            <div className="training-reference-selectors">
              <label className="training-field">
                Reference pull
                <select
                  aria-label="Fire reference pull for coaching"
                  value={refPull?.id ?? ''}
                  onChange={(event) =>
                    setManual({ context, id: Number(event.target.value) })
                  }
                >
                  <option value="">Choose a comparable pull</option>
                  {evidence.pulls.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.boss ? 'Boss: ' : 'Pull ' + entry.id + ': '}
                      {entry.name} ({timestamp(entry.end - entry.start)})
                    </option>
                  ))}
                </select>
              </label>
              {refPull && (
                <label className="training-field">
                  Their cast to inspect
                  <select
                    value={anchor?.time ?? ''}
                    onChange={(event) =>
                      setChosenCast({
                        context: anchorContext,
                        time: Number(event.target.value),
                      })
                    }
                  >
                    {!anchors.length && (
                      <option value="">No matching spell in this pull</option>
                    )}
                    {anchors.map((cast, index) => (
                      <option value={cast.time} key={cast.time + ':' + index}>
                        {timestamp(cast.time)} &middot; {cast.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <p className="training-side-note">
              {automatic && refPull?.id === automatic.id
                ? 'Same boss matched. '
                : 'Pulls are not automatically interchangeable. '}
              Verify enemies, procs, talents and assignments.
            </p>
            {sequence.length > 0 && (
              <div className="training-spell-sequence">
                {sequence.map((cast, index) => (
                  <div
                    className="training-spell-step"
                    data-focus={cast === anchor}
                    key={cast.time + ':' + index}
                  >
                    <GameIcon id={cast.id} name={cast.name} icon={cast.icon} />
                    <strong>{cast.name}</strong>
                    <small>
                      {(castDecisionTime(cast) - castDecisionTime(anchor!) >= 0
                        ? '+'
                        : '') +
                        (
                          castDecisionTime(cast) - castDecisionTime(anchor!)
                        ).toFixed(1)}
                      s
                    </small>
                  </div>
                ))}
              </div>
            )}
            <small>
              A recorded example, not proof that every cast was optimal.
            </small>
          </details>
        </>
      )}
    </section>
  );
}
