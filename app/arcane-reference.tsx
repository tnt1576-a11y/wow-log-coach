'use client';
import {
  suggestArcaneAnchors,
  suggestReferencePulls,
} from '@/lib/reference-suggestions';
import { useMemo, useState } from 'react';
import { useReferenceEvidence } from './use-reference-evidence';
import { ChevronDown, RefreshCw } from 'lucide-react';
import type { AnalysisResult } from '@/lib/domain';
import type { ArcaneLesson } from '@/lib/arcane/lessons';
import {
  castDecisionTime,
  momentSequence,
  referenceArcaneReview,
} from '@/lib/arcane/lessons';
import { matchingBoss } from '@/lib/rotation-comparison';
import { referenceKey } from '@/lib/reference-selection';
import { GameIcon, compact, timestamp } from './coaching-report';
import { ArcaneWindowComparison } from './arcane-window-comparison';
import { GuideBuildComparison } from './guide-build-comparison';

export function ArcaneReference({
  result,
  lesson,
  time,
  hero,
}: {
  result: AnalysisResult;
  lesson: Pick<ArcaneLesson, 'id' | 'spellId' | 'check'>;
  time: number;
  hero: 'Sunfury' | 'Spellslinger' | 'unknown';
}) {
  const [selected, setSelected] = useState(
    result.references[0] ? referenceKey(result.references[0]) : '',
  );
  const reference = result.references.find(
    (run) => referenceKey(run) === selected,
  );
  const [manual, setManual] = useState<{ context: string; id: number }>();
  const [chosenCast, setChosenCast] = useState<{
    context: string;
    time: number;
  }>();
  const key = reference ? referenceKey(reference) : '';
  const { evidence, error, retry, unavailable } = useReferenceEvidence(
    result,
    reference,
  );
  const review = useMemo(
    () =>
      reference && evidence
        ? referenceArcaneReview(result, reference, evidence)
        : null,
    [result, reference, evidence],
  );
  const check = review?.checks.find((entry) => entry.id === lesson.id);
  const available =
    hero !== 'unknown' &&
    review?.build.hero.value === hero &&
    check &&
    check.status !== 'unavailable' &&
    check.status !== 'not-applicable' &&
    check.eligible > 0;
  const yourRate =
    lesson.check.moments.length / Math.max(1, lesson.check.eligible);
  const refRate = available ? check.moments.length / check.eligible : null;
  const pull = result.evidence?.pulls.find(
    (entry) => time >= entry.start && time < entry.end,
  );
  const context = key + ':' + (pull?.id ?? '') + ':' + lesson.id + ':' + time;
  const automatic = matchingBoss(pull, evidence?.pulls ?? []);
  const refPull =
    manual?.context === context
      ? evidence?.pulls.find((entry) => entry.id === manual.id)
      : automatic;
  const anchors =
    evidence?.casts.filter(
      (cast) =>
        cast.id === lesson.spellId &&
        (!check?.decisions ||
          check.decisions.some(
            (decision) =>
              decision.spellId === cast.id &&
              decision.time === castDecisionTime(cast),
          )) &&
        refPull &&
        castDecisionTime(cast) >= refPull.start &&
        castDecisionTime(cast) < refPull.end,
    ) ?? [];
  const pullSuggestions = suggestReferencePulls(
    result.evidence,
    evidence,
    pull,
  );
  const anchorSuggestions = available
    ? suggestArcaneAnchors(
        result.evidence,
        evidence,
        time,
        lesson.spellId,
        anchors,
        hero,
        review!.build.hero.value,
      )
    : [];
  const anchorContext = context + ':' + (refPull?.id ?? '');
  const anchor =
    (chosenCast?.context === anchorContext
      ? anchors.find((cast) => cast.time === chosenCast.time)
      : undefined) ?? anchors[0];
  const sequence = anchor
    ? momentSequence(evidence, anchor.beganAt ?? anchor.time, anchor.id)
    : [];
  return (
    <section className="training-reference">
      <div className="training-reference-heading">
        <span className="training-row-label">
          <i /> WHAT A TOP PARSE DOES
        </span>
        <label>
          <span className="sr-only">Coaching reference player</span>
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
      {reference && (
        <GuideBuildComparison
          key={key}
          yours={result.targetMetrics.character}
          theirs={reference.metrics?.character}
          referenceName={reference.player}
        />
      )}
      {!reference && (
        <p className="training-note">
          No eligible reference is available. Adjust the analysis filters to
          compare players.
        </p>
      )}
      {reference && !evidence && (
        <output className="training-reference-loading">
          {unavailable || error || 'Loading this player\u2019s decisions...'}
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
                  {check.moments.length}/{check.eligible}
                </strong>
              </div>
              <small>
                Eligible casts/windows across each run; lower is not
                automatically better.
              </small>
              {refRate !== null &&
                refRate >= yourRate &&
                check.eligible >= 3 && (
                  <p className="training-pattern-warning">
                    This top parse shows the pattern at least as often. Check
                    the build and encounter context before treating it as your
                    damage problem.
                  </p>
                )}
            </div>
          ) : (
            <p className="training-note">
              This check cannot be fairly assessed for the reference. Its build
              or event coverage differs.
            </p>
          )}
          <details className="training-reference-example">
            <summary>
              Inspect their actual spell sequence <ChevronDown size={16} />
            </summary>
            {pullSuggestions.length > 0 && (
              <div className="reference-suggestions">
                <strong>Suggested pulls</strong>
                {pullSuggestions.map((s) => (
                  <button
                    className="training-button"
                    key={s.pull.id}
                    onClick={() => setManual({ context, id: s.pull.id })}
                  >
                    {s.pull.name} at {timestamp(s.pull.start)}
                    <span>{s.reasons.join(' · ')}</span>
                  </button>
                ))}
                <p>
                  Trash suggestions use duration, not verified enemy
                  composition. Same hero does not establish an identical talent
                  or gear build.
                </p>
              </div>
            )}
            <div className="training-reference-selectors">
              <label className="training-field">
                Reference pull
                <select
                  aria-label="Reference pull for coaching"
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
              Sequences center on the selected spell, not equal dungeon time.
              Verify enemies, resources, and buffs.
            </p>
            {refPull && available && (
              <div className="reference-suggestions">
                <strong>Similar starting-state suggestions</strong>
                {anchorSuggestions.length ? (
                  anchorSuggestions.map((s) => (
                    <button
                      className="training-button"
                      key={s.cast.time}
                      onClick={() =>
                        setChosenCast({
                          context: anchorContext,
                          time: s.cast.time,
                        })
                      }
                    >
                      Inspect {s.cast.name} at {timestamp(s.cast.time)}
                      <span>{s.reasons.join(' · ')}</span>
                    </button>
                  ))
                ) : (
                  <p>
                    No sufficiently known matching state in this pull. Manual
                    examples remain available; their context can differ.
                  </p>
                )}
                <p>
                  Suggestions compare observed buffs and nearby burst setup,
                  then rank by stack differences and time remaining. Resources,
                  targets, and readiness can still differ.
                </p>
              </div>
            )}
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
              A recorded example, not proof that every cast was optimal. Other
              talents and tier may differ.
            </small>
            {anchor && available && (
              <ArcaneWindowComparison
                yours={result.evidence}
                theirs={evidence}
                yourStart={time}
                theirStart={castDecisionTime(anchor)}
                referenceName={reference?.player ?? 'Reference'}
              />
            )}
          </details>
        </>
      )}
    </section>
  );
}
