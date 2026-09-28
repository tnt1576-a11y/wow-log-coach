'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisResult, ReferenceRun, RunEvidence } from '@/lib/domain';
import {
  COOLDOWN_PRESETS,
  compareCooldownTiming,
  cooldownUses,
} from '@/lib/cooldown-timing';
import { clusterCooldownMarkers } from '@/lib/cooldown-layout';
import { referenceKey } from '@/lib/reference-selection';
import { useReferenceEvidence } from './use-reference-evidence';
import { Ability, GameIcon } from './ability';
import './cooldown-timeline.css';

const time = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
type SpellIdentity = { id: number; name: string; icon?: string };
export function CooldownTimeline({ result }: { result: AnalysisResult }) {
  return (
    <CooldownWorkspace
      key={[
        result.generatedAt,
        result.target.reportCode,
        result.target.fightId,
        result.target.sourceId,
      ].join(':')}
      result={result}
    />
  );
}
function CooldownWorkspace({ result }: { result: AnalysisResult }) {
  const spells = useMemo(() => {
    const map = new Map<number, { id: number; name: string; icon?: string }>();
    for (const spell of [
      ...(result.evidence?.casts ?? []),
      ...(result.targetMetrics.casts ?? []),
      ...result.references.flatMap((run) => run.metrics?.casts ?? []),
    ])
      map.set(spell.id, spell);
    return [...map.values()].sort(
      (a, b) =>
        Number(COOLDOWN_PRESETS.has(b.id)) -
          Number(COOLDOWN_PRESETS.has(a.id)) || a.name.localeCompare(b.name),
    );
  }, [result]);
  const catalog = useMemo(
    () => new Map(spells.map((spell) => [spell.id, spell])),
    [spells],
  );
  const board = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(620);
  const [selection, setSelection] = useState<number[]>(() =>
    spells
      .filter((spell) => COOLDOWN_PRESETS.has(spell.id))
      .slice(0, 8)
      .map((spell) => spell.id),
  );
  const hasSelection = selection.length > 0;
  useEffect(() => {
    if (!board.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setTrackWidth(Math.max(1, width - 230));
    });
    observer.observe(board.current);
    return () => observer.disconnect();
  }, [hasSelection]);
  const [search, setSearch] = useState('');
  const [loadedCount, setLoadedCount] = useState(0);
  const [scale, setScale] = useState<'seconds' | 'percent'>('seconds');
  const end = Math.max(
    result.evidence?.duration ?? 0,
    ...result.references
      .slice(0, loadedCount)
      .map((run) => run.duration / 1000),
    1,
  );
  const ids = new Set(selection);
  if (!result.evidence)
    return (
      <section className="coach-panel">
        <h3>Cooldown timing</h3>
        <p>
          Detailed cast events are unavailable. Re-analyze the report to load
          this view.
        </p>
      </section>
    );
  return (
    <section className="coach-panel cooldown-workspace">
      <header className="coach-panel-heading">
        <h3>When did they use their cooldowns?</h3>
        <p>
          Read each player from left to right. Compare the opener, later uses
          and the end of the fight.
        </p>
      </header>
      <div className="cooldown-controls">
        <label>
          Timeline scale
          <select
            value={scale}
            onChange={(event) => setScale(event.target.value as typeof scale)}
          >
            <option value="seconds">Seconds from pull</option>
            <option value="percent">Percent of fight duration</option>
          </select>
        </label>
        <button
          className="training-button"
          onClick={() =>
            setLoadedCount(Math.min(loadedCount + 3, result.references.length))
          }
          disabled={
            loadedCount >= result.references.length ||
            result.target.reportCode === 'example'
          }
        >
          {loadedCount
            ? 'Load 3 more reference timelines'
            : 'Load 3 reference timelines'}
        </button>
        <span>
          {loadedCount} of {result.references.length} references selected
        </span>
      </div>
      <p className="cooldown-note">
        {result.target.contentType === 'raid'
          ? 'Same boss and difficulty. Similar kill lengths reduce timing bias; mechanics and phase timings may still differ.'
          : 'Dungeon timelines start at run start. Different routes and travel times can shift every cooldown; use Rotation comparison for matched pulls.'}{' '}
        {scale === 'percent' && 'Percent alignment does not match boss phases.'}
      </p>
      <details className="cooldown-spell-picker">
        <summary>Choose abilities · {selection.length} selected</summary>
        <label>
          Find an ability
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search recorded casts"
          />
        </label>
        <div>
          {spells
            .filter((spell) =>
              spell.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((spell) => (
              <div className="cooldown-picker-item" key={spell.id}>
                <input
                  type="checkbox"
                  aria-label={'Show ' + spell.name + ' timeline'}
                  checked={ids.has(spell.id)}
                  onChange={() =>
                    setSelection((current) =>
                      current.includes(spell.id)
                        ? current.filter((id) => id !== spell.id)
                        : [...current, spell.id],
                    )
                  }
                />
                <Ability {...spell} />
              </div>
            ))}
        </div>
        <p>
          Presets choose common cooldowns only from recorded casts. You can
          select any recorded ability; absence does not prove a talent was
          available.
        </p>
      </details>
      {!selection.length && (
        <p className="coach-empty">
          Choose one or more recorded abilities above to display their timing.
        </p>
      )}
      {selection.length > 0 && (
        <div className="cooldown-scroll">
          <div className="cooldown-board" ref={board}>
            <div className="cooldown-axis">
              <span>Player / ability</span>
              <div>
                {Array.from({ length: 11 }, (_, index) => (
                  <span key={index} style={{ left: `${index * 10}%` }}>
                    {scale === 'percent'
                      ? `${index * 10}%`
                      : time((end * index) / 10)}
                  </span>
                ))}
              </div>
            </div>
            <TimingRows
              label={`${result.target.player} · you`}
              evidence={result.evidence}
              ids={ids}
              catalog={catalog}
              trackWidth={trackWidth}
              end={end}
              scale={scale}
            />
            {result.references.slice(0, loadedCount).map((run) => (
              <ReferenceRows
                key={referenceKey(run)}
                result={result}
                run={run}
                ids={ids}
                catalog={catalog}
                trackWidth={trackWidth}
                end={end}
                scale={scale}
              />
            ))}
          </div>
        </div>
      )}
      {!loadedCount && (
        <p className="cooldown-note">
          {result.target.reportCode === 'example'
            ? 'The sample shows illustrative player casts. Reference timelines require a real log.'
            : 'Load references when ready. This fetches their detailed casts and uses Warcraft Logs quota.'}
        </p>
      )}
      <p className="cooldown-note">
        Nearby uses are grouped with a count badge; expand Exact use times to
        read every timestamp. Markers are recorded casts, not buff durations or
        cooldown availability. A later cast is not automatically a mistake.
        Check planned holds, targets, movement, talents and group buffs before
        changing your timing.
      </p>
    </section>
  );
}

function ReferenceRows({
  result,
  run,
  ids,
  catalog,
  trackWidth,
  end,
  scale,
}: {
  result: AnalysisResult;
  run: ReferenceRun;
  ids: Set<number>;
  catalog: Map<number, SpellIdentity>;
  trackWidth: number;
  end: number;
  scale: 'seconds' | 'percent';
}) {
  const review = useReferenceEvidence(result, run);
  return (
    <div className="cooldown-reference">
      {!review.evidence ? (
        <p aria-live="polite">
          {run.player}:{' '}
          {review.error || review.unavailable || 'Loading cast timeline…'}{' '}
          {review.error && <button onClick={review.retry}>Retry</button>}
        </p>
      ) : (
        <>
          <TimingRows
            label={`${run.player} · ${Math.round(run.percentile)}th percentile`}
            evidence={review.evidence}
            ids={ids}
            catalog={catalog}
            trackWidth={trackWidth}
            end={end}
            scale={scale}
            url={run.url}
          />
          <details className="cooldown-differences">
            <summary>Compare counts and opener timing · {run.player}</summary>
            {Array.from(ids).map((id) => {
              const comparison = compareCooldownTiming(
                result.evidence!,
                review.evidence!,
                id,
              );
              const spell =
                catalog.get(id) ?? comparison.yours[0] ?? comparison.theirs[0];
              return (
                spell && (
                  <p key={id}>
                    <Ability {...spell} />{' '}
                    <span>
                      {comparison.complete
                        ? `${comparison.yours.length} yours / ${comparison.theirs.length} theirs in the first ${time(comparison.end)}`
                        : 'Incomplete cast coverage; count differences are not graded.'}
                      {comparison.complete &&
                        comparison.firstDifference !== null &&
                        ` · Your first use: ${Math.abs(comparison.firstDifference).toFixed(1)}s ${comparison.firstDifference === 0 ? 'at the same time' : comparison.firstDifference > 0 ? 'later' : 'earlier'}`}
                    </span>
                  </p>
                )
              );
            })}
          </details>
        </>
      )}
    </div>
  );
}

export function TimingRows({
  label,
  evidence,
  ids,
  catalog,
  trackWidth,
  end,
  scale,
  url,
}: {
  label: string;
  evidence: RunEvidence;
  ids: Set<number>;
  catalog: Map<number, SpellIdentity>;
  trackWidth: number;
  end: number;
  scale: 'seconds' | 'percent';
  url?: string;
}) {
  const uses = cooldownUses(evidence, ids);
  const byId = new Map<number, typeof uses>();
  for (const event of uses) {
    const list = byId.get(event.id) ?? [];
    list.push(event);
    byId.set(event.id, list);
  }
  const denominator =
    scale === 'percent' ? Math.max(evidence.duration, 1) : end;
  return (
    <div className="cooldown-player">
      <header>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <strong>{label}</strong>
        )}
        <span>
          {time(evidence.duration)} ·{' '}
          {evidence.castsComplete ? 'Complete casts' : 'Partial casts'}
        </span>
      </header>
      {Array.from(ids).map((id) => {
        const events = byId.get(id) ?? [];
        const spell = catalog.get(id) ??
          events[0] ?? { id, name: 'Spell ' + id };
        const clusters = clusterCooldownMarkers(
          events,
          denominator,
          trackWidth,
        );
        return (
          <div className="cooldown-lane-group" key={id}>
            <div className="cooldown-lane">
              <div>
                <Ability {...spell} />
                {!events.length && (
                  <small className="cooldown-empty-use">
                    {evidence.castsComplete
                      ? 'No recorded uses'
                      : 'No uses in available events'}
                  </small>
                )}
              </div>
              <div
                className="cooldown-track"
                style={{ backgroundSize: '10% 100%' }}
              >
                {scale === 'seconds' && evidence.duration < end && (
                  <span
                    className="cooldown-ended"
                    style={{ left: (evidence.duration / end) * 100 + '%' }}
                    title="This fight had ended"
                  />
                )}
                {clusters.map((cluster, index) => (
                  <span
                    key={index}
                    className="cooldown-marker"
                    style={{ left: cluster.position + '%', top: 0 }}
                  >
                    <GameIcon
                      {...spell}
                      detail={
                        cluster.events.length === 1
                          ? time(cluster.events[0].time) +
                            ' (' +
                            cluster.events[0].time.toFixed(2) +
                            's) from pull'
                          : cluster.events.length +
                            ' uses from ' +
                            time(cluster.events[0].time) +
                            ' to ' +
                            time(
                              cluster.events[cluster.events.length - 1].time,
                            ) +
                            '. Expand Exact use times for every timestamp.'
                      }
                    />
                    {cluster.events.length > 1 && (
                      <b
                        className="cooldown-cluster-count"
                        aria-label={cluster.events.length + ' grouped uses'}
                      >
                        {cluster.events.length}
                      </b>
                    )}
                    <span>{time(cluster.events[0].time)}</span>
                  </span>
                ))}
              </div>
            </div>
            {events.length > 0 && (
              <details className="cooldown-exact-times">
                <summary>
                  Exact use times · {events.length}{' '}
                  {events.length === 1 ? 'cast' : 'casts'}
                </summary>
                <ol>
                  {events.map((event, index) => (
                    <li key={index}>
                      <span>#{index + 1}</span> <time>{time(event.time)}</time>{' '}
                      <span>
                        ({event.time.toFixed(2)}s
                        {scale === 'percent'
                          ? ' · ' +
                            ((event.time / evidence.duration) * 100).toFixed(
                              1,
                            ) +
                            '%'
                          : ''}
                        )
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
