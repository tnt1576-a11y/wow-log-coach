'use client';

import { useRef, useState } from 'react';
import type { AnalysisResult, CastEvent, PullEvidence } from '@/lib/domain';
import { dungeonFloor } from '@/lib/dungeon-maps';
import { pullWindow, spellLanes } from '@/lib/timeline';
import { defensiveSpell, type ReviewFocus } from '@/lib/defensives';
import { GameIcon, fmt, timestamp } from './coaching-report';
import { TerrainMap, SpellTracks, WindowDamage, logUrl } from './run-timeline';

export function Timeline({
  result,
  focus = {},
}: {
  result: AnalysisResult;
  focus?: ReviewFocus;
}) {
  const initialPull =
    result.evidence?.pulls.find((pull) => pull.id === focus.pullId) ??
    result.evidence?.pulls.find(
      (pull) =>
        focus.time !== undefined &&
        focus.time >= pull.start &&
        focus.time < pull.end,
    );
  const [selectedId, setSelectedId] = useState<number | null>(
    initialPull?.id ?? (focus.time !== undefined ? -1 : null),
  );
  const [offset, setOffset] = useState(
    Math.max(0, (focus.time ?? 0) - (initialPull?.start ?? 0)),
  );
  const [spellId, setSpellId] = useState(
    focus.spellId ? String(focus.spellId) : 'all',
  );
  const [defensiveOnly, setDefensiveOnly] = useState(
    focus.defensiveOnly ?? false,
  );
  const [selectedCast, setSelectedCast] = useState<CastEvent | null>(null);
  const [eventPage, setEventPage] = useState(0);
  const castsPanel = useRef<HTMLElement>(null);
  const evidence = result.evidence;
  if (!evidence)
    return (
      <section className="coach-panel">
        <h3>Timeline unavailable</h3>
        <p>
          Detailed events could not be loaded. Run the analysis again to retry.
        </p>
      </section>
    );
  const pull =
    selectedId === -1
      ? undefined
      : (evidence.pulls.find((item) => item.id === selectedId) ??
        evidence.pulls[0]);
  const index = evidence.pulls.findIndex((item) => item.id === pull?.id);
  const pullStart = pull?.start ?? 0;
  const pullEnd = pull?.end ?? evidence.duration;
  const window = pullWindow(evidence, pull, offset, 30);
  const wholePull = pullWindow(evidence, pull, 0, 'all');
  const spells = spellLanes(wholePull.events).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const filteredEvents = defensiveOnly
    ? window.events.filter((cast) => defensiveSpell(cast.id))
    : window.events;
  const events = filteredEvents.filter(
    (cast) => spellId === 'all' || String(cast.id) === spellId,
  );
  const lanes = spellLanes(filteredEvents, spellId);
  const page = Math.min(
    eventPage,
    Math.max(0, Math.ceil(events.length / 20) - 1),
  );
  const activeCast =
    selectedCast && events.includes(selectedCast) ? selectedCast : null;
  const floors = [
    ...new Set(
      evidence.pulls.flatMap((item) =>
        item.mapId !== null ? [item.mapId] : [],
      ),
    ),
  ];
  const deaths = evidence.deaths.filter(
    (death) => death.time >= pullStart && death.time < pullEnd,
  );
  const gaps = evidence.castsComplete
    ? evidence.gaps
        .filter((gap) => gap.pullId === pull?.id)
        .sort((a, b) => b.end - b.start - (a.end - a.start))
    : [];
  function moveWindow(next: number) {
    setOffset(next);
    setEventPage(0);
    setSelectedCast(null);
  }
  function choosePull(next: PullEvidence) {
    setSelectedId(next.id);
    setSpellId('all');
    moveWindow(0);
  }
  function inspectMoment(time: number) {
    setSpellId('all');
    moveWindow(Math.max(0, time - pullStart - 5));
    castsPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return (
    <div className="pull-review">
      <header className="review-intro">
        <h3>Review a pull</h3>
        <p>
          Choose a fight on the left. On the right, check notable moments and
          read your casts in order.
        </p>
      </header>
      <div className="review-workspace">
        <aside
          className="review-navigation"
          aria-label="Dungeon and pull selection"
        >
          <section className="coach-panel review-map-panel">
            <div className="review-section-title">
              <h4>1. Choose a pull</h4>
              <span>{evidence.pulls.length} pulls</span>
            </div>
            {floors.length > 1 && (
              <label className="review-floor">
                Floor
                <select
                  className="coach-select"
                  aria-label="Dungeon map floor"
                  value={pull?.mapId ?? ''}
                  onChange={(event) => {
                    const next = evidence.pulls.find(
                      (item) => item.mapId === Number(event.target.value),
                    );
                    if (next) choosePull(next);
                  }}
                >
                  <option value="" disabled>
                    Unknown floor
                  </option>
                  {floors.map((id) => (
                    <option key={id} value={id}>
                      {dungeonFloor(id, result.target.dungeon)?.name ??
                        'Map ' + id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <TerrainMap
              key={pull?.mapId ?? 'unknown'}
              floor={dungeonFloor(pull?.mapId, result.target.dungeon)}
              pulls={evidence.pulls.filter(
                (item) => item.mapId === pull?.mapId,
              )}
              selectedId={pull?.id}
              onSelect={choosePull}
            />
            <p className="review-map-key">
              <span className="map-key-selected" />
              Selected <span className="map-key-boss" />
              Boss <span className="map-key-death" />
              Death
            </p>
            <p className="coach-footnote">
              Numbers match the pull list. Markers locate the first enemy hit,
              not your character.
            </p>
            <nav className="review-pull-list" aria-label="All pulls">
              {evidence.pulls.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={pull?.id === item.id}
                  className={
                    'review-pull ' + (pull?.id === item.id ? 'selected' : '')
                  }
                  onClick={() => choosePull(item)}
                >
                  <span className="review-pull-number">{item.id}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {timestamp(item.start)} into run /{' '}
                      {fmt(item.end - item.start)}s{item.boss ? ' / Boss' : ''}
                    </small>
                  </span>
                  {item.deaths > 0 && (
                    <span className="review-death-badge">
                      {item.deaths} {item.deaths === 1 ? 'death' : 'deaths'}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            {!evidence.pulls.length && (
              <p className="coach-empty">
                No pull boundaries were supplied. Showing the full run on the
                right.
              </p>
            )}
          </section>
        </aside>
        <div className="review-detail">
          <section className="coach-panel">
            <div className="review-section-title">
              <h4>2. Review your play</h4>
              <div className="review-paging">
                <button
                  className="review-button"
                  aria-label="Previous pull"
                  disabled={index <= 0}
                  onClick={() => choosePull(evidence.pulls[index - 1])}
                >
                  Previous pull
                </button>
                <button
                  className="review-button"
                  aria-label="Next pull"
                  disabled={index < 0 || index >= evidence.pulls.length - 1}
                  onClick={() => choosePull(evidence.pulls[index + 1])}
                >
                  Next pull
                </button>
              </div>
            </div>
            <h3 className="review-pull-title">
              {pull ? 'Pull ' + pull.id + ': ' + pull.name : 'Full run'}
            </h3>
            <p className="review-run-clock">
              {timestamp(pullStart)} - {timestamp(pullEnd)} on the dungeon clock
            </p>
            <div className="review-facts">
              <span>
                <strong>{fmt(pullEnd - pullStart)}s</strong>duration
              </span>
              <span>
                <strong>{wholePull.events.length}</strong>completed casts
              </span>
              <span>
                <strong>{deaths.length}</strong>deaths
              </span>
            </div>
            {!evidence.castsComplete && (
              <output className="data-availability">
                Only some cast events were fetched. Counts may be incomplete;
                cast gaps are not assessed.
              </output>
            )}
            <div className="review-moments">
              <h4>Moments to check</h4>
              {deaths.length === 0 && gaps.length === 0 ? (
                <p>
                  {evidence.castsComplete
                    ? 'No deaths or long completed-cast gaps were detected in this pull. That alone does not prove the rotation was correct.'
                    : 'Cast coverage is incomplete. No reliable cast-gap check is available for this pull.'}
                </p>
              ) : (
                <>
                  {deaths.map((death, i) => (
                    <div
                      className="review-moment death-moment"
                      key={'death-' + i}
                    >
                      <GameIcon name={death.name} icon={death.icon} />
                      <div>
                        <strong>Death at {fmt(death.time - pullStart)}s</strong>
                        <span>Killing blow: {death.name}</span>
                      </div>
                      <button
                        className="review-button"
                        onClick={() => inspectMoment(death.time)}
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                  {gaps.slice(0, 3).map((gap, i) => (
                    <div className="review-moment" key={'gap-' + i}>
                      <span className="review-moment-symbol">!</span>
                      <div>
                        <strong>
                          {fmt(gap.end - gap.start)}s between completed casts
                        </strong>
                        <span>
                          {fmt(gap.start - pullStart)}s -{' '}
                          {fmt(gap.end - pullStart)}s after pull start
                        </span>
                      </div>
                      <button
                        className="review-button"
                        onClick={() => inspectMoment(gap.start)}
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                  {gaps.length > 3 && (
                    <p>Showing the three longest cast gaps in this pull.</p>
                  )}
                  <p>
                    Check whether a channel, mechanic, stun, movement, or death
                    explains the gap. It is not automatically wasted time.
                  </p>
                </>
              )}
            </div>
            <a
              className="coach-link"
              href={logUrl(result, pullStart, pullEnd)}
              target="_blank"
              rel="noreferrer"
            >
              Open this pull in Warcraft Logs
            </a>
          </section>
          <section className="coach-panel review-casts" ref={castsPanel}>
            <div className="review-section-title">
              <h4>Your casts, in order</h4>
              <label className="defensive-filter">
                <input
                  type="checkbox"
                  checked={defensiveOnly}
                  onChange={(event) => {
                    setDefensiveOnly(event.target.checked);
                    setSpellId('all');
                    setEventPage(0);
                    setSelectedCast(null);
                  }}
                />
                Defensives &amp; recovery only
              </label>
              <label>
                Ability
                <select
                  className="coach-select"
                  aria-label="Timeline ability"
                  value={spellId}
                  onChange={(event) => {
                    setSpellId(event.target.value);
                    setSelectedCast(null);
                    setEventPage(0);
                  }}
                >
                  <option value="all">All abilities</option>
                  {spells.map((spell) => (
                    <option key={spell.id} value={spell.id}>
                      {spell.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="review-time-window">
              <strong>
                {fmt(window.start - pullStart)}s - {fmt(window.end - pullStart)}
                s after pull start
              </strong>
              <div className="review-paging">
                <button
                  className="review-button"
                  disabled={window.offset <= 0}
                  onClick={() => moveWindow(Math.max(0, window.offset - 30))}
                >
                  Previous 30s
                </button>
                <button
                  className="review-button"
                  disabled={window.end >= pullEnd}
                  onClick={() => moveWindow(window.offset + 30)}
                >
                  Next 30s
                </button>
                <button
                  className="review-button"
                  disabled={window.offset <= 0}
                  onClick={() => moveWindow(0)}
                >
                  Back to start
                </button>
              </div>
            </div>
            <p className="review-cast-help">
              Read top to bottom. Times start at 0 when this pull begins. Select
              a cast for its exact moment.
            </p>
            <ol
              className="review-cast-list"
              aria-label="Chronological cast sequence"
            >
              {events.slice(page * 20, page * 20 + 20).map((cast, i) => (
                <li key={i}>
                  <button
                    className={
                      'review-cast ' + (activeCast === cast ? 'selected' : '')
                    }
                    aria-pressed={activeCast === cast}
                    onClick={() => setSelectedCast(cast)}
                  >
                    <time>
                      {(cast.time - pullStart).toFixed(1)}
                      <small>seconds</small>
                    </time>
                    <GameIcon id={cast.id} name={cast.name} icon={cast.icon} />
                    <strong>{cast.name}</strong>
                    <span>Inspect</span>
                  </button>
                  {activeCast === cast && (
                    <div className="cast-inspector" aria-live="polite">
                      <GameIcon
                        id={cast.id}
                        name={cast.name}
                        icon={cast.icon}
                      />
                      <div>
                        <strong>{cast.name}</strong>
                        <p>
                          {(cast.time - pullStart).toFixed(2)} seconds after
                          pull start / {timestamp(cast.time)} into the dungeon
                        </p>
                      </div>
                      <a
                        className="coach-link"
                        href={logUrl(result, cast.time - 3, cast.time + 5)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open this moment
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {!events.length && (
              <p className="coach-empty">
                No matching completed casts in these 30 seconds. Try the next
                window or choose another ability.
              </p>
            )}
            {events.length > 20 && (
              <div className="review-event-pages">
                <span>
                  Casts {page * 20 + 1}-
                  {Math.min(events.length, (page + 1) * 20)} of {events.length}{' '}
                  in this window
                </span>
                <button
                  className="review-button"
                  disabled={page === 0}
                  onClick={() => setEventPage(page - 1)}
                >
                  Earlier casts
                </button>
                <button
                  className="review-button"
                  disabled={(page + 1) * 20 >= events.length}
                  onClick={() => setEventPage(page + 1)}
                >
                  More casts
                </button>
              </div>
            )}
            <details className="review-advanced">
              <summary>Show timing and damage charts</summary>
              <p>
                These charts use the same 30-second window as the cast list.
                Each marker is a completed cast, not a cooldown becoming ready.
              </p>
              {activeCast && (
                <div className="cast-inspector" aria-live="polite">
                  <GameIcon
                    id={activeCast.id}
                    name={activeCast.name}
                    icon={activeCast.icon}
                  />
                  <div>
                    <strong>{activeCast.name}</strong>
                    <p>
                      {(activeCast.time - pullStart).toFixed(2)} seconds after
                      pull start / {timestamp(activeCast.time)} into the dungeon
                    </p>
                  </div>
                  <a
                    className="coach-link"
                    href={logUrl(
                      result,
                      activeCast.time - 3,
                      activeCast.time + 5,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open this moment
                  </a>
                </div>
              )}
              {lanes.length > 0 && (
                <SpellTracks
                  lanes={lanes.slice(0, 8)}
                  start={window.start}
                  end={window.end}
                  pullStart={pullStart}
                  selected={activeCast}
                  onSelect={setSelectedCast}
                />
              )}
              {lanes.length > 8 && (
                <p>
                  Showing the eight most-used abilities. Use the ability filter
                  to see another.
                </p>
              )}
              <WindowDamage
                points={window.points}
                start={window.start}
                end={window.end}
                pullStart={pullStart}
              />
              <p>
                Your damage only. Other groups&apos; pulls are not synchronized
                with this run; overall reference DPS is not a pull-by-pull
                target.
              </p>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
