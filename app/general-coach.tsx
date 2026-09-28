'use client';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Crosshair,
  Info,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { AnalysisResult } from '@/lib/domain';
import type { ReviewFocus } from '@/lib/defensives';
import {
  coachingOpportunities,
  defensiveOverview,
  opportunityFocus,
  positiveSignals,
  practicePlanText,
  pullPractice,
  referenceDifferences,
  spellPullUse,
  type CoachingOpportunity,
} from '@/lib/coaching';
import { buildDiagnosis } from '@/lib/diagnosis';
import { referenceKey } from '@/lib/reference-selection';
import { GameIcon, compact, fmt, timestamp } from './coaching-report';
import { CoachDialog } from './coach-dialog';

export function GeneralCoach({
  result,
  onNavigate,
  onSpell,
  onReview,
}: {
  result: AnalysisResult;
  onNavigate: (tab: string) => void;
  onSpell: (name: string) => void;
  onReview: (focus: ReviewFocus) => void;
}) {
  const opportunities = useMemo(() => coachingOpportunities(result), [result]);
  const pulls = useMemo(() => pullPractice(result), [result]);
  const positives = useMemo(() => positiveSignals(result), [result]);
  const diagnosis = useMemo(() => buildDiagnosis(result), [result]);
  const [selectedId, setSelectedId] = useState('');
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [saved, setSaved] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [referenceId, setReferenceId] = useState(
    result.references[0] ? referenceKey(result.references[0]) : '',
  );
  const selected =
    opportunities.find((item) => item.id === selectedId) ?? opportunities[0];
  const practice = opportunities.find((item) => item.id === saved);
  const reference = result.references.find(
    (item) => referenceKey(item) === referenceId,
  );
  const differences = referenceDifferences(result, reference);
  const ability = selected?.spellId
    ? result.spells?.find((spell) => spell.id === selected.spellId)
    : undefined;
  const selectedPullUses = useMemo(
    () => spellPullUse(result, selected?.spellId),
    [result, selected?.spellId],
  );
  const defense = useMemo(() => defensiveOverview(result), [result]);
  function open(item: CoachingOpportunity) {
    const focus = opportunityFocus(item);
    if (focus) onReview(focus);
    else if (item.spellName) onSpell(item.spellName);
    else onNavigate(item.destination);
  }
  async function copyPlan() {
    if (!practice) return;
    try {
      await navigator.clipboard.writeText(practicePlanText(result, practice));
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Clipboard unavailable');
    }
  }
  return (
    <div className="training-workspace general-coach">
      <header className="training-toolbar">
        <div className="training-heading">
          <span className="training-eyebrow">
            {result.target.specName.toUpperCase()} LOG COACH
          </span>
          <h2>Choose one improvement to verify</h2>
        </div>
        <CoachDialog
          label={
            <>
              <Info size={16} /> What this coach knows
            </>
          }
          title="Evidence coach for every DPS spec"
          description="This view compares logs; it is not a class rotation guide."
        >
          <p>
            It can establish recorded damage, cast rates, buff uptime, deaths,
            pull boundaries, long completed-cast gaps, gear snapshots, and
            differences from selected reference players.
          </p>
          <p>
            It cannot reconstruct resources, cooldown readiness, enemy count,
            assignments, mechanics, talent intent or every external buff. Each
            item is a question to verify, not an automatic mistake.
          </p>
        </CoachDialog>
      </header>
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
                fmt(Math.abs(diagnosis.deficit)) +
                '%'}
          </strong>
        </div>
        <div className="training-score-caption">
          <span>{result.cohort.actualSize} individual-DPS references</span>
          <small>
            Same spec, dungeon and key. Affixes{' '}
            {result.cohort.affixesMatched ? 'matched' : 'not matched'}.
          </small>
        </div>
      </div>
      <div className="training-desk">
        <aside className="training-focus-list">
          <div className="training-section-label">
            <span>IMPROVEMENT QUEUE</span>
            <small>
              {reviewed.length}/{opportunities.length} reviewed
            </small>
          </div>
          {opportunities.map((item, index) => (
            <button
              className="training-focus"
              data-selected={selected?.id === item.id}
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setCopyStatus('');
              }}
            >
              <span className="general-priority">{index + 1}</span>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.category === 'activity'
                    ? 'Recorded cast timing'
                    : item.category === 'gear'
                      ? 'Run context'
                      : item.category === 'survival'
                        ? 'Death and defensive timing'
                        : item.category === 'buff'
                          ? 'Buff uptime context'
                          : 'Reference difference'}
                </small>
              </span>
              {reviewed.includes(item.id) ? (
                <Check className="training-good" size={17} />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>
          ))}
          {!opportunities.length && (
            <p className="training-empty">
              No comparison priority passed the current evidence checks. Explore
              pull consistency and a reference player below; this is not a
              perfect-play verdict.
            </p>
          )}
          <p className="training-side-note">
            Deaths first, then the largest supported output or activity
            differences. This order is not a DPS-loss calculation.
          </p>
          {result.target.contentType !== 'raid' &&
            result.target.className === 'Mage' &&
            result.target.specName === 'Arcane' && (
              <button
                className="training-secondary-link"
                onClick={() => onNavigate('arcane')}
              >
                <Sparkles size={17} /> Open talent-aware Arcane guide{' '}
                <ArrowRight size={16} />
              </button>
            )}
          {result.target.contentType !== 'raid' &&
            result.target.className === 'Mage' &&
            result.target.specName === 'Fire' && (
              <button
                className="training-secondary-link"
                onClick={() => onNavigate('fire')}
              >
                <Sparkles size={17} /> Open evidence-aware Fire guide{' '}
                <ArrowRight size={16} />
              </button>
            )}
          {result.target.contentType !== 'raid' &&
            result.target.className === 'Mage' &&
            result.target.specName === 'Frost' && (
              <button
                className="training-secondary-link"
                onClick={() => onNavigate('frost')}
              >
                <Sparkles size={17} /> Open proc-aware Frost guide{' '}
                <ArrowRight size={16} />
              </button>
            )}
        </aside>
        <section className="training-lesson">
          {selected ? (
            <>
              <div className="training-lesson-heading">
                <div>
                  <span className="training-eyebrow">
                    NEXT QUESTION TO ANSWER
                  </span>
                  <h3>{selected.title}</h3>
                </div>
                {ability ? (
                  <GameIcon
                    id={ability.id}
                    name={ability.name}
                    icon={ability.icon}
                  />
                ) : selected.category === 'survival' ? (
                  <ShieldCheck size={25} />
                ) : (
                  <Crosshair size={25} />
                )}
              </div>
              <p className="training-why">
                <b>Observed:</b> {selected.observation}
              </p>
              <div className="training-next-action">
                <Crosshair size={22} />
                <div>
                  <span>VERIFY IN THE LOG</span>
                  <p>{selected.check}</p>
                </div>
                <button
                  className="training-button"
                  aria-pressed={saved === selected.id}
                  onClick={() => {
                    setSaved(selected.id);
                    setCopyStatus('');
                  }}
                >
                  {saved === selected.id ? (
                    <>
                      <Check size={16} /> Focus saved
                    </>
                  ) : (
                    'Set my focus'
                  )}
                </button>
              </div>
              <p className="training-verify">
                This is not measured recoverable DPS. A different build, pull
                size, target priority, mechanic or assignment can explain the
                difference.
              </p>
              <div className="general-evidence">
                <div>
                  <span>Evidence source</span>
                  <strong>
                    {selected.category === 'activity'
                      ? 'Exact cast events'
                      : selected.category === 'gear'
                        ? 'Combatant snapshot'
                        : 'Full-run comparison'}
                  </strong>
                </div>
                <div>
                  <span>Reference sample</span>
                  <strong>
                    {selected.category === 'activity'
                      ? result.evidence?.castsComplete
                        ? 'Complete target casts'
                        : 'Partial target casts'
                      : result.cohort.actualSize + ' runs'}
                  </strong>
                </div>
                <div>
                  <span>Confidence gate</span>
                  <strong>
                    {diagnosis.sufficient
                      ? 'Comparison enabled'
                      : 'More logs needed'}
                  </strong>
                </div>
              </div>
              {selectedPullUses.length > 0 && (
                <div className="spell-pull-uses">
                  <header>
                    <div>
                      <span className="training-eyebrow">
                        SPELL USE BY PULL
                      </span>
                      <h4>
                        {ability?.name ?? selected.spellName} opportunities to
                        inspect
                      </h4>
                    </div>
                    <small>Lowest recorded use first</small>
                  </header>
                  <div>
                    {selectedPullUses.slice(0, 6).map((pull) => (
                      <button
                        key={pull.pullId}
                        onClick={() =>
                          onReview({
                            pullId: pull.pullId,
                            time: pull.start,
                            spellId: selected.spellId,
                          })
                        }
                      >
                        <span>
                          <b>{pull.pullName}</b>
                          <small>Pull {pull.pullId}</small>
                        </span>
                        <span>
                          <b>{pull.uses}</b>
                          <small>recorded casts</small>
                        </span>
                        <span>
                          <b>{fmt(pull.perMinute)}/min</b>
                          <small>inside this pull</small>
                        </span>
                        <span>
                          <b>
                            {pull.firstUse === null
                              ? 'No use'
                              : '+' + timestamp(pull.firstUse)}
                          </b>
                          <small>first cast</small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                  <p className="training-side-note">
                    A zero-use pull is a place to inspect, not proof the spell
                    was talented, ready, useful, or meant for that pull.
                  </p>
                </div>
              )}
              <div className="training-lesson-actions">
                <button
                  className="training-button training-primary"
                  onClick={() => open(selected)}
                >
                  Inspect the evidence <ArrowRight size={17} />
                </button>
                <button
                  className="training-button"
                  aria-pressed={reviewed.includes(selected.id)}
                  onClick={() =>
                    setReviewed((items) =>
                      items.includes(selected.id)
                        ? items.filter((id) => id !== selected.id)
                        : [...items, selected.id],
                    )
                  }
                >
                  <Check size={16} />{' '}
                  {reviewed.includes(selected.id)
                    ? 'Reviewed'
                    : 'Mark reviewed'}
                </button>
              </div>
            </>
          ) : (
            <div className="training-no-lesson">
              <Check size={30} />
              <h3>No supported priority found</h3>
              <p>
                Use the pull and reference views below to investigate. The coach
                will not invent a class rule from missing evidence.
              </p>
              <button
                className="training-button"
                onClick={() => onNavigate('timeline')}
              >
                Compare a reference run
              </button>
            </div>
          )}
        </section>
      </div>
      {practice && (
        <section className="training-practice">
          <div>
            <span className="training-eyebrow">NEXT KEY FOCUS</span>
            <h3>{practice.title}</h3>
            <p>{practice.check}</p>
          </div>
          <button className="training-button" onClick={copyPlan}>
            <Copy size={16} />{' '}
            {copyStatus === 'Copied' ? 'Copied' : 'Copy practice plan'}
          </button>
          {copyStatus && (
            <output className="training-copy-status">{copyStatus}</output>
          )}
        </section>
      )}
      <section className="general-review-grid">
        <div className="general-review-card">
          <header>
            <div>
              <span className="training-eyebrow">PULL CONSISTENCY</span>
              <h3>Where your run changed shape</h3>
            </div>
            <CoachDialog
              label={
                <>
                  <Info size={15} />
                  <span className="sr-only">About pull consistency</span>
                </>
              }
              title="What these pull cards mean"
              description="They show observed cast timing, not downtime."
            >
              <p>
                Cast rate is all recorded casts divided by pull duration. Gap
                time sums intervals of at least five seconds between completed
                casts. Channels, movement, crowd control, mechanics, downtime
                between targets and deaths can explain the result.
              </p>
            </CoachDialog>
          </header>
          <div className="pull-practice-list">
            {pulls.slice(0, 8).map((pull) => (
              <button
                key={pull.id}
                onClick={() => onReview({ pullId: pull.id, time: pull.start })}
              >
                <span>
                  <b>{pull.name}</b>
                  <small>
                    Pull {pull.id} &middot; {timestamp(pull.duration)}
                  </small>
                </span>
                <span>
                  <b>{fmt(pull.castsPerMinute)}/min</b>
                  <small>{pull.casts} casts</small>
                </span>
                <span data-alert={pull.longestGap >= 8 || pull.deaths > 0}>
                  <b>{pull.longestGap ? fmt(pull.longestGap) + 's' : 'None'}</b>
                  <small>longest 5s+ gap</small>
                </span>
                <span>
                  <b>{pull.deaths}</b>
                  <small>deaths</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          {!pulls.length && (
            <p className="training-empty">
              Pull boundaries or cast events are unavailable.
            </p>
          )}
        </div>
        <div className="general-review-card">
          <header>
            <div>
              <span className="training-eyebrow">KEEP THESE STABLE</span>
              <h3>Observed signals that are holding up</h3>
            </div>
          </header>
          <div className="positive-list">
            {positives.map((signal) => (
              <div key={signal.id}>
                <Check size={18} />
                <span>
                  <b>{signal.title}</b>
                  <small>{signal.detail}</small>
                </span>
              </div>
            ))}
          </div>
          {!positives.length && (
            <p className="training-empty">
              No positive signal passed the evidence gates. That does not mean
              nothing was done well.
            </p>
          )}
        </div>
        <div className="general-review-card defensive-glance">
          <header>
            <div>
              <span className="training-eyebrow">DEFENSIVE TIMING</span>
              <h3>What was used before danger?</h3>
            </div>
            <ShieldCheck size={20} />
          </header>
          <div className="defensive-glance-counts">
            <span>
              <b>{defense.personal}</b>
              <small>personal</small>
            </span>
            <span>
              <b>{defense.group}</b>
              <small>group</small>
            </span>
            <span>
              <b>{defense.recovery}</b>
              <small>recovery</small>
            </span>
          </div>
          <div className="defensive-glance-list">
            {defense.moments.map((moment) => (
              <button
                key={moment.id}
                onClick={() =>
                  onReview({
                    pullId: moment.pullId,
                    time: Math.max(0, moment.time - 10),
                    defensiveOnly: true,
                  })
                }
              >
                <span>
                  <b>
                    {timestamp(moment.time)} &middot; {moment.label}
                  </b>
                  <small>
                    {moment.before.length
                      ? moment.before
                          .map(
                            (cast) =>
                              cast.name + ' ' + fmt(cast.seconds) + 's before',
                          )
                          .join('; ')
                      : 'No tracked personal defensive cast in the prior 10s'}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          {!defense.moments.length && (
            <p className="training-empty">
              No death or high-damage timestamp is available for timing review.
            </p>
          )}
          {!defense.complete && (
            <p className="training-side-note">
              Cast events are partial, so absence is not treated as unused.
            </p>
          )}
          <button
            className="training-secondary-link"
            onClick={() => onNavigate('survival')}
          >
            Open full defensive review <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="general-reference">
        <header>
          <div>
            <span className="training-eyebrow">
              ONE PLAYER, NOT AN ABSTRACT MEDIAN
            </span>
            <h3>Why does a selected reference&apos;s spell output differ?</h3>
          </div>
          <label>
            Reference player
            <select
              aria-label="General coaching reference player"
              value={referenceId}
              onChange={(event) => setReferenceId(event.target.value)}
            >
              {result.references.map((run, index) => (
                <option key={referenceKey(run)} value={referenceKey(run)}>
                  #{index + 1} {run.player} &middot;{' '}
                  {compact(run.rankingDps ?? run.dps)} DPS
                </option>
              ))}
            </select>
          </label>
        </header>
        {reference?.metrics ? (
          <div className="reference-difference-list">
            {differences.map(
              ({ spell, targetPerCast, referencePerCast, finding }) => (
                <button
                  key={spell.id}
                  onClick={() => onReview({ spellId: spell.id })}
                >
                  <GameIcon id={spell.id} name={spell.name} icon={spell.icon} />
                  <span>
                    <b>{spell.name}</b>
                    <small>{finding}</small>
                  </span>
                  <span>
                    <b>
                      {fmt(spell.casts.target)} / {fmt(spell.casts.median)}
                    </b>
                    <small>casts/min: you / {reference.player}</small>
                  </span>
                  <span>
                    <b>
                      {compact(spell.damage.target)} /{' '}
                      {compact(spell.damage.median)}
                    </b>
                    <small>spell DPS</small>
                  </span>
                  <span>
                    <b>
                      {targetPerCast === null || referencePerCast === null
                        ? 'Unknown'
                        : compact(targetPerCast) +
                          ' / ' +
                          compact(referencePerCast)}
                    </b>
                    <small>damage per recorded cast</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ),
            )}
          </div>
        ) : (
          <p className="training-note">
            Individual spell tables are unavailable for this reference.
            Re-analyze or choose another player.
          </p>
        )}
        <p className="training-side-note">
          Selected references are ordered by individual ranked DPS, not key
          speed. Different builds and pull opportunities remain possible. Damage
          per cast is a full-run ratio, not a hit value.
        </p>
      </section>
    </div>
  );
}
