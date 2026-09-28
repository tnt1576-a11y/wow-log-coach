'use client';
import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type { AnalysisResult } from '@/lib/domain';
import type { ReviewFocus } from '@/lib/defensives';
import { buildRunBrief, briefPracticeText } from '@/lib/run-brief';
import { castDecisionTime, momentSequence } from '@/lib/cast-sequence';
import { GameIcon, compact, timestamp } from './coaching-report';
import { MomentInsight, PatternSummary } from './moment-insight';

export function RunBrief({
  result,
  preview,
  onNavigate,
  onReview,
  onSpell,
  onGuide,
}: {
  result: AnalysisResult;
  preview?: boolean;
  onNavigate: (tab: string) => void;
  onReview: (focus: ReviewFocus) => void;
  onSpell: (name: string) => void;
  onGuide?: (tab: string, lessonId: string) => void;
}) {
  const brief = useMemo(() => buildRunBrief(result), [result]);
  const [selectedId, setSelectedId] = useState('');
  const [momentIndex, setMomentIndex] = useState(0);
  const [pullFilter, setPullFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [pinned, setPinned] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const detailRef = useRef<HTMLElement>(null);
  const selected =
    brief.priorities.find((priority) => priority.id === selectedId) ??
    brief.priorities[0];
  const practice = brief.priorities.find((priority) => priority.id === pinned);
  const moments = (selected?.moments ?? []).filter(
    (moment) =>
      pullFilter === 'all' ||
      brief.pulls.some(
        (pull) =>
          String(pull.id) === pullFilter &&
          moment.time >= pull.start &&
          moment.time < pull.end,
      ),
  );
  const index = Math.min(momentIndex, Math.max(0, moments.length - 1));
  const moment = moments[index];
  const pull =
    moment &&
    brief.pulls.find(
      (item) => moment.time >= item.start && moment.time < item.end,
    );
  const sequence = moment
    ? momentSequence(result.evidence, moment.time, moment.spellId ?? -1)
    : [];
  const matching = brief.priorities.filter(
    (priority) => category === 'all' || priority.category === category,
  );
  const visible =
    category === 'all' && !showAll ? matching.slice(0, 3) : matching;
  function choose(id: string) {
    setSelectedId(id);
    setMomentIndex(0);
    setPullFilter('all');
    setCopyStatus('');
    detailRef.current?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 1100px)').matches)
      detailRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      });
  }
  function detail() {
    if (!selected) return;
    if (selected.category === 'Rotation' && onGuide) {
      onGuide(selected.destination, selected.id.slice('spec-'.length));
      return;
    }
    if (selected.spellName) onSpell(selected.spellName);
    else if (selected.focus) onReview(selected.focus);
    else onNavigate(selected.destination);
  }
  async function copy() {
    if (!practice) return;
    try {
      await navigator.clipboard.writeText(
        (preview ? 'ILLUSTRATIVE SAMPLE\n' : '') +
          briefPracticeText(result, practice),
      );
      setCopyStatus('Copied.');
    } catch {
      setCopyStatus('Select the practice text below to copy it.');
    }
  }
  return (
    <div className="run-brief">
      {preview && (
        <div className="brief-sample">
          Sample review · illustrative data, not your performance
        </div>
      )}
      <header className="brief-heading">
        <div>
          <span className="brief-kicker">RUN REVIEW</span>
          <h2>
            {brief.priorities.length
              ? 'Your next run starts here'
              : 'Know what this run can tell you'}
          </h2>
          <p>
            Review the evidence. Choose one change. Take it into your next run.
          </p>
        </div>
        {brief.hero && (
          <span className="brief-hero">
            {brief.hero === 'unknown'
              ? 'Hero tree needs confirmation'
              : brief.hero + ' detected'}
          </span>
        )}
      </header>
      <div className="brief-facts">
        <div>
          <span>Your damage / second</span>
          <strong>{compact(result.targetMetrics.dps)}</strong>
          <small>
            {result.target.contentType === 'raid'
              ? 'Full boss fight duration'
              : 'Full dungeon duration'}
          </small>
        </div>
        <div>
          <span>Reference median</span>
          <strong>
            {brief.diagnosis.sufficient && brief.diagnosis.overall
              ? compact(brief.diagnosis.overall.median)
              : 'Limited sample'}
          </strong>
          <small>
            {result.cohort.actualSize} reference players · different runs
          </small>
        </div>
        <div>
          <span>Deaths recorded</span>
          <strong>{result.targetMetrics.deaths}</strong>
          <small>Review mechanics and survival first</small>
        </div>
        <button onClick={() => onNavigate(brief.guideDestination)}>
          <span>Guide checks evaluated</span>
          <strong>{brief.checked.length}</strong>
          <small>
            {brief.unavailable.length
              ? `${brief.unavailable.length} need more data or build context`
              : brief.hasGuide
                ? 'Bounded checks, not a full rotation score'
                : 'No dedicated ruleset for this spec'}
          </small>
        </button>
      </div>
      <div className="brief-workbench">
        <aside className="brief-queue" aria-label="Review priorities">
          <div className="brief-section-heading">
            <h3>What to work on</h3>
            <span>{brief.priorities.length}</span>
          </div>
          <p>
            Survival, repeated rotation observations, then comparison questions.
            Ordered for review, not predicted DPS gain.
          </p>
          <NativeSelect
            aria-label="Filter review priorities"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <NativeSelectOption value="all">All priorities</NativeSelectOption>
            {['Survival', 'Rotation', 'Activity', 'Comparison'].map((value) => (
              <NativeSelectOption key={value} value={value}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <div className="brief-priority-list">
            {visible.map((priority) => (
              <button
                key={priority.id}
                aria-pressed={selected?.id === priority.id}
                className="brief-priority"
                onClick={() => choose(priority.id)}
              >
                <span className="brief-priority-number">
                  {brief.priorities.indexOf(priority) + 1}
                </span>
                <span>
                  <small>
                    {priority.category} · {priority.basis}
                  </small>
                  <strong>{priority.title}</strong>
                  <small>
                    {priority.moments.length
                      ? `${priority.moments.length} review ${priority.moments.length === 1 ? 'moment' : 'moments'}`
                      : 'Review the supporting comparison'}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          {!visible.length && (
            <div className="brief-empty">
              {brief.priorities.length
                ? 'No priorities in this category. Choose another filter.'
                : 'No supported priorities surfaced. Check data coverage below; this does not prove a perfect run.'}
            </div>
          )}
          {category === 'all' && matching.length > 3 && (
            <Button
              variant="ghost"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? 'Show first 3 priorities'
                : `Show all ${matching.length} priorities`}
            </Button>
          )}
        </aside>
        <section
          className="brief-detail"
          ref={detailRef}
          tabIndex={-1}
          aria-label="Selected review priority"
        >
          {selected ? (
            <>
              <span className="brief-kicker">
                {selected.category} / {selected.basis}
              </span>
              <h3>{selected.title}</h3>
              <p>{selected.observation}</p>
              <PatternSummary
                result={result}
                moments={selected.moments}
                eligible={selected.eligible}
                onPull={(id) => {
                  setPullFilter(String(id));
                  setMomentIndex(0);
                }}
              />
              <div className="brief-action">
                <Crosshair size={20} />
                <div>
                  <h4>Try this next run</h4>
                  <p>{selected.action}</p>
                </div>
              </div>
              <div className="brief-check">
                <Shield size={18} />
                <div>
                  <h4>Check before changing your play</h4>
                  <p>{selected.verify}</p>
                </div>
              </div>
              <div className="brief-actions">
                <Button
                  onClick={() => {
                    setPinned(selected.id);
                    setCopyStatus('');
                  }}
                  variant={pinned === selected.id ? 'secondary' : 'default'}
                >
                  {pinned === selected.id ? <Check /> : <Crosshair />}
                  {pinned === selected.id
                    ? 'Your next-run focus'
                    : 'Make this my focus'}
                </Button>
                <Button variant="outline" onClick={detail}>
                  Open full review <ArrowRight />
                </Button>
              </div>
              {selected.moments.length > 0 ? (
                <div className="brief-evidence">
                  <div className="brief-section-heading">
                    <h4>Show me the moment</h4>
                    <NativeSelect
                      aria-label="Filter moments by pull"
                      value={pullFilter}
                      onChange={(event) => {
                        setPullFilter(event.target.value);
                        setMomentIndex(0);
                      }}
                    >
                      <NativeSelectOption value="all">
                        All pulls
                      </NativeSelectOption>
                      {brief.pulls
                        .filter((item) =>
                          selected.moments.some(
                            (value) =>
                              value.time >= item.start && value.time < item.end,
                          ),
                        )
                        .map((item) => (
                          <NativeSelectOption
                            key={item.id}
                            value={String(item.id)}
                          >
                            {timestamp(item.start)} · {item.name}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </div>
                  {moment ? (
                    <>
                      <div className="brief-moment-heading">
                        <div>
                          <strong>{timestamp(moment.time)}</strong>
                          <span>{pull?.name ?? 'Run event'}</span>
                        </div>
                        <div className="brief-pager">
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label="Previous review moment"
                            disabled={index === 0}
                            onClick={() => setMomentIndex(index - 1)}
                          >
                            <ChevronLeft />
                          </Button>
                          <span aria-live="polite">
                            {index + 1} / {moments.length}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label="Next review moment"
                            disabled={index >= moments.length - 1}
                            onClick={() => setMomentIndex(index + 1)}
                          >
                            <ChevronRight />
                          </Button>
                        </div>
                      </div>
                      <p>{moment.detail}</p>
                      <MomentInsight
                        key={selected.id + ':' + moment.time}
                        result={result}
                        moment={moment}
                      />
                      {sequence.length > 0 && (
                        <>
                          <span className="brief-kicker">
                            NEARBY RECORDED CASTS
                          </span>
                          <ol className="brief-cast-strip">
                            {sequence.map((cast, i) => (
                              <li key={i}>
                                <GameIcon
                                  id={cast.id}
                                  icon={cast.icon}
                                  name={cast.name}
                                />
                                <strong>{cast.name}</strong>
                                <small>
                                  {timestamp(castDecisionTime(cast))}
                                </small>
                              </li>
                            ))}
                          </ol>
                        </>
                      )}
                      <Button
                        variant="outline"
                        onClick={() =>
                          onReview({
                            time: moment.time,
                            spellId: moment.spellId,
                            pullId: pull?.id,
                            defensiveOnly: selected.category === 'Survival',
                          })
                        }
                      >
                        Inspect this moment in the timeline <ArrowRight />
                      </Button>
                    </>
                  ) : (
                    <p>No moments in this pull.</p>
                  )}
                </div>
              ) : (
                <p className="brief-note">
                  {selected.basis === 'Reference difference'
                    ? 'This comes from aggregate comparisons. Use the full review to inspect the spell or equipment; no exact mistake timestamp is implied.'
                    : 'The aggregate report contains deaths, but detailed death timestamps are unavailable.'}
                </p>
              )}
            </>
          ) : (
            <div className="brief-empty">
              <Sparkles size={24} />
              <h3>Start with what is available</h3>
              <p>
                Use the guide to study your spec, or inspect the timeline.
                Missing events and unsupported checks stay unknown.
              </p>
              <Button
                variant="outline"
                onClick={() => onNavigate(brief.guideDestination)}
              >
                Open the coach <ArrowRight />
              </Button>
            </div>
          )}
        </section>
      </div>
      {practice && (
        <section
          className="brief-practice"
          aria-label="Next-run practice focus"
        >
          <div>
            <span className="brief-kicker">ONE FOCUS FOR YOUR NEXT KEY</span>
            <h3>{practice.title}</h3>
            <p>{practice.action}</p>
            <p>
              <strong>Check first:</strong> {practice.verify}
            </p>
            <small>
              Kept for this review only. No practice history is saved.
            </small>
          </div>
          <div>
            <Button variant="outline" onClick={copy}>
              <Copy /> Copy focus
            </Button>
            <output>{copyStatus}</output>
          </div>
        </section>
      )}
      <section className="brief-pulls">
        <div className="brief-section-heading">
          <div>
            <span className="brief-kicker">RUN AT A GLANCE</span>
            <h3>Where to look</h3>
          </div>
          <span>Markers are review moments, not an error score</span>
        </div>
        {brief.pulls.length ? (
          <div className="brief-pull-list">
            {brief.pulls.map((item) => (
              <button
                key={item.id}
                onClick={() => onReview({ pullId: item.id, time: item.start })}
                aria-label={`Review ${item.name} at ${timestamp(item.start)}`}
                className={
                  item.deaths ? 'has-death' : item.moments ? 'has-moments' : ''
                }
              >
                <small>
                  {timestamp(item.start)} · {item.boss ? 'Boss' : 'Trash'}
                </small>
                <strong>{item.name}</strong>
                <span>
                  {item.deaths ? `${item.deaths} deaths · ` : ''}
                  {item.moments} review moments
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p>Pull boundaries are unavailable for this report.</p>
        )}
      </section>
      <div className="brief-bottom">
        <section>
          <span className="brief-kicker">KEEP IN MIND</span>
          <h3>Useful positives</h3>
          {brief.strengths.length ? (
            brief.strengths.map((signal) => (
              <div className="brief-positive" key={signal.id}>
                <Check size={18} />
                <div>
                  <h4>{signal.title}</h4>
                  <p>{signal.detail}</p>
                </div>
              </div>
            ))
          ) : (
            <p>No positive comparison is supported by the available data.</p>
          )}
        </section>
        <section>
          <span className="brief-kicker">HOW MUCH CAN WE TELL?</span>
          <h3>Evidence coverage</h3>
          <ul className="brief-coverage">
            <li>
              <span>Cast events</span>
              <strong>
                {result.evidence?.castsComplete
                  ? 'Complete'
                  : 'Incomplete / unavailable'}
              </strong>
            </li>
            <li>
              <span>Pull boundaries</span>
              <strong>{brief.pulls.length || 'Unavailable'}</strong>
            </li>
            <li>
              <span>Reference comparison</span>
              <strong>
                {brief.diagnosis.sufficient
                  ? 'Enough for comparison'
                  : 'Limited — need 8 comparable runs'}
              </strong>
            </li>
          </ul>
          {brief.unavailable.length > 0 && (
            <details>
              <summary>
                {brief.unavailable.length} guide checks could not run
              </summary>
              {brief.unavailable.map((check) => (
                <p key={check.id}>
                  <strong>{check.title}:</strong> {check.detail}
                </p>
              ))}
            </details>
          )}
          <p className="brief-note">
            No full resource simulation, automatic enemy-count reconstruction,
            or predicted DPS gain. A missing flag is not proof that a decision
            was correct.
          </p>
        </section>
      </div>
    </div>
  );
}
