'use client';
// oxlint-disable jsx-a11y/prefer-tag-over-role -- Accessible SVG damage chart.
import { useState } from 'react';
import { ArrowRight, Crosshair, Info } from 'lucide-react';
import type { AnalysisResult } from '@/lib/domain';
import {
  castsAroundMoment,
  damageAroundDefensiveUse,
  dangerMoments,
  defensiveCasts,
  defensiveUsage,
  pullForCast,
  type DangerMoment,
  type ReviewFocus,
} from '@/lib/defensives';
import { compact, fmt, timestamp } from './coaching-report';
import { CoachDialog } from './coach-dialog';
import {
  DefensiveIncoming,
  DefensiveProtection,
  DefensivePhases,
  DefensiveReference,
} from './defensive-moment';
import { Ability } from './ability';
import './defensive-evidence.css';
import { logUrl } from './run-timeline';

const kindLabel = {
  personal: 'Personal defensive',
  group: 'Group defensive',
  recovery: 'Self-recovery',
  external: 'External-capable defensive',
};
export function DefensiveReview({
  result,
  onReview,
}: {
  result: AnalysisResult;
  onReview: (focus: ReviewFocus) => void;
}) {
  const [lookback, setLookback] = useState(10);
  const [momentId, setMomentId] = useState('');
  const [kind, setKind] = useState('personal');
  const [page, setPage] = useState(0);
  const moments = dangerMoments(result);
  const selected =
    moments.find((moment) => moment.id === momentId) ?? moments[0];
  const usage = defensiveUsage(result);
  const casts = defensiveCasts(result);
  const visible = casts.filter(
    (cast) => kind === 'all' || cast.definition.kind === kind,
  );
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(visible.length / 25) - 1),
  );
  const around = selected ? castsAroundMoment(result, selected, lookback) : [];
  const before = around.filter(
    (cast) => cast.definition.kind === 'personal' && cast.phase === 'before',
  );
  const complete = result.evidence?.castsComplete === true;
  const pull = result.evidence?.pulls.find(
    (entry) => entry.id === selected?.pullId,
  );
  const actualLookback = selected
    ? Math.min(lookback, selected.time - (pull?.start ?? 0))
    : 0;
  return (
    <div className="training-workspace defense-workspace">
      <header className="training-toolbar">
        <div className="training-heading">
          <span className="training-eyebrow">SURVIVAL DECISIONS</span>
          <h2>Match protection to the incoming damage</h2>
        </div>
        <CoachDialog
          label={
            <>
              <Info size={16} /> What timing can tell us
            </>
          }
          title="Defensive timing, not a defensive score"
          description="A cast before damage does not prove its buff was active, appropriate or effective."
        >
          <p>
            Incoming hits identify the damaging ability and enemy when the log
            supplies them. Received buff events identify personal and external
            protection and its caster. Group casts alone do not establish who
            received protection. The tracked spell list is not exhaustive.
          </p>
          <p>
            The graph is sampled; individual hits, deaths and casts use recorded
            timestamps. Buff overlap does not establish damage prevented.
            Recovery after a hit can be intentional; a cast after death did not
            protect against that death. Cooldown availability is unknown.
          </p>
        </CoachDialog>
      </header>
      <div className="defense-summary-strip">
        <span>
          <b>{result.targetMetrics.deaths}</b> recorded deaths
        </span>
        {(['personal', 'group', 'recovery'] as const).map((type) => (
          <span key={type}>
            <b>
              {casts.filter((cast) => cast.definition.kind === type).length}
            </b>{' '}
            {kindLabel[type].toLowerCase()} casts
          </span>
        ))}
      </div>
      {!complete && (
        <p className="training-alert">
          Cast events are incomplete. Fetched counts cannot establish that a
          defensive was unused.
        </p>
      )}
      <div className="training-desk">
        <aside className="training-focus-list">
          <div className="training-section-label">MOMENTS TO REVIEW</div>
          {moments.map((moment) => (
            <button
              className="training-focus"
              data-selected={selected?.id === moment.id}
              key={moment.id}
              onClick={() => setMomentId(moment.id)}
            >
              <span className="defense-moment-time">
                {timestamp(moment.time)}
              </span>
              <span>
                <strong>
                  {moment.kind === 'death'
                    ? 'Death: ' + moment.label
                    : moment.kind === 'hit'
                      ? 'Hit: ' + moment.label
                      : 'High damage intake'}
                </strong>
                <small>
                  {moment.kind === 'damage'
                    ? compact(moment.value) + '/sec sample'
                    : 'Exact event'}
                  {moment.pullId ? ' / Pull ' + moment.pullId : ''}
                </small>
              </span>
            </button>
          ))}
          <p className="training-side-note">
            Deaths first, then separated high-intake samples. When the graph is
            unavailable, the largest recorded hits appear instead. High damage
            is not proof of avoidable damage.
          </p>
        </aside>
        <section className="training-lesson">
          {selected ? (
            <>
              <div className="training-lesson-heading">
                <div>
                  <span className="training-eyebrow">
                    {timestamp(selected.time)} /{' '}
                    {pull?.name ?? 'Recorded moment'}
                  </span>
                  <h3>
                    {selected.kind === 'death' || selected.kind === 'hit'
                      ? selected.label
                      : 'High incoming-damage window'}
                  </h3>
                </div>
                <label className="defense-lookback">
                  Look back
                  <select
                    aria-label="Defensive lookback seconds"
                    value={lookback}
                    onChange={(event) =>
                      setLookback(Number(event.target.value))
                    }
                  >
                    {[5, 10, 15].map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds} seconds
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <DefensiveIncoming
                result={result}
                moment={selected}
                lookback={lookback}
              />
              <DefensiveProtection
                result={result}
                moment={selected}
                lookback={lookback}
              />
              <div className="training-next-action">
                <Crosshair size={22} />
                <div>
                  <span>CHECK THIS DECISION</span>
                  <p>
                    {before.length
                      ? before
                          .map(
                            (cast) =>
                              cast.name +
                              ' at ' +
                              fmt(Math.abs(cast.offset)) +
                              's before',
                          )
                          .join('; ') +
                        '. Check whether the effect covered the damage and suited its type.'
                      : 'No tracked personal defensive cast ' +
                        (complete ? 'recorded' : 'fetched') +
                        ' in the preceding ' +
                        fmt(actualLookback) +
                        's. Check whether you had protection already active or a suitable option available.'}
                  </p>
                </div>
              </div>
              <p className="training-verify">
                Cast timing is not active-buff coverage; cooldown availability
                is unknown. Earlier buffs can still be active. Same-timestamp
                casts are not counted as protection before danger.
              </p>
              <DefensivePhases
                result={result}
                moment={selected}
                lookback={lookback}
              />
              <details className="training-details">
                <summary>Incoming damage graph around this moment</summary>
                <DangerChart
                  result={result}
                  moment={selected}
                  lookback={lookback}
                />
              </details>
              <div className="training-lesson-actions">
                <button
                  className="training-button training-primary"
                  onClick={() =>
                    onReview({
                      pullId: selected.pullId,
                      time: Math.max(0, selected.time - lookback),
                      defensiveOnly: true,
                    })
                  }
                >
                  Review this defensive sequence <ArrowRight size={17} />
                </button>
                <a
                  className="training-button"
                  href={logUrl(
                    result,
                    selected.time - lookback,
                    selected.time + selected.duration + 5,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open event in Warcraft Logs
                </a>
              </div>
            </>
          ) : (
            <div className="training-no-lesson">
              <h3>No danger timestamps available</h3>
              <p>
                No death or incoming-damage sample is available. The usage
                comparison and exact cast list can still be reviewed.
              </p>
            </div>
          )}
        </section>
      </div>
      <DefensiveReference
        result={result}
        lookback={lookback}
        selectedMoment={selected}
      />
      <details className="training-details">
        <summary>
          Usage against reference players &middot; {usage.length} tracked
          abilities
        </summary>
        <p className="training-note">
          Usage differences are context, not a recommendation to press
          defensives more often. Unknown talents are not assumed available.
        </p>
        <div className="coach-table-wrap">
          <table className="coach-table defense-usage">
            <thead>
              <tr>
                <th>Ability</th>
                <th>Your casts</th>
                <th>Your casts/min</th>
                <th>Reference median/min</th>
                <th>Reference users</th>
                <th>Timing</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((spell) => (
                <tr key={spell.id}>
                  <th scope="row">
                    <span className="icon-label">
                      <Ability
                        id={spell.id}
                        name={spell.name}
                        icon={spell.icon}
                      />
                      <small>{kindLabel[spell.kind]}</small>
                    </span>
                  </th>
                  <td>
                    {spell.target
                      ? spell.target.uses
                      : complete
                        ? spell.casts.length
                        : 'Unavailable'}
                  </td>
                  <td>
                    {spell.target ? fmt(spell.target.perMinute) : 'Unavailable'}
                  </td>
                  <td>
                    {spell.comparison?.casts.sampleSize
                      ? fmt(spell.comparison.casts.median)
                      : 'Unavailable'}
                  </td>
                  <td>
                    {spell.comparison
                      ? spell.comparison.referenceUsers +
                        '/' +
                        spell.comparison.casts.sampleSize
                      : '-'}
                  </td>
                  <td>
                    <button
                      className="coach-link"
                      disabled={!spell.casts.length}
                      onClick={() =>
                        onReview({
                          time: spell.casts[0]?.time,
                          spellId: spell.id,
                          defensiveOnly: true,
                        })
                      }
                    >
                      {spell.casts.length ? 'See casts' : 'No fetched casts'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!usage.length && (
          <p className="training-empty">
            No recognized defensive or recovery abilities in the available cast
            data.
          </p>
        )}
      </details>
      <details className="training-details">
        <summary>
          Every tracked use &middot; {casts.length} fetched casts
        </summary>
        <label className="training-field">
          Category
          <select
            aria-label="Defensive cast category"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPage(0);
            }}
          >
            <option value="personal">Personal defensives</option>
            <option value="group">Group defensives</option>
            <option value="recovery">Self-recovery</option>
            <option value="external">External-capable casts</option>
            <option value="all">All tracked uses</option>
          </select>
        </label>
        <div className="defense-ledger">
          {visible
            .slice(safePage * 25, safePage * 25 + 25)
            .map((cast, index) => {
              const castPull = pullForCast(result, cast);
              const threats = damageAroundDefensiveUse(result, cast);
              return (
                <article
                  key={cast.time + ':' + index}
                  className="defense-use defense-use-evidence"
                >
                  <time>{timestamp(cast.time)}</time>
                  <div className="defense-use-main">
                    <Ability
                      id={cast.id}
                      name={cast.name}
                      icon={cast.icon ?? cast.definition.icon}
                    />
                    <small>
                      {castPull
                        ? castPull.name +
                          ' / ' +
                          fmt(cast.time - castPull.start) +
                          's into encounter'
                        : 'Fight timeline'}
                    </small>
                    {threats.length ? (
                      <div className="defense-use-threats">
                        <small>Damage nearby (3s before to 8s after):</small>
                        {threats.slice(0, 2).map((threat, threatIndex) => (
                          <span key={threatIndex}>
                            {threat.id && (
                              <Ability
                                id={threat.id}
                                name={threat.name}
                                icon={threat.icon}
                              />
                            )}
                            <small>
                              {threat.sourceName ?? 'Enemy unknown'} ·{' '}
                              {compact(threat.amount)}
                            </small>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <small>
                        No incoming hit events fetched near this cast.
                      </small>
                    )}
                  </div>
                  <button
                    className="training-button"
                    aria-label={
                      'Review ' + cast.name + ' at ' + timestamp(cast.time)
                    }
                    onClick={() =>
                      onReview({
                        pullId: castPull?.id,
                        time: Math.max(0, cast.time - 3),
                        spellId: cast.id,
                        defensiveOnly: true,
                      })
                    }
                  >
                    Review <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
        </div>
        {!visible.length && (
          <p className="training-empty">
            No casts in this category were fetched.
          </p>
        )}
        {visible.length > 25 && (
          <div className="review-event-pages">
            <span>
              {safePage * 25 + 1}-
              {Math.min(visible.length, (safePage + 1) * 25)} of{' '}
              {visible.length} uses
            </span>
            <button
              className="training-button"
              disabled={!safePage}
              onClick={() => setPage(safePage - 1)}
            >
              Earlier
            </button>
            <button
              className="training-button"
              disabled={(safePage + 1) * 25 >= visible.length}
              onClick={() => setPage(safePage + 1)}
            >
              Later
            </button>
          </div>
        )}
      </details>
    </div>
  );
}

function DangerChart({
  result,
  moment,
  lookback,
}: {
  result: AnalysisResult;
  moment: DangerMoment;
  lookback: number;
}) {
  const start = Math.max(0, moment.time - lookback);
  const end = Math.min(
    result.evidence?.duration ?? Infinity,
    moment.time + moment.duration + 5,
  );
  const points = (result.evidence?.incoming ?? []).filter(
    (point) => point.time >= start && point.time <= end,
  );
  if (!points.length)
    return (
      <p className="diagnosis-empty">
        No incoming-damage samples for this window. Cast and death timestamps
        remain listed below.
      </p>
    );
  const casts = castsAroundMoment(result, moment, lookback);
  const max = Math.max(1, ...points.map((point) => point.value)) * 1.1;
  const x = (time: number) =>
    65 + ((time - start) / Math.max(0.001, end - start)) * 630;
  const y = (value: number) => 170 - (value / max) * 120;
  return (
    <div className="danger-chart">
      <svg
        viewBox="0 0 730 230"
        role="img"
        aria-label="Incoming damage and defensive casts relative to the selected danger moment"
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="65"
              x2="695"
              y1={y(fraction * max)}
              y2={y(fraction * max)}
              stroke="#334155"
            />
            <text x="55" y={y(fraction * max) + 5} textAnchor="end">
              {compact(fraction * max)}
            </text>
          </g>
        ))}
        <polyline
          points={points
            .map((point) => x(point.time) + ',' + y(point.value))
            .join(' ')}
          fill="none"
          stroke="#fb7185"
          strokeWidth="3"
        />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={x(point.time)}
            cy={y(point.value)}
            r="3"
            fill="#fb7185"
          >
            <title>
              {compact(point.value) + ' damage/sec at ' + timestamp(point.time)}
            </title>
          </circle>
        ))}
        <line
          x1={x(moment.time)}
          x2={x(moment.time)}
          y1="22"
          y2="178"
          stroke="#ffffff"
          strokeDasharray="5 4"
        />
        <text x={x(moment.time)} y="15" textAnchor="middle">
          {moment.kind === 'death'
            ? 'Death'
            : moment.kind === 'hit'
              ? 'Recorded hit'
              : 'Sample starts'}
        </text>
        {casts.map((cast, index) => (
          <g key={index}>
            <line
              x1={x(cast.time)}
              x2={x(cast.time)}
              y1="38"
              y2="177"
              stroke={
                cast.definition.kind === 'personal'
                  ? '#67e8f9'
                  : cast.definition.kind === 'group'
                    ? '#c4b5fd'
                    : '#86efac'
              }
              strokeDasharray="2 5"
            />
            <circle
              cx={x(cast.time)}
              cy="33"
              r="5"
              fill={
                cast.definition.kind === 'personal'
                  ? '#67e8f9'
                  : cast.definition.kind === 'group'
                    ? '#c4b5fd'
                    : '#86efac'
              }
            />
            <title>
              {cast.name +
                ': ' +
                fmt(cast.offset) +
                's relative to selected moment'}
            </title>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <text
            key={fraction}
            x={65 + fraction * 630}
            y="199"
            textAnchor="middle"
          >
            {fmt(start + fraction * (end - start) - moment.time)}s
          </text>
        ))}
        <text x="370" y="223" textAnchor="middle">
          Seconds relative to the selected moment / damage per second
        </text>
      </svg>
      <p>
        Pink: sampled damage taken. Cyan: personal defensive. Purple: group
        defensive. Green: self-recovery. Lines connect samples, not individual
        hits.
      </p>
    </div>
  );
}
