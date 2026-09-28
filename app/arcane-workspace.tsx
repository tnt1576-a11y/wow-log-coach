'use client';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Info,
  Settings2,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { AnalysisResult } from '@/lib/domain';
import type { ReviewFocus } from '@/lib/defensives';
import {
  ARCANE_GUIDE,
  ARCANE_TALENTS,
  type BuildOverrides,
} from '@/lib/arcane/catalog';
import { arcaneGuideBranches } from '@/lib/arcane/review';
import {
  arcaneLessons,
  castDecisionTime,
  momentSequence,
  practiceText,
  type ArcaneLesson,
} from '@/lib/arcane/lessons';
import { buildDiagnosis } from '@/lib/diagnosis';
import { GameIcon, compact, timestamp } from './coaching-report';
import { CoachDialog } from './coach-dialog';
import { ArcaneReference } from './arcane-reference';
import { ObservedDecisionExplorer } from './observed-decision-explorer';
import { MethodGuidePanel } from './method-guide-panel';
import { MomentInsight } from './moment-insight';
import { ArcaneBurstReview } from './arcane-burst-review';

export function ArcaneCoach({
  lessonFocus,
  result,
  onReview,
  onNavigate,
}: {
  result: AnalysisResult;
  lessonFocus?: { id: string; request: number };
  onReview: (focus: ReviewFocus) => void;
  onNavigate?: (tab: string) => void;
}) {
  const [overrides, setOverrides] = useState<BuildOverrides>({});
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
  const [scenario, setScenario] = useState<'single' | 'aoe'>('single');
  const review = useMemo(
    () => arcaneLessons(result, overrides),
    [result, overrides],
  );
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
  const unknown = Object.values(review.build.talents).filter(
    (item) => item.value === null,
  ).length;
  const completed = review.lessons.filter((item) =>
    reviewed.includes(item.id),
  ).length;
  const disabled = review.checks.filter(
    (item) => item.status === 'unavailable',
  );
  const patternChecks = [
    'burst-sequence',
    'touch-cadence',
    'touch-order',
    'missiles-salvo',
  ]
    .map((id) => review.checks.find((check) => check.id === id))
    .filter((check) => check !== undefined);
  const ability = (id: number) =>
    result.targetMetrics.casts?.find((item) => item.id === id) ??
    result.evidence?.casts.find((item) => item.id === id);
  function selectLesson(item: ArcaneLesson) {
    setSelectedId(item.id);
    setMomentIndex(0);
    setCopyStatus('');
  }
  async function copyPractice() {
    if (!practice) return;
    try {
      await navigator.clipboard.writeText(
        practiceText(result.target.player, practice),
      );
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Clipboard unavailable. Select the plan text to copy it.');
    }
  }
  return (
    <div className="training-workspace">
      <div className="training-toolbar">
        <div className="training-heading">
          <span className="training-eyebrow">ARCANE COACH</span>
          <h2>Your next improvement</h2>
        </div>
        <div className="training-toolbar-actions">
          <CoachDialog
            label={
              <>
                <Settings2 size={16} />{' '}
                {review.build.hero.value === 'unknown'
                  ? 'Check build'
                  : review.build.hero.value}{' '}
                <span className="training-count">{unknown} unknown</span>
              </>
            }
            title="Your build for this run"
            description="Use the talents equipped during this log. A missing talent record is unknown, not unselected."
          >
            <p className="training-note">
              {review.build.loggedTalentCount
                ? review.build.loggedTalentCount +
                  ' explicit learned-talent records.'
                : 'No full learned-talent snapshot is available.'}{' '}
              Effects provide partial evidence.
            </p>
            <label className="training-field">
              Hero tree
              <select
                value={overrides.hero ?? 'auto'}
                onChange={(event) =>
                  setOverrides((value) => ({
                    ...value,
                    hero: event.target.value as BuildOverrides['hero'],
                  }))
                }
              >
                <option value="auto">Use log evidence</option>
                <option value="Sunfury">Confirm Sunfury</option>
                <option value="Spellslinger">Confirm Spellslinger</option>
              </select>
              <small>
                {review.build.hero.value} &middot; {review.build.hero.source}
              </small>
            </label>
            <div className="training-talent-grid">
              {ARCANE_TALENTS.map((talent) => (
                <label className="training-field" key={talent.key}>
                  {talent.label}
                  <select
                    value={overrides[talent.key] ?? 'auto'}
                    onChange={(event) =>
                      setOverrides((value) => ({
                        ...value,
                        [talent.key]: event.target.value,
                      }))
                    }
                  >
                    <option value="auto">Use log evidence</option>
                    <option value="yes">Confirm present in this run</option>
                    <option value="no">Confirm absent in this run</option>
                  </select>
                  <small
                    data-conflict={
                      review.build.talents[talent.key].source === 'conflict'
                    }
                  >
                    {review.build.talents[talent.key].value === null
                      ? 'Unknown'
                      : review.build.talents[talent.key].value
                        ? 'Present'
                        : 'Absent'}{' '}
                    &middot; {review.build.talents[talent.key].source}
                  </small>
                </label>
              ))}
            </div>
            <p className="training-note">
              Conflicting choices disable affected checks. Confirmations do not
              re-select references; they reset on a new analysis.
            </p>
            <button
              className="training-button"
              onClick={() => setOverrides({})}
            >
              Reset confirmations
            </button>
          </CoachDialog>
          <CoachDialog
            label={
              <>
                <Info size={16} /> Evidence &amp; guide
              </>
            }
            title="What this coach can establish"
            description="Review candidates are not automatically mistakes or recoverable DPS."
          >
            <p>
              Based on{' '}
              <a href={ARCANE_GUIDE.url} target="_blank" rel="noreferrer">
                Method: Arcane Mage
              </a>
              , patch {ARCANE_GUIDE.patch}. Reviewed {ARCANE_GUIDE.reviewed}.
              This is not a complete rotation simulator.
            </p>
            <p className="training-note">
              {result.cohort.heroMatch?.matched
                ? result.cohort.heroMatch.hero + '-matched reference cohort. '
                : 'Reference hero tree was not matched. '}
              Selection uses individual DPS, not key speed. Full talent builds,
              gear, and pull sizes can differ.
            </p>
            <label className="training-field">
              Guide context
              <select
                value={scenario}
                onChange={(event) =>
                  setScenario(event.target.value as 'single' | 'aoe')
                }
              >
                <option value="single">Single target</option>
                <option value="aoe">AoE</option>
              </select>
            </label>
            <ul className="training-guide-notes">
              {arcaneGuideBranches(review.build, scenario).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <h4>Check coverage</h4>
            <div className="training-coverage">
              {review.checks.map((check) => (
                <details key={check.id}>
                  <summary>
                    {check.title}
                    <span>
                      {check.status === 'unavailable'
                        ? 'Cannot assess'
                        : check.status === 'not-applicable'
                          ? 'Not in build'
                          : check.status === 'review'
                            ? check.moments.length + ' to review'
                            : 'No flags'}
                    </span>
                  </summary>
                  <p>{check.detail}</p>
                </details>
              ))}
            </div>
          </CoachDialog>
        </div>
      </div>

      <MethodGuidePanel
        result={result}
        confirmedHero={review.build.hero.value}
      />
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
          <small>
            The gap is context, not all recoverable through rotation.
          </small>
        </div>
      </div>
      <section className="arcane-patterns" aria-label="Arcane pattern summary">
        <header>
          <div>
            <span className="training-eyebrow">ROTATION PATTERN CHECK</span>
            <h3>What the log can verify from your Arcane sequence</h3>
          </div>
          <small>
            Open a flagged pattern to review its exact cast moments.
          </small>
        </header>
        <div className="arcane-pattern-grid">
          {patternChecks.map((check) => {
            const patternLesson = review.lessons.find(
              (item) => item.id === check.id,
            );
            return (
              <button
                key={check.id}
                type="button"
                aria-disabled={!patternLesson}
                data-status={check.status}
                title={check.detail}
                onClick={() => patternLesson && selectLesson(patternLesson)}
              >
                <span>{check.title}</span>
                <strong>
                  {check.status === 'review'
                    ? check.moments.length +
                      ' moment' +
                      (check.moments.length === 1 ? '' : 's') +
                      ' to review'
                    : check.status === 'observed'
                      ? 'No pattern flags'
                      : check.status === 'not-applicable'
                        ? 'Not in this build'
                        : 'Not enough evidence'}
                </strong>
                <small>
                  {check.eligible
                    ? check.eligible +
                      ' eligible decision' +
                      (check.eligible === 1 ? '' : 's')
                    : 'Hover for the evidence rule'}
                </small>
              </button>
            );
          })}
        </div>
      </section>
      {(!review.seasonMatches ||
        !review.castCoverage ||
        !review.buffCoverage) && (
        <div className="training-alert">
          <Info size={18} />
          <p>
            {!review.seasonMatches
              ? 'Guide checks need a supported Season 2 analysis.'
              : !review.castCoverage
                ? 'Cast events are incomplete; some coaching is unavailable.'
                : 'Buff events are incomplete; state-dependent coaching is unavailable.'}{' '}
            Re-analyze to request current evidence.
          </p>
        </div>
      )}

      <ArcaneBurstReview setups={review.burstSetups} onReview={onReview} />
      <div className="training-desk">
        <aside className="training-focus-list">
          <div className="training-section-label">
            <span>REVIEW FOCUS</span>
            <small>
              {completed}/{review.lessons.length} reviewed
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
                id={item.spellId}
                name={ability(item.spellId)?.name ?? item.short}
                icon={ability(item.spellId)?.icon}
              />
              <span>
                <strong>{item.short}</strong>
                <small>
                  {item.check.moments.length} moments &middot;{' '}
                  {item.check.eligible} assessed
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
              No specific guide pattern to review. Explore spell output and
              survivability below; this does not certify an optimal rotation.
            </p>
          )}
          <p className="training-side-note">
            Most repeated patterns first, not a damage-loss ranking.
          </p>
          <button
            className="training-secondary-link"
            onClick={() => onNavigate?.('survival')}
          >
            <Shield size={17} /> Defensives &amp; survival{' '}
            <ArrowRight size={16} />
          </button>
          <button
            className="training-secondary-link"
            onClick={() => onNavigate?.('coaching')}
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
              <MomentInsight
                key={lesson.id + ':' + moment.time}
                result={result}
                moment={moment}
                overrides={overrides}
              />
              <div className="training-next-action">
                <Crosshair size={23} />
                <div>
                  <span>TRY NEXT KEY</span>
                  <p>{lesson.tryNext}</p>
                </div>
                <button
                  className="training-button"
                  aria-label="Set as next-key focus"
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
                          {index + 1} / {lesson.check.moments.length} &middot;{' '}
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
                  {sequence.map((event, index) => (
                    <div
                      className="training-spell-step"
                      data-focus={
                        event.id === moment.spellId &&
                        Math.abs(castDecisionTime(event) - moment.time) < 0.3
                      }
                      key={event.time + ':' + index}
                    >
                      <GameIcon
                        id={event.id}
                        name={event.name}
                        icon={event.icon}
                      />
                      <strong>{event.name}</strong>
                      <small>
                        {(castDecisionTime(event) - moment.time >= 0
                          ? '+'
                          : '') +
                          (castDecisionTime(event) - moment.time).toFixed(1)}
                        s
                      </small>
                    </div>
                  ))}
                </div>
                <small className="training-side-note">
                  Offsets use cast start when logged; otherwise the recorded
                  cast time.
                </small>
                <p className="training-observation">{moment.detail}</p>
              </div>
              {lesson.sequence && (
                <div className="training-guide-sequence">
                  <span className="training-row-label">
                    <i /> GUIDE ORDER TO CHECK
                  </span>
                  <div>
                    {lesson.sequence.map((id, index) => (
                      <span
                        className="training-guide-spell"
                        key={id + ':' + index}
                      >
                        <GameIcon
                          id={id}
                          name={ability(id)?.name ?? 'Spell ' + id}
                          icon={ability(id)?.icon}
                        />
                        <b>{ability(id)?.name ?? 'Spell ' + id}</b>
                        {index < lesson.sequence!.length - 1 && (
                          <ArrowRight size={18} />
                        )}
                      </span>
                    ))}
                  </div>
                  <small>
                    Guide illustration, not a reference player&apos;s recorded
                    casts.
                  </small>
                </div>
              )}
              {moment.salvo !== undefined && (
                <div className="training-salvo">
                  <div>
                    <span>Salvo before Missiles</span>
                    <strong>{moment.salvo}</strong>
                  </div>
                  <div
                    className="training-stack-blocks"
                    aria-label={moment.salvo + ' recorded Salvo stacks'}
                  >
                    {Array.from(
                      {
                        length: review.build.hero.value === 'Sunfury' ? 25 : 20,
                      },
                      (_, index) => (
                        <i
                          key={index}
                          data-filled={index < moment.salvo!}
                          data-threshold={
                            index ===
                            (review.build.hero.value === 'Sunfury' ? 12 : 15)
                          }
                        />
                      ),
                    )}
                  </div>
                  <p>
                    Normal guide Missiles range: below{' '}
                    {review.build.hero.value === 'Sunfury' ? 12 : 15}.
                    Clearcasting was active.
                  </p>
                </div>
              )}
              <ArcaneReference
                result={result}
                lesson={lesson}
                time={moment.time}
                hero={review.build.hero.value}
              />
              <div className="training-lesson-actions">
                <button
                  className="training-button training-primary"
                  onClick={() =>
                    onReview({ time: moment.time, spellId: moment.spellId })
                  }
                >
                  Compare with a top parse <ArrowRight size={17} />
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
              <h3>Start with your spell output</h3>
              <p>
                {disabled.length
                  ? disabled.length +
                    ' guide checks need more evidence. Open Evidence & guide to see what is missing.'
                  : 'No guide-pattern flags were found. Output and defensive comparisons can still reveal useful differences.'}
              </p>
              <button
                className="training-button training-primary"
                onClick={() => onReview({})}
              >
                Compare a top parse <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
      </div>

      <ObservedDecisionExplorer
        evidence={result.evidence}
        checks={review.checks}
        renderReference={(check, decision) => (
          <>
            <MomentInsight
              result={result}
              moment={decision}
              overrides={overrides}
            />
            <ArcaneReference
              result={result}
              lesson={{ id: check.id, check, spellId: decision.spellId }}
              time={decision.time}
              hero={review.build.hero.value}
            />
          </>
        )}
      />

      {practice && (
        <section className="training-practice">
          <div>
            <span className="training-eyebrow">
              TAKE ONE THING INTO YOUR NEXT KEY
            </span>
            <h3>
              {practice?.title ?? 'Choose a focus after reviewing the evidence'}
            </h3>
            <p>
              {practice?.tryNext ??
                'You do not need to change everything at once.'}
            </p>
          </div>
          {practice && (
            <button className="training-button" onClick={copyPractice}>
              <Copy size={16} />{' '}
              {copyStatus === 'Copied' ? 'Copied' : 'Copy practice plan'}
            </button>
          )}
          {copyStatus && (
            <output className="training-copy-status">{copyStatus}</output>
          )}
        </section>
      )}
    </div>
  );
}
