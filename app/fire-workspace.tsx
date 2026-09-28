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
import { buildDiagnosis } from '@/lib/diagnosis';
import { castDecisionTime, momentSequence } from '@/lib/cast-sequence';
import { FIRE, FIRE_GUIDE } from '@/lib/fire/catalog';
import { fireGuideNotes } from '@/lib/fire/review';
import {
  fireLessons,
  firePracticeText,
  type FireLesson,
} from '@/lib/fire/lessons';
import { CoachDialog } from './coach-dialog';
import { FireReference } from './fire-reference';
import { GameIcon, compact, timestamp } from './coaching-report';

export function FireCoach({
  lessonFocus,
  result,
  onReview,
  onNavigate,
}: {
  result: AnalysisResult;
  lessonFocus?: { id: string; request: number };
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
  const [scenario, setScenario] = useState<'single' | 'aoe'>('single');
  const review = useMemo(() => fireLessons(result), [result]);
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
    result.evidence?.casts.find((item) => item.id === id);
  function selectLesson(item: FireLesson) {
    setSelectedId(item.id);
    setMomentIndex(0);
    setCopyStatus('');
  }
  async function copyPractice() {
    if (!practice) return;
    try {
      await navigator.clipboard.writeText(
        firePracticeText(result.target.player, practice),
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
          <span className="training-eyebrow">FIRE GUIDE</span>
          <h2>Your next Fire improvement</h2>
        </div>
        <CoachDialog
          label={
            <>
              <Settings2 size={16} /> Evidence &amp; guide
            </>
          }
          title="What the Fire coach can establish"
          description="A flagged sequence is a question to review, not measured lost damage."
        >
          <p>
            Based on{' '}
            <a href={FIRE_GUIDE.url} target="_blank" rel="noreferrer">
              Icy Veins: Fire Mage
            </a>{' '}
            for patch {FIRE_GUIDE.patch}; reviewed {FIRE_GUIDE.reviewed}.
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
            {fireGuideNotes(scenario, review.meteorObserved).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="training-note">
            Full talent state, charges, projectiles, enemy count and health are
            not reconstructed. Pyroclasm and Hyperthermia are excluded from the
            normal Hot Streak-chain check when their buffs are recorded.
          </p>
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
                        : 'Cannot assess'}
                  </span>
                </summary>
                <p>{check.detail}</p>
              </details>
            ))}
          </div>
        </CoachDialog>
      </div>

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

      <section className="arcane-patterns" aria-label="Fire pattern summary">
        <header>
          <div>
            <span className="training-eyebrow">ROTATION PATTERN CHECK</span>
            <h3>What the log can verify from your Fire sequence</h3>
          </div>
          <small>
            Hover for the evidence rule; open a flag for exact casts.
          </small>
        </header>
        <div className="arcane-pattern-grid">
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
                    ? check.moments.length +
                      ' moment' +
                      (check.moments.length === 1 ? '' : 's') +
                      ' to review'
                    : check.status === 'observed'
                      ? 'No pattern flags'
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

      {review.combustionWindows.length > 0 && (
        <section className="fire-window-review">
          <header>
            <div>
              <span className="training-eyebrow">COMBUSTION WINDOWS</span>
              <h3>What happened inside each recorded buff window</h3>
            </div>
            <small>
              Counts only; open a flag to judge the surrounding decision.
            </small>
          </header>
          <div>
            {review.combustionWindows.map((window, index) => (
              <button
                key={window.start}
                onClick={() =>
                  onReview({
                    pullId: window.pullId,
                    time: window.start,
                    spellId: FIRE.combustion,
                  })
                }
              >
                <span>
                  #{index + 1} &middot; {timestamp(window.start)}
                </span>
                <strong>{window.spenders} spenders</strong>
                <small>
                  {window.fireBlasts} Fire Blast &middot; {window.meteors}{' '}
                  Meteor &middot; {(window.end - window.start).toFixed(1)}s
                </small>
              </button>
            ))}
          </div>
        </section>
      )}

      {(!review.seasonMatches ||
        !review.castCoverage ||
        !review.buffCoverage) && (
        <div className="training-alert">
          <Info size={18} />
          <p>
            {!review.seasonMatches
              ? 'Guide checks need the supported Season 2 analysis.'
              : !review.castCoverage
                ? 'Cast events are incomplete; some coaching is unavailable.'
                : 'Fire buff events are incomplete; state-dependent coaching is unavailable.'}{' '}
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
              No specific Fire pattern was flagged. That does not certify an
              optimal rotation; compare spell output and defensives next.
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
                    Guide illustration, not a fixed rotation for every proc or
                    pull.
                  </small>
                </div>
              )}
              <FireReference
                result={result}
                lesson={lesson}
                time={moment.time}
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
                    ' Fire checks need more evidence. Open Evidence & guide to see what is missing.'
                  : 'No Fire sequence flags were found. Compare spell output, pull usage and defensive timing next.'}
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
