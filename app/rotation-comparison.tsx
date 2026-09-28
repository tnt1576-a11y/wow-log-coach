'use client';
import { useEffect, useState } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import type {
  AnalysisResult,
  CastEvent,
  PullEvidence,
  ReferenceRun,
  RunEvidence,
} from '@/lib/domain';
import { compareSpells } from '@/lib/comparisons';
import { defensiveSpell, type ReviewFocus } from '@/lib/defensives';
import {
  compareCastWindow,
  matchingBoss,
  mergedCastSequence,
  pairedWindow,
} from '@/lib/rotation-comparison';
import { referenceKey } from '@/lib/reference-selection';
import { suggestReferencePulls } from '@/lib/reference-suggestions';
import { compact, fmt } from './coaching-report';
import { Ability } from './ability';
import './rotation-comparison.css';
import { Timeline } from './pull-review';

export function RotationComparison(props: {
  result: AnalysisResult;
  focus?: ReviewFocus;
  preview?: boolean;
}) {
  const { result, focus = {} } = props;
  // A new review link must move the window and filters, even for the same result.
  const key = [
    result.generatedAt,
    result.target.reportCode,
    result.target.fightId,
    result.target.sourceId,
    focus.pullId,
    focus.time,
    focus.spellId,
    focus.defensiveOnly,
  ].join(':');
  return <RotationWorkspace key={key} {...props} />;
}

function RotationWorkspace({
  result,
  focus = {},
  preview = false,
}: {
  result: AnalysisResult;
  focus?: ReviewFocus;
  preview?: boolean;
}) {
  const [selected, setSelected] = useState(
    result.references[0] ? referenceKey(result.references[0]) : '',
  );
  const reference =
    result.references.find((run) => referenceKey(run) === selected) ??
    result.references[0];
  const [search, setSearch] = useState(
    result.spells?.find((spell) => spell.id === focus.spellId)?.name ??
      result.evidence?.casts.find((spell) => spell.id === focus.spellId)
        ?.name ??
      '',
  );
  const [mode, setMode] = useState(focus.defensiveOnly ? 'defensive' : 'all');
  const [expanded, setExpanded] = useState(false);
  const matches = (id: number, name: string) =>
    name.toLowerCase().includes(search.toLowerCase()) &&
    (mode === 'all' ||
      (mode === 'defensive'
        ? Boolean(defensiveSpell(id))
        : !defensiveSpell(id)));
  const spells = reference?.metrics
    ? compareSpells(result.targetMetrics, [reference.metrics])
        .filter((spell) => matches(spell.id, spell.name))
        .sort(
          (a, b) =>
            b.damage.median -
            b.damage.target -
            (a.damage.median - a.damage.target),
        )
    : [];
  return (
    <div className="coach-stack rotation-comparison">
      <section className="coach-panel">
        <header className="coach-panel-heading">
          <h3>Compare your rotation with one player</h3>
          <p>
            Choose a reference, select comparable pulls, then read both players
            on the same clock. Cast counts, order, and timing are separate
            clues.
          </p>
        </header>
        <div className="rotation-controls">
          <label>
            1. Reference player, ordered by ranked DPS
            <select
              className="coach-select"
              aria-label="Rotation reference player"
              value={reference ? referenceKey(reference) : ''}
              onChange={(event) => setSelected(event.target.value)}
            >
              {result.references.map((run, index) => (
                <option key={referenceKey(run)} value={referenceKey(run)}>
                  #{index + 1} {run.player} -{' '}
                  {compact(run.rankingDps ?? run.dps)} DPS -{' '}
                  {fmt(run.percentile)} percentile
                </option>
              ))}
            </select>
          </label>
          <label>
            Show abilities
            <select
              className="coach-select"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="all">All abilities</option>
              <option value="damage">
                Other spells (excluding tracked defensives)
              </option>
              <option value="defensive">Defensives & recovery</option>
            </select>
          </label>
          <label>
            Find a spell
            <input
              className="coach-select"
              placeholder="Spell name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {reference ? (
          <>
            <div className="rotation-scoreline">
              <span className="rotation-you">
                You: {result.target.player}{' '}
                <b>{compact(result.targetMetrics.dps)} DPS</b>
              </span>
              <span className="rotation-reference">
                Reference: {reference.player}{' '}
                <b>{compact(reference.dps)} DPS</b>
              </span>
              <a
                className="coach-link"
                href={reference.url}
                target="_blank"
                rel="noreferrer"
              >
                Open reference log
              </a>
            </div>
            <p className="coach-footnote">
              Both DPS values use full logged duration. Pull size, external
              buffs, gear, talents, and fight length can help explain the gap. A
              cast difference alone does not establish what caused higher
              damage.
            </p>
          </>
        ) : (
          <p className="coach-empty">
            No qualifying reference is available. Change the analysis filters
            before comparing rotations.
          </p>
        )}
      </section>
      {reference && (
        <ReferencePulls
          result={result}
          reference={reference}
          focus={focus}
          preview={preview}
          matches={matches}
        />
      )}
      <details className="coach-panel rotation-context">
        <summary>
          Full-run spell usage: you vs {reference?.player ?? 'reference'}
        </summary>
        <header className="coach-panel-heading">
          <p>
            Full-run rates account for different run lengths. Sorted by the
            reference&apos;s largest extra damage contribution. Select a spell
            using its Filter button to isolate its timing in the comparison
            above.
          </p>
        </header>
        {reference?.metrics ? (
          <div className="coach-table-wrap">
            <table className="coach-table">
              <thead>
                <tr>
                  <th>Spell</th>
                  <th>Your casts / min</th>
                  <th>{reference.player} casts / min</th>
                  <th>Your spell DPS</th>
                  <th>Reference spell DPS</th>
                  <th>Difference to review</th>
                </tr>
              </thead>
              <tbody>
                {(expanded ? spells : spells.slice(0, 12)).map((spell) => (
                  <tr key={spell.id}>
                    <td>
                      <div className="rotation-spell-cell">
                        <Ability
                          id={spell.id}
                          name={spell.name}
                          icon={spell.icon}
                        />
                        <button
                          className="review-button rotation-filter-button"
                          aria-pressed={search === spell.name}
                          aria-label={'Filter timing to ' + spell.name}
                          onClick={() =>
                            setSearch(search === spell.name ? '' : spell.name)
                          }
                        >
                          {search === spell.name
                            ? 'Clear filter'
                            : 'Filter timing'}
                        </button>
                      </div>
                      {spell.damageIds?.some((id) => id !== spell.id) && (
                        <small>Verified damage-to-cast link</small>
                      )}
                    </td>
                    <td>
                      {!result.targetMetrics.casts
                        ? 'Unavailable'
                        : !spell.targetUses && !spell.referenceUsers
                          ? '-'
                          : fmt(spell.casts.target)}
                    </td>
                    <td>
                      {!reference.metrics?.casts
                        ? 'Unavailable'
                        : !spell.targetUses && !spell.referenceUsers
                          ? '-'
                          : fmt(spell.casts.median)}
                    </td>
                    <td>{compact(spell.damage.target)}</td>
                    <td>{compact(spell.damage.median)}</td>
                    <td>
                      {!result.targetMetrics.casts || !reference.metrics?.casts
                        ? 'Cast data incomplete'
                        : spell.referenceUsers && !spell.targetUses
                          ? 'They cast it; you did not'
                          : spell.casts.target < spell.casts.median
                            ? fmt(spell.casts.median - spell.casts.target) +
                              ' fewer casts/min'
                            : !spell.targetUses && !spell.referenceUsers
                              ? 'Damage recorded; cast relationship unverified'
                              : 'Similar or higher cast rate'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!spells.length && (
              <p className="coach-empty">
                No spells match. Clear the search or choose another category.
              </p>
            )}
          </div>
        ) : (
          <p className="coach-empty">
            {preview
              ? 'This older illustrative sample has no individual-reference spell tables.'
              : 'Re-run the analysis to load individual-reference spell tables.'}
          </p>
        )}
        {spells.length > 12 && (
          <button
            className="review-button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? 'Show largest 12 differences'
              : 'Show all ' + spells.length + ' spells'}
          </button>
        )}
        <p className="coach-footnote">
          A proc, pet attack, or damage effect is not necessarily a button
          press. Damage and cast IDs may differ. Different talents, target
          counts, cooldown plans, or assignments can explain a lower rate.
          Defensive frequency alone is not a score.
        </p>
      </details>
      <details className="coach-panel rotation-context">
        <summary>Your fight context: deaths and original event review</summary>
        <p className="coach-footnote">
          Optional context for the comparison above. When available, the map
          shows your route; encounter assignments and enemy composition still
          need review.
        </p>
        <Timeline result={result} focus={focus} />
      </details>
    </div>
  );
}

function ReferencePulls({
  result,
  reference,
  focus,
  preview,
  matches,
}: {
  result: AnalysisResult;
  reference: ReferenceRun;
  focus: ReviewFocus;
  preview: boolean;
  matches: (id: number, name: string) => boolean;
}) {
  const currentReference = referenceKey(reference);
  const [loaded, setLoaded] = useState<{
    key: string;
    evidence: RunEvidence;
  }>();
  const evidence =
    loaded?.key === currentReference ? loaded.evidence : undefined;
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const error = failure?.key === currentReference ? failure.message : '';
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (preview || !reference.sourceId || !result.evidence?.pulls.length)
      return;
    const controller = new AbortController();
    fetch('/api/reference-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: {
          reportCode: result.target.reportCode,
          fightId: result.target.fightId,
          sourceId: result.target.sourceId,
        },
        reference: {
          reportCode: reference.reportCode,
          fightId: reference.fightId,
          sourceId: reference.sourceId,
        },
        matchAffixes: result.cohort.affixesMatched,
        raidDurationTolerancePercent: result.cohort.durationTolerancePercent,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as RunEvidence & {
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(
            body.error?.message ?? 'Reference events could not be loaded.',
          );
        return body;
      })
      .then((body) => {
        if (!controller.signal.aborted)
          setLoaded({ key: currentReference, evidence: body });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setFailure({
            key: currentReference,
            message:
              failure instanceof Error
                ? failure.message
                : 'Reference events unavailable.',
          });
      });
    return () => controller.abort();
  }, [reference, result, preview, attempt, currentReference]);
  const target = result.evidence;
  const initial =
    target?.pulls.find(
      (pull) =>
        pull.id === focus.pullId ||
        (focus.time !== undefined &&
          focus.time >= pull.start &&
          focus.time < pull.end),
    ) ??
    target?.pulls.find((pull) => pull.boss) ??
    target?.pulls[0];
  const [targetId, setTargetId] = useState(initial?.id ?? -1);
  const [manual, setManual] = useState<{ key: string; id: number } | null>(
    null,
  );
  const manualId = manual?.key === currentReference ? manual.id : null;
  const chooseReference = (id: number | null) =>
    setManual(id === null ? null : { key: currentReference, id });
  const [windowSize, setWindowSize] = useState(30);
  const [offset, setOffset] = useState(
    initial && focus.time !== undefined
      ? Math.floor(Math.max(0, focus.time - initial.start) / 30) * 30
      : 0,
  );
  const targetPull = target?.pulls.find((pull) => pull.id === targetId);
  const automatic = matchingBoss(targetPull, evidence?.pulls ?? []);
  const suggestions = suggestReferencePulls(target, evidence, targetPull);
  const referencePull =
    manualId !== null
      ? evidence?.pulls.find((pull) => pull.id === manualId)
      : automatic;
  const pair =
    target && evidence && targetPull && referencePull
      ? pairedWindow(
          target,
          evidence,
          targetPull,
          referencePull,
          offset,
          windowSize,
        )
      : null;
  const yours =
    pair?.target.filter((cast) => matches(cast.id, cast.name)) ?? [];
  const theirs =
    pair?.reference.filter((cast) => matches(cast.id, cast.name)) ?? [];
  const rows = compareCastWindow(yours, theirs);
  const pairedBoss = Boolean(
    targetPull?.boss &&
    referencePull?.boss &&
    targetPull.encounterId &&
    targetPull.encounterId === referencePull.encounterId,
  );
  return (
    <section className="coach-panel paired-pulls">
      <header className="coach-panel-heading">
        <h3>Spell order and timing</h3>
        <p>
          Two independent logs, one shared clock: seconds since each selected
          pull began. Pick each side independently. A matching boss is selected
          automatically when there is exactly one attempt.
        </p>
      </header>
      {!target?.pulls.length ? (
        <p className="coach-empty">
          Your log has no pull boundaries available for alignment.
        </p>
      ) : (
        <>
          <div className="paired-pull-selectors">
            <label className="rotation-you">
              2. Your pull or encounter
              <select
                className="coach-select"
                aria-label="Your comparison pull"
                value={targetId}
                onChange={(event) => {
                  setTargetId(Number(event.target.value));
                  setOffset(0);
                }}
              >
                {target.pulls.map((pull) => (
                  <option key={pull.id} value={pull.id}>
                    {pullLabel(pull)}
                  </option>
                ))}
              </select>
            </label>
            <label className="rotation-reference">
              3. {reference.player}&apos;s pull or encounter
              <select
                className="coach-select"
                aria-label="Reference comparison pull"
                disabled={!evidence}
                value={referencePull?.id ?? ''}
                onChange={(event) => {
                  chooseReference(
                    event.target.value === '' ? -1 : Number(event.target.value),
                  );
                  setOffset(0);
                }}
              >
                <option value="">Choose a comparable pull...</option>
                {(evidence?.pulls ?? []).map((pull) => (
                  <option key={pull.id} value={pull.id}>
                    {pullLabel(pull)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {manualId !== null && automatic && manualId !== automatic.id && (
            <button
              className="review-button"
              onClick={() => {
                chooseReference(null);
                setOffset(0);
              }}
            >
              Use matching boss: {automatic.name}
            </button>
          )}
          {!evidence && (
            <output className="data-availability">
              {preview
                ? 'Live reference events are disabled for the illustrative sample.'
                : !reference.sourceId
                  ? 'Re-run the analysis to resolve this reference player.'
                  : error ||
                    'Loading this reference player\u2019s casts and pull boundaries...'}
              {error && (
                <button
                  className="review-button"
                  onClick={() => {
                    setFailure(undefined);
                    setAttempt(attempt + 1);
                  }}
                >
                  Retry reference
                </button>
              )}
            </output>
          )}
          {suggestions.length > 0 && (
            <details className="moment-insight">
              <summary>
                Suggested reference pulls{' '}
                <span>Compare the context before choosing</span>
              </summary>
              <div className="moment-insight-body reference-suggestions">
                <p>
                  Suggestions use boss identity or similar trash duration, with
                  recorded deaths considered. Enemy composition, target count,
                  talents, and gear are not matched here.
                </p>
                {suggestions.map((suggestion) => (
                  <button
                    className="review-button"
                    key={suggestion.pull.id}
                    onClick={() => {
                      chooseReference(suggestion.pull.id);
                      setOffset(0);
                    }}
                  >
                    Compare {pullLabel(suggestion.pull)}
                    <span>{suggestion.reasons.join(' · ')}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
          {evidence && !referencePull && (
            <p className="coach-empty">
              {!evidence.pulls.length
                ? 'This reference log has no pull boundaries. Choose another reference player.'
                : 'No unique same-boss match. Choose the reference pull explicitly; check enemies and pull duration before interpreting the differences.'}
            </p>
          )}
          {pair && targetPull && referencePull && (
            <>
              <p className="pair-context">
                {pairedBoss
                  ? 'Same boss encounter ID.'
                  : 'Manually paired pulls; enemy composition and target counts are not verified.'}{' '}
                Your pull: {fmt(targetPull.end - targetPull.start)}s. Reference:{' '}
                {fmt(referencePull.end - referencePull.start)}s. Only their
                shared duration is compared; the longer tail is excluded.
              </p>
              {!pair.complete && (
                <output className="data-availability">
                  One or both cast streams are incomplete. These are partial
                  observations; zero counts do not prove a spell was unused and
                  difference summaries are disabled.
                </output>
              )}
              <div className="rotation-window-controls">
                <label>
                  Window length
                  <select
                    className="coach-select"
                    aria-label="Comparison window length"
                    value={windowSize}
                    onChange={(event) => {
                      setWindowSize(Number(event.target.value));
                      setOffset(0);
                    }}
                  >
                    <option value={10}>10 seconds · spell order</option>
                    <option value={30}>30 seconds · opener / burst</option>
                    <option value={60}>60 seconds · cooldown rhythm</option>
                  </select>
                </label>
                <label>
                  Jump to a window
                  <select
                    className="coach-select"
                    aria-label="Comparison time window"
                    value={pair.offset}
                    disabled={!pair.commonDuration}
                    onChange={(event) => setOffset(Number(event.target.value))}
                  >
                    {Array.from(
                      {
                        length: Math.max(
                          1,
                          Math.ceil(pair.commonDuration / windowSize),
                        ),
                      },
                      (_, index) => {
                        const start = index * windowSize;
                        return (
                          <option key={start} value={start}>
                            {fmt(start)}–
                            {fmt(
                              Math.min(pair.commonDuration, start + windowSize),
                            )}
                            s after pull start
                          </option>
                        );
                      },
                    )}
                  </select>
                </label>
                <div className="review-paging">
                  <button
                    className="review-button"
                    disabled={pair.offset <= 0}
                    onClick={() =>
                      setOffset(Math.max(0, pair.offset - windowSize))
                    }
                  >
                    Previous
                  </button>
                  <button
                    className="review-button"
                    disabled={pair.end >= pair.commonDuration}
                    onClick={() => setOffset(pair.end)}
                  >
                    Next
                  </button>
                  <button
                    className="review-button"
                    disabled={pair.offset <= 0}
                    onClick={() => setOffset(0)}
                  >
                    Opener
                  </button>
                </div>
              </div>
              <div className="rotation-window-summary" aria-live="polite">
                <strong>
                  {fmt(pair.offset)}–{fmt(pair.end)}s after each pull starts
                </strong>
                <span className="rotation-you">
                  You: {yours.length} visible casts
                </span>
                <span className="rotation-reference">
                  {reference.player}: {theirs.length} visible casts
                </span>
              </div>
              {pair.complete && rows.length > 0 && (
                <div className="pair-observations">
                  <strong>Start with these observed differences</strong>
                  {rows.some(
                    (row) =>
                      row.delta !== 0 || Math.abs(row.firstDelta ?? 0) >= 1,
                  ) ? (
                    <ul>
                      {rows
                        .filter(
                          (row) =>
                            row.delta !== 0 ||
                            Math.abs(row.firstDelta ?? 0) >= 1,
                        )
                        .slice(0, 4)
                        .map((row) => (
                          <li key={row.id}>
                            <Ability
                              id={row.id}
                              name={row.name}
                              icon={row.icon}
                            />
                            <span>
                              You {row.yours.length} / reference{' '}
                              {row.theirs.length} casts.{' '}
                              {timingLabel(row.firstDelta)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p>
                      Visible spells have matching counts and similar first-cast
                      timing. Check order and context before judging execution.
                    </p>
                  )}
                  <p>
                    These are comparisons, not missed-cast counts. Resources,
                    proc state, enemy targets, assignments, and cooldown
                    readiness can explain the difference.
                  </p>
                </div>
              )}
              <CastComparisonWindow
                yours={yours}
                theirs={theirs}
                start={pair.offset}
                end={pair.end}
                referenceName={reference.player}
                complete={pair.complete}
              />
              <div className="rotation-source-links">
                <a
                  className="coach-link"
                  href={windowUrl(
                    result.target.url,
                    target,
                    targetPull.start + pair.offset,
                    targetPull.start + pair.end,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Verify your window in WCL
                </a>
                <a
                  className="coach-link"
                  href={windowUrl(
                    reference.url,
                    evidence!,
                    referencePull.start + pair.offset,
                    referencePull.start + pair.end,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Verify reference window in WCL
                </a>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function pullLabel(pull: PullEvidence) {
  return (
    '#' +
    pull.id +
    ' ' +
    pull.name +
    (pull.boss ? ' (boss)' : ' (trash)') +
    ' - ' +
    fmt(pull.end - pull.start) +
    's'
  );
}
function windowUrl(
  url: string,
  evidence: RunEvidence,
  start: number,
  end: number,
) {
  return (
    url +
    '&type=casts&start=' +
    Math.round(evidence.reportStart + start * 1000) +
    '&end=' +
    Math.round(evidence.reportStart + end * 1000)
  );
}
function CastTrack({
  casts,
  start,
  end,
  label,
  reference = false,
}: {
  casts: CastEvent[];
  start: number;
  end: number;
  label: string;
  reference?: boolean;
}) {
  return (
    <Tooltip.Provider delay={120}>
      <div
        className={'comparison-cast-track ' + (reference ? 'reference' : '')}
        aria-label={label + ' cast times'}
      >
        <small>{reference ? 'Ref' : 'You'}</small>
        <div>
          {casts.map((cast, i) => (
            <CastMarker
              key={i}
              label={
                label +
                ': ' +
                cast.name +
                ' at ' +
                cast.time.toFixed(2) +
                's after pull start'
              }
              position={Math.max(
                0,
                Math.min(
                  100,
                  ((cast.time - start) / Math.max(0.01, end - start)) * 100,
                ),
              )}
            />
          ))}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
function CastMarker({ label, position }: { label: string; position: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger
        type="button"
        aria-label={label}
        closeOnClick={false}
        onClick={() => setOpen(true)}
        style={{ left: position + '%' }}
      />
      <Tooltip.Portal>
        <Tooltip.Positioner
          className="metric-tooltip-positioner"
          sideOffset={8}
        >
          <Tooltip.Popup className="metric-tooltip cast-tooltip">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
function timingLabel(delta: number | null) {
  if (delta === null)
    return 'Only one player used this ability in this window.';
  if (Math.abs(delta) < 0.005) return 'First casts at the same time.';
  return (
    'Your first cast: ' +
    Math.abs(delta).toFixed(2) +
    's ' +
    (delta > 0 ? 'later.' : 'earlier.')
  );
}

export function CastComparisonWindow({
  yours,
  theirs,
  start,
  end,
  referenceName,
  complete,
}: {
  yours: CastEvent[];
  theirs: CastEvent[];
  start: number;
  end: number;
  referenceName: string;
  complete: boolean;
}) {
  const [view, setView] = useState<'abilities' | 'sequence'>('sequence');
  const rows = compareCastWindow(yours, theirs);
  const sequence = mergedCastSequence(yours, theirs);
  return (
    <div className="rotation-window-review">
      <fieldset
        className="rotation-view-controls"
        aria-label="Cast comparison view"
      >
        <button
          className="review-button"
          aria-pressed={view === 'sequence'}
          onClick={() => setView('sequence')}
        >
          Spell order · shared clock
        </button>
        <button
          className="review-button"
          aria-pressed={view === 'abilities'}
          onClick={() => setView('abilities')}
        >
          Ability counts & timing
        </button>
      </fieldset>
      {view === 'sequence' ? (
        <>
          <p className="coach-footnote">
            Read down by time. Empty cells mean no matching cast at that
            timestamp. Spells on different rows are not paired actions. Times
            are completed casts after each pull began.
          </p>
          <div className="coach-table-wrap rotation-sequence-scroll">
            <table className="coach-table rotation-chronological">
              <thead>
                <tr>
                  <th>Time after start</th>
                  <th className="rotation-you">You</th>
                  <th className="rotation-reference">{referenceName}</th>
                </tr>
              </thead>
              <tbody>
                {sequence.map((row) => (
                  <tr key={row.time}>
                    <th scope="row">
                      <time>{row.time.toFixed(2)}s</time>
                    </th>
                    <td>
                      {row.yours.length ? (
                        row.yours.map((cast, index) => (
                          <SequenceAbility key={index} cast={cast} />
                        ))
                      ) : (
                        <span
                          className="rotation-no-cast"
                          aria-label="No cast at this time"
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      {row.theirs.length ? (
                        row.theirs.map((cast, index) => (
                          <SequenceAbility key={index} cast={cast} />
                        ))
                      ) : (
                        <span
                          className="rotation-no-cast"
                          aria-label="No cast at this time"
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className="coach-footnote">
            Each ability gets two tracks on the same time scale. First-cast
            timing is within this window, not necessarily the opener. Hover,
            focus, or tap a mark for its timestamp.
          </p>
          <div className="coach-table-wrap">
            <table className="coach-table timing-differences">
              <thead>
                <tr>
                  <th>Ability</th>
                  <th>You</th>
                  <th>{referenceName}</th>
                  <th>First-cast difference</th>
                  <th>
                    <span>Time after pull start</span>
                    <div className="rotation-time-ruler">
                      <span>{fmt(start)}s</span>
                      <span>{fmt((start + end) / 2)}s</span>
                      <span>{fmt(end)}s</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Ability id={row.id} name={row.name} icon={row.icon} />
                    </td>
                    <td className="rotation-you">
                      {row.yours.length}
                      {!complete ? ' observed' : ''}
                    </td>
                    <td className="rotation-reference">
                      {row.theirs.length}
                      {!complete ? ' observed' : ''}
                    </td>
                    <td>
                      {complete
                        ? timingLabel(row.firstDelta)
                        : 'Partial cast stream'}
                    </td>
                    <td>
                      <CastTrack
                        casts={row.yours}
                        start={start}
                        end={end}
                        label="You"
                      />
                      <CastTrack
                        casts={row.theirs}
                        start={start}
                        end={end}
                        label={referenceName}
                        reference
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!rows.length && (
        <p className="coach-empty">
          No matching casts in this window. Clear the spell filter or move to
          another window.
        </p>
      )}
      <p className="coach-footnote">
        Pre-pull casts and precast buffs are outside this comparison.{' '}
        {complete
          ? ''
          : 'Both views show only the events available; an empty cell does not prove an ability was unused.'}
      </p>
    </div>
  );
}

function SequenceAbility({ cast }: { cast: CastEvent }) {
  return (
    <div className="rotation-sequence-ability">
      <Ability
        id={cast.id}
        name={cast.name}
        icon={cast.icon}
        detail={
          'Completed at ' +
          cast.time.toFixed(2) +
          's after pull start.' +
          (cast.beganAt === undefined
            ? ''
            : ' Began at ' + cast.beganAt.toFixed(2) + 's.')
        }
      />
    </div>
  );
}
