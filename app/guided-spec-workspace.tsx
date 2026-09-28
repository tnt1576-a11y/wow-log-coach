'use client';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Info,
  RefreshCw,
  Settings2,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { AnalysisResult, ReferenceRun, RunEvidence } from '@/lib/domain';
import type { ReviewFocus } from '@/lib/defensives';
import { buildDiagnosis } from '@/lib/diagnosis';
import type {
  GuideCheck,
  GuideLesson,
  GuidedSpecPack,
} from '@/lib/guides/types';
import { castDecisionTime, momentSequence } from '@/lib/cast-sequence';
import { matchingBoss } from '@/lib/rotation-comparison';
import { referenceKey } from '@/lib/reference-selection';
import { CoachDialog } from './coach-dialog';
import { GameIcon, compact, timestamp } from './coaching-report';
import { useReferenceEvidence } from './use-reference-evidence';
import { ProcWindowComparison } from './proc-window-comparison';
import { GuideBuildComparison } from './guide-build-comparison';
import { ObservedDecisionExplorer } from './observed-decision-explorer';
import { MethodGuidePanel } from './method-guide-panel';

function reviewReference(
  result: AnalysisResult,
  reference: ReferenceRun,
  evidence: RunEvidence,
  pack: GuidedSpecPack,
) {
  if (
    !reference.metrics ||
    reference.className !== pack.className ||
    reference.specName !== pack.specName
  )
    return null;
  return pack.review({
    ...result,
    target: {
      ...result.target,
      player: reference.player,
      reportCode: reference.reportCode,
      fightId: reference.fightId,
      sourceId: reference.sourceId ?? 0,
    },
    targetMetrics: reference.metrics,
    evidence,
  });
}

function GuidedReference({
  result,
  lesson,
  time,
  pack,
}: {
  result: AnalysisResult;
  lesson: Pick<GuideLesson, 'id' | 'spellId' | 'check'>;
  time: number;
  pack: GuidedSpecPack;
}) {
  const [selected, setSelected] = useState(
    result.references[0] ? referenceKey(result.references[0]) : '',
  );
  const [manualPull, setManualPull] = useState<number>();
  const [chosenDecision, setChosenDecision] = useState<{
    context: string;
    time: number;
  }>();
  const reference = result.references.find(
    (run) => referenceKey(run) === selected,
  );
  const { evidence, error, retry, unavailable } = useReferenceEvidence(
    result,
    reference,
  );
  const review = useMemo(
    () =>
      reference && evidence
        ? reviewReference(result, reference, evidence, pack)
        : null,
    [result, reference, evidence, pack],
  );
  const check = review?.checks.find((entry) => entry.id === lesson.id);
  const available = Boolean(
    check && check.status !== 'unavailable' && check.eligible > 0,
  );
  const yourRate =
    lesson.check.moments.length / Math.max(1, lesson.check.eligible);
  const refRate = available ? check!.moments.length / check!.eligible : null;
  const yourPull = result.evidence?.pulls.find(
    (entry) => time >= entry.start && time < entry.end,
  );
  const automatic = matchingBoss(yourPull, evidence?.pulls ?? []);
  const refPull =
    evidence?.pulls.find((entry) => entry.id === manualPull) ?? automatic;
  const decisionContext =
    selected + ':' + lesson.id + ':' + time + ':' + refPull?.id;
  const refDecisions =
    check?.decisions?.filter(
      (decision) =>
        refPull &&
        decision.time >= refPull.start &&
        decision.time < refPull.end,
    ) ?? [];
  const refDecision =
    (chosenDecision?.context === decisionContext
      ? refDecisions.find((decision) => decision.time === chosenDecision.time)
      : undefined) ?? refDecisions[0];
  const anchor = refDecision
    ? evidence?.casts.find(
        (cast) =>
          cast.id === refDecision.spellId &&
          castDecisionTime(cast) === refDecision.time,
      )
    : check?.decisions
      ? undefined
      : evidence?.casts.find(
          (cast) =>
            cast.id === lesson.spellId &&
            refPull &&
            castDecisionTime(cast) >= refPull.start &&
            castDecisionTime(cast) < refPull.end,
        );
  const sequence = anchor
    ? momentSequence(evidence, castDecisionTime(anchor), anchor.id)
    : [];
  return (
    <section className="training-reference">
      <div className="training-reference-heading">
        <span className="training-row-label">
          <i /> WHAT A TOP {pack.specName.toUpperCase()} PARSE DOES
        </span>
        <label>
          <span className="sr-only">Reference player</span>
          <select
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setManualPull(undefined);
            }}
          >
            {result.references.map((run, index) => (
              <option key={referenceKey(run)} value={referenceKey(run)}>
                #{index + 1} {run.player} · {compact(run.rankingDps ?? run.dps)}{' '}
                DPS
              </option>
            ))}
          </select>
        </label>
      </div>
      {!reference && <p className="training-note">No eligible reference.</p>}
      {reference && !evidence && (
        <output className="training-reference-loading">
          {unavailable || error || 'Loading reference decisions...'}
          {error && (
            <button className="training-button" onClick={retry}>
              <RefreshCw size={14} /> Retry
            </button>
          )}
        </output>
      )}
      {reference && (
        <GuideBuildComparison
          key={selected}
          yours={result.targetMetrics.character}
          theirs={reference.metrics?.character}
          referenceName={reference.player}
        />
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
                <span>{reference?.player ?? 'Reference'}</span>
                <i aria-hidden="true">
                  <b style={{ width: refRate! * 100 + '%' }} />
                </i>
                <strong>
                  {check!.moments.length}/{check!.eligible}
                </strong>
              </div>
              <small>
                Same rule and eligible decisions; lower is not automatically
                better.
              </small>
              {refRate !== null &&
                refRate >= yourRate &&
                check!.eligible >= 3 && (
                  <p className="training-pattern-warning">
                    This top parse shows the pattern at least as often. Check
                    talents, route and mechanics before treating it as your
                    damage problem.
                  </p>
                )}
            </div>
          ) : (
            <p className="training-note">
              This check cannot be fairly assessed for the reference because its
              evidence or eligible decisions differ.
            </p>
          )}
          <details className="training-reference-example">
            <summary>
              Inspect their actual spell sequence <ChevronDown size={16} />
            </summary>
            <label className="training-field">
              Reference pull
              <select
                value={refPull?.id ?? ''}
                onChange={(event) => setManualPull(Number(event.target.value))}
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
            {check?.decisions && (
              <label className="training-field">
                Reference decision
                <select
                  value={refDecision?.time ?? ''}
                  onChange={(event) =>
                    setChosenDecision({
                      context: decisionContext,
                      time: Number(event.target.value),
                    })
                  }
                >
                  <option value="">Choose an assessed decision</option>
                  {refDecisions.map((decision, index) => (
                    <option
                      key={decision.time + ':' + index}
                      value={decision.time}
                    >
                      {timestamp(decision.time)} ·{' '}
                      {evidence.casts.find(
                        (cast) =>
                          cast.id === decision.spellId &&
                          castDecisionTime(cast) === decision.time,
                      )?.name ?? 'Recorded cast'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {refDecision && (
              <p className="training-observation">{refDecision.detail}</p>
            )}
            {lesson.check.procWindows && result.evidence ? (
              <ProcWindowComparison
                key={
                  selected + ':' + lesson.id + ':' + time + ':' + refPull?.id
                }
                yourCheck={lesson.check}
                referenceCheck={check}
                time={time}
                yourEvidence={result.evidence}
                referenceEvidence={evidence}
                pullId={refPull?.id}
                referenceName={reference?.player ?? 'Reference'}
              />
            ) : sequence.length > 0 ? (
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
            ) : (
              <p className="training-note">
                No matching anchor spell was recorded in this reference pull.
              </p>
            )}
            <small>A recorded example, not proof every cast was optimal.</small>
          </details>
        </>
      )}
    </section>
  );
}

export function ObservedProcExplorer({
  result,
  pack,
  checks,
}: {
  result: AnalysisResult;
  pack: GuidedSpecPack;
  checks: GuideCheck[];
}) {
  const [opened, setOpened] = useState(false);
  const [chosenCheck, setChosenCheck] = useState('');
  const [chosenWindow, setChosenWindow] = useState('');
  const options = checks.filter(
    (check) =>
      check.status === 'observed' &&
      check.eligible > 0 &&
      check.procWindows?.length,
  );
  const check = options.find((item) => item.id === chosenCheck) ?? options[0];
  const windows = check?.procWindows ?? [];
  const window =
    windows.find((item) => String(item.start) === chosenWindow) ?? windows[0];
  if (!check || !window) return null;
  return (
    <section
      className="training-lesson"
      aria-label="Study windows without flags"
    >
      <h3>No flags? You can still compare decisions</h3>
      <p className="training-note">
        A matching follow-up was recorded in these buff windows. Compare what
        filled the window and the first follow-up with a DPS-selected reference.
        No flag does not mean an optimal rotation; faster is not always better.
      </p>
      <button
        className="training-button"
        aria-expanded={opened}
        onClick={() => setOpened(!opened)}
      >
        {opened ? 'Close recorded windows' : 'Compare recorded windows'}
      </button>
      {opened && (
        <>
          <label className="training-field">
            Proc to compare
            <select
              value={check.id}
              onChange={(event) => {
                setChosenCheck(event.target.value);
                setChosenWindow('');
              }}
            >
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.eligible} windows)
                </option>
              ))}
            </select>
          </label>
          <label className="training-field">
            Your buff window
            <select
              value={String(window.start)}
              onChange={(event) => setChosenWindow(event.target.value)}
            >
              {windows.map((item) => (
                <option key={item.start} value={String(item.start)}>
                  {timestamp(item.start)} - {timestamp(item.end)} ·{' '}
                  {result.evidence?.pulls.find(
                    (pull) => pull.id === item.pullId,
                  )?.name ?? 'Recorded pull'}
                </option>
              ))}
            </select>
          </label>
          <p className="training-note">{check.detail}</p>
          <GuidedReference
            key={check.id + ':' + window.start}
            result={result}
            pack={pack}
            time={window.end}
            lesson={{ id: check.id, check, spellId: window.consumer?.id ?? 0 }}
          />
        </>
      )}
    </section>
  );
}

export function GuidedSpecCoach({
  lessonFocus,
  result,
  pack,
  onReview,
  onNavigate,
}: {
  result: AnalysisResult;
  lessonFocus?: { id: string; request: number };
  pack: GuidedSpecPack;
  onReview: (focus: ReviewFocus) => void;
  onNavigate: (tab: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(lessonFocus?.id ?? '');
  const [momentIndex, setMomentIndex] = useState(0);
  const [appliedFocus, setAppliedFocus] = useState(lessonFocus);
  if (lessonFocus !== appliedFocus) {
    setAppliedFocus(lessonFocus);
    if (lessonFocus) {
      setSelectedId(lessonFocus.id);
      setMomentIndex(0);
    }
  }
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [pinned, setPinned] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const review = useMemo(() => pack.review(result), [pack, result]);
  const diagnosis = useMemo(() => buildDiagnosis(result), [result]);
  const lesson =
    review.lessons.find((item) => item.id === selectedId) ?? review.lessons[0];
  const currentMomentIndex = Math.max(
    0,
    Math.min(momentIndex, (lesson?.check.moments.length ?? 1) - 1),
  );
  const moment = lesson?.check.moments[currentMomentIndex];
  const sequence = moment
    ? momentSequence(result.evidence, moment.time, moment.spellId)
    : [];
  const practice = review.lessons.find((item) => item.id === pinned);
  const disabled = review.checks.filter(
    (item) => item.status === 'unavailable',
  );
  const ability = (id: number) =>
    result.targetMetrics.casts?.find((item) => item.id === id) ??
    result.targetMetrics.buffs?.find((item) => item.id === id) ??
    result.evidence?.casts.find((item) => item.id === id);
  function selectLesson(item: GuideLesson) {
    setSelectedId(item.id);
    setMomentIndex(0);
    setCopyStatus('');
  }
  async function copyPractice() {
    if (!practice) return;
    const text = [
      result.target.player + ' - next key ' + pack.specName + ' focus',
      practice.title,
      'Try: ' + practice.tryNext,
      'Check first: ' + practice.verify,
      'Based on ' +
        practice.check.moments.length +
        ' review observations, not measured DPS loss.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Clipboard unavailable. Select the plan text to copy it.');
    }
  }
  return (
    <div
      className={
        'training-workspace guided-spec-workspace ' + pack.slug + '-workspace'
      }
    >
      <div className="training-toolbar">
        <div className="training-heading">
          <span className="training-eyebrow">
            {pack.specName.toUpperCase()} GUIDE
          </span>
          <h2>Your next {pack.specName} improvement</h2>
        </div>
        <CoachDialog
          label={
            <>
              <Settings2 size={16} /> Evidence &amp; guide
            </>
          }
          title={'What the ' + pack.specName + ' coach can establish'}
          description="Each flag is a decision to inspect, not estimated lost damage."
        >
          <p>
            Based on{' '}
            <a href={pack.source.url} target="_blank" rel="noreferrer">
              {pack.source.url.includes('method.gg') ? 'Method' : 'Icy Veins'}:{' '}
              {pack.specName}
            </a>{' '}
            for patch {pack.source.patch}; reviewed {pack.source.reviewed}.
          </p>
          <ul className="training-guide-notes">
            {pack.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="training-note">{pack.limitation}</p>
          <div className="training-coverage">
            {review.checks.map((check) => (
              <details key={check.id}>
                <summary>
                  {check.title}
                  <span>
                    {check.status === 'review'
                      ? check.moments.length + ' to review'
                      : check.status === 'observed'
                        ? 'No flags'
                        : check.status === 'not-applicable'
                          ? 'Not observed'
                          : 'Cannot assess'}
                  </span>
                </summary>
                <p>{check.detail}</p>
              </details>
            ))}
          </div>
        </CoachDialog>
      </div>

      <MethodGuidePanel result={result} />
      <div className="training-score-strip">
        <div>
          <span>Your full-run DPS</span>
          <strong>{compact(result.targetMetrics.dps)}</strong>
        </div>
        <div>
          <span>Reference median</span>
          <strong>
            {diagnosis.overall?.sampleSize
              ? compact(diagnosis.overall.median)
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <span>Observed difference</span>
          <strong>
            {diagnosis.deficit === null || !diagnosis.sufficient
              ? 'Need more logs'
              : (diagnosis.deficit > 0 ? '-' : '+') +
                Math.abs(diagnosis.deficit).toFixed(1) +
                '%'}
          </strong>
        </div>
        <div className="training-score-caption">
          <span>{result.cohort.actualSize} DPS-selected references</span>
          <small>The gap is context, not automatically recoverable.</small>
        </div>
      </div>

      <section className="arcane-patterns" aria-label="Guide pattern summary">
        <header>
          <div>
            <span className="training-eyebrow">DECISION CHECKS</span>
            <h3>What the log can verify from your {pack.specName} play</h3>
          </div>
          <small>Hover for the rule; open a flag for exact casts.</small>
        </header>
        <div className="arcane-pattern-grid guided-pattern-grid">
          {review.checks.map((check) => {
            const item = review.lessons.find((entry) => entry.id === check.id);
            return (
              <button
                type="button"
                key={check.id}
                data-status={check.status}
                aria-disabled={!item}
                title={check.detail}
                onClick={() => item && selectLesson(item)}
              >
                <span>{check.title}</span>
                <strong>
                  {check.status === 'review'
                    ? check.moments.length + ' moments to review'
                    : check.status === 'observed'
                      ? 'No pattern flags'
                      : check.status === 'not-applicable'
                        ? 'Not observed'
                        : 'Not enough evidence'}
                </strong>
                <small>
                  {check.eligible
                    ? check.eligible + ' eligible decisions'
                    : 'Hover for the evidence rule'}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="fire-window-review guided-summary-review">
        <header>
          <div>
            <span className="training-eyebrow">RUN SNAPSHOT</span>
            <h3>Proc and cooldown evidence at a glance</h3>
          </div>
          <small>Observed events, not a simulation.</small>
        </header>
        <div>
          {review.summaries.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </div>
      </section>

      {(!review.seasonMatches ||
        !review.castCoverage ||
        !review.stateCoverage) && (
        <div className="training-alert">
          <Info size={18} />
          <p>
            {!review.seasonMatches
              ? 'Guide checks need the supported Season 2 analysis.'
              : !review.castCoverage
                ? 'Cast events are incomplete; coaching is unavailable.'
                : pack.specName +
                  ' self-buff events are incomplete; state checks are unavailable.'}{' '}
            Re-analyze to request current evidence.
          </p>
        </div>
      )}

      <div className="training-desk">
        <aside className="training-focus-list">
          <div className="training-section-label">
            <span>REVIEW FOCUS</span>
            <small>
              {reviewed.length}/{review.lessons.length} reviewed
            </small>
          </div>
          {review.lessons.map((item) => (
            <button
              className="training-focus"
              data-selected={item.id === lesson?.id}
              key={item.id}
              onClick={() => selectLesson(item)}
            >
              <GameIcon
                name={ability(item.spellId)?.name ?? item.short}
                icon={ability(item.spellId)?.icon}
              />
              <span>
                <strong>{item.short}</strong>
                <small>
                  {item.check.moments.length} moments · {item.check.eligible}{' '}
                  assessed
                </small>
              </span>
              {reviewed.includes(item.id) ? (
                <Check size={17} className="training-good" />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>
          ))}
          {!review.lessons.length && (
            <p className="training-empty">
              No specific {pack.specName} pattern was flagged. That does not
              certify an optimal rotation; compare spell output and defensives
              next.
            </p>
          )}
          <p className="training-side-note">
            Repeated review patterns first, not a damage-loss ranking.
          </p>
          <button
            className="training-secondary-link"
            onClick={() => onNavigate('survival')}
          >
            <Shield size={17} /> Defensives &amp; survival{' '}
            <ArrowRight size={16} />
          </button>
          <button
            className="training-secondary-link"
            onClick={() => onNavigate('coaching')}
          >
            <Sparkles size={17} /> Explore the damage gap{' '}
            <ArrowRight size={16} />
          </button>
        </aside>

        <section className="training-lesson">
          {lesson && moment ? (
            <>
              <div className="training-lesson-heading">
                <div>
                  <span className="training-eyebrow">
                    ONE DECISION AT A TIME
                  </span>
                  <h3>{lesson.title}</h3>
                </div>
                <span className="training-status">Worth reviewing</span>
              </div>
              <p className="training-why">{lesson.why}</p>
              <div className="training-next-action">
                <Crosshair size={23} />
                <div>
                  <span>TRY NEXT KEY</span>
                  <p>{lesson.tryNext}</p>
                </div>
                <button
                  className="training-button"
                  aria-pressed={pinned === lesson.id}
                  onClick={() => {
                    setPinned(lesson.id);
                    setCopyStatus('');
                  }}
                >
                  {pinned === lesson.id ? (
                    <>
                      <Check size={17} /> Focus saved
                    </>
                  ) : (
                    'Set my focus'
                  )}
                </button>
              </div>
              <div className="training-verify">
                <Info size={16} />
                <p>{lesson.verify}</p>
              </div>
              <div className="training-moment-controls">
                <div>
                  <b>{timestamp(moment.time)}</b>
                  <span>
                    {result.evidence?.pulls.find(
                      (pull) =>
                        moment.time >= pull.start && moment.time < pull.end,
                    )?.name ?? 'Recorded moment'}
                  </span>
                </div>
                <div className="training-pager">
                  <button
                    aria-label="Previous review moment"
                    disabled={currentMomentIndex <= 0}
                    onClick={() => setMomentIndex(currentMomentIndex - 1)}
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <label>
                    <span className="sr-only">Review moment</span>
                    <select
                      value={currentMomentIndex}
                      onChange={(event) =>
                        setMomentIndex(Number(event.target.value))
                      }
                    >
                      {lesson.check.moments.map((entry, index) => (
                        <option value={index} key={entry.time + ':' + index}>
                          {index + 1} / {lesson.check.moments.length} ·{' '}
                          {timestamp(entry.time)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    aria-label="Next review moment"
                    disabled={
                      currentMomentIndex >= lesson.check.moments.length - 1
                    }
                    onClick={() => setMomentIndex(currentMomentIndex + 1)}
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              </div>
              <div className="training-replay">
                <span className="training-row-label">
                  <i /> YOUR RECORDED CASTS
                </span>
                <div className="training-spell-sequence">
                  {sequence.map((cast, index) => (
                    <div
                      className="training-spell-step"
                      data-focus={
                        cast.id === moment.spellId &&
                        Math.abs(castDecisionTime(cast) - moment.time) < 0.3
                      }
                      key={cast.time + ':' + index}
                    >
                      <GameIcon
                        id={cast.id}
                        name={cast.name}
                        icon={cast.icon}
                      />
                      <strong>{cast.name}</strong>
                      <small>
                        {(castDecisionTime(cast) - moment.time >= 0
                          ? '+'
                          : '') +
                          (castDecisionTime(cast) - moment.time).toFixed(1)}
                        s
                      </small>
                    </div>
                  ))}
                </div>
                <p className="training-observation">{moment.detail}</p>
              </div>
              {lesson.sequence && (
                <div className="training-guide-sequence">
                  <span className="training-row-label">
                    <i /> GUIDE PATTERN TO CHECK
                  </span>
                  <div>
                    {lesson.sequence.map((id, index) => (
                      <span
                        className="training-guide-spell"
                        key={id + ':' + index}
                      >
                        <GameIcon
                          name={
                            ability(id)?.name ??
                            lesson.spellLabels?.[id] ??
                            'Spell ' + id
                          }
                          icon={ability(id)?.icon}
                        />
                        <b>
                          {ability(id)?.name ??
                            lesson.spellLabels?.[id] ??
                            'Spell ' + id}
                        </b>
                        {index < lesson.sequence!.length - 1 && (
                          <ArrowRight size={18} />
                        )}
                      </span>
                    ))}
                  </div>
                  <small>
                    Guide illustration, not a fixed rotation for every pull.
                  </small>
                </div>
              )}
              <GuidedReference
                result={result}
                lesson={{ ...lesson, spellId: moment.spellId }}
                time={moment.time}
                pack={pack}
              />
              <div className="training-lesson-actions">
                <button
                  className="training-button training-primary"
                  onClick={() =>
                    onReview({ time: moment.time, spellId: moment.spellId })
                  }
                >
                  Open full comparison <ArrowRight size={17} />
                </button>
                <button
                  className="training-button"
                  aria-pressed={reviewed.includes(lesson.id)}
                  onClick={() =>
                    setReviewed((value) =>
                      value.includes(lesson.id)
                        ? value.filter((id) => id !== lesson.id)
                        : [...value, lesson.id],
                    )
                  }
                >
                  <Check size={16} />{' '}
                  {reviewed.includes(lesson.id) ? 'Reviewed' : 'Mark reviewed'}
                </button>
              </div>
            </>
          ) : (
            <div className="training-no-lesson">
              <Crosshair size={34} />
              <h3>Continue with the damage gap</h3>
              <p>
                {disabled.length
                  ? disabled.length +
                    ' checks need more evidence. Open Evidence & guide to see what is missing.'
                  : 'No sequence flags were found. Compare spell output, pull usage and defensive timing next.'}
              </p>
              <button
                className="training-button training-primary"
                onClick={() => onNavigate('coaching')}
              >
                Explore the damage gap <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
      </div>

      <ObservedProcExplorer
        result={result}
        pack={pack}
        checks={review.checks}
      />

      <ObservedDecisionExplorer
        evidence={result.evidence}
        checks={review.checks}
        renderReference={(check, decision) => (
          <GuidedReference
            result={result}
            pack={pack}
            lesson={{ id: check.id, check, spellId: decision.spellId }}
            time={decision.time}
          />
        )}
      />
      {practice && (
        <section className="training-practice">
          <div>
            <span className="training-eyebrow">
              TAKE ONE THING INTO YOUR NEXT KEY
            </span>
            <h3>{practice.title}</h3>
            <p>{practice.tryNext}</p>
          </div>
          <button className="training-button" onClick={copyPractice}>
            <Copy size={16} />{' '}
            {copyStatus === 'Copied' ? 'Copied' : 'Copy practice plan'}
          </button>
          {copyStatus && copyStatus !== 'Copied' && <small>{copyStatus}</small>}
        </section>
      )}
    </div>
  );
}
