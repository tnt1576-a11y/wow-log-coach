'use client';
// oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG chart markers require accessible roles.
import { useState } from 'react';
import type { AnalysisResult, CastEvent, PullEvidence } from '@/lib/domain';
import { spellLanes } from '@/lib/timeline';
import { floorTiles, projectPull, type DungeonFloor } from '@/lib/dungeon-maps';
import { compact, fmt, timestamp } from './coaching-report';

export function SpellTracks({
  lanes,
  start,
  end,
  pullStart,
  selected,
  onSelect,
}: {
  lanes: ReturnType<typeof spellLanes>;
  start: number;
  end: number;
  pullStart: number;
  selected: CastEvent | null;
  onSelect: (cast: CastEvent) => void;
}) {
  const x = (time: number) =>
    212 + ((time - start) / Math.max(0.001, end - start)) * 550;
  const height = lanes.length * 46 + 42;
  return (
    <div className="spell-track-scroll">
      <svg
        className="spell-tracks"
        viewBox={'0 0 800 ' + height}
        role="group"
        aria-label="Completed casts by spell in the selected window"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={212 + fraction * 550}
              x2={212 + fraction * 550}
              y1="5"
              y2={height - 32}
              stroke="#334155"
              strokeDasharray="3 4"
            />
            <text
              x={212 + fraction * 550}
              y={height - 8}
              textAnchor={
                fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'
              }
            >
              +{timestamp(start - pullStart + fraction * (end - start))}
            </text>
          </g>
        ))}
        {lanes.map((lane, row) => (
          <g key={lane.id}>
            <text x="6" y={row * 46 + 27} className="spell-lane-label">
              {lane.name.length > 25
                ? lane.name.slice(0, 23) + '...'
                : lane.name}
              <title>{lane.name}</title>
            </text>
            <text x="196" y={row * 46 + 27} textAnchor="end">
              {lane.events.length}
            </text>
            <line
              x1="212"
              x2="762"
              y1={row * 46 + 23}
              y2={row * 46 + 23}
              stroke="#1e293b"
            />
            {lane.events.map((event, eventIndex) => (
              <g
                key={eventIndex}
                role="button"
                tabIndex={0}
                className="spell-event-marker"
                aria-label={
                  event.name +
                  ', ' +
                  (event.time - pullStart).toFixed(2) +
                  ' seconds into pull'
                }
                aria-pressed={selected === event}
                onClick={() => onSelect(event)}
                onKeyDown={(key) => {
                  if (key.key === 'Enter' || key.key === ' ') {
                    key.preventDefault();
                    onSelect(event);
                  }
                }}
              >
                <rect
                  x={x(event.time) - 6}
                  y={row * 46 + 11}
                  width="12"
                  height="24"
                  rx="3"
                  fill={
                    selected === event
                      ? '#f8fafc'
                      : row % 2
                        ? '#c4b5fd'
                        : '#67e8f9'
                  }
                  stroke={selected === event ? '#a78bfa' : '#0f172a'}
                  strokeWidth="1.5"
                />
                <title>
                  {event.name +
                    ' / +' +
                    (event.time - pullStart).toFixed(2) +
                    's into pull / ' +
                    timestamp(event.time) +
                    ' into run'}
                </title>
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function TerrainMap({
  floor,
  pulls,
  selectedId,
  onSelect,
}: {
  floor?: DungeonFloor;
  pulls: PullEvidence[];
  selectedId?: number;
  onSelect: (pull: PullEvidence) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (!floor)
    return (
      <div className="data-availability">
        <strong>No terrain matched this report&apos;s floor.</strong>
        <p>
          You can still review casts using the pull list. The report may omit
          its map ID or use an unmapped floor.
        </p>
      </div>
    );
  if (failed)
    return (
      <div className="data-availability" role="alert">
        <strong>Map image could not be loaded.</strong>
        <p>
          The terrain tiles for {floor.name} are unavailable. The pull selector
          still works.
        </p>
        <button className="review-button" onClick={() => setFailed(false)}>
          Retry map image
        </button>
      </div>
    );
  const mapped = pulls.flatMap((pull) => {
    const point = projectPull(pull, floor);
    return point ? [{ pull, point }] : [];
  });
  return (
    <div className="terrain-map">
      <svg
        viewBox="0 0 768 512"
        role="group"
        aria-label={floor.name + ' dungeon terrain and pull locations'}
      >
        {floorTiles(floor).map((tile) => (
          <image
            key={tile.src}
            href={tile.src}
            x={tile.x}
            y={tile.y}
            width={tile.width}
            height={tile.height}
            onError={() => setFailed(true)}
          />
        ))}
        {mapped.map(({ pull, point }) => (
          <g
            key={pull.id}
            role="button"
            tabIndex={0}
            className="terrain-marker"
            aria-label={'Pull ' + pull.id + ': ' + pull.name}
            aria-pressed={selectedId === pull.id}
            onClick={() => onSelect(pull)}
            onKeyDown={(key) => {
              if (key.key === 'Enter' || key.key === ' ') {
                key.preventDefault();
                onSelect(pull);
              }
            }}
          >
            {selectedId === pull.id && (
              <circle
                cx={point.x}
                cy={point.y}
                r="25"
                fill="#ffffff20"
                stroke="#ffffff"
                strokeWidth="3"
              />
            )}
            <circle
              cx={point.x}
              cy={point.y}
              r="20"
              fill={
                selectedId === pull.id
                  ? '#f8fafc'
                  : pull.boss
                    ? '#c4b5fd'
                    : '#67e8f9'
              }
              stroke={pull.deaths ? '#fb7185' : '#111827'}
              strokeWidth="3"
            />
            <text
              x={point.x}
              y={point.y + 7}
              textAnchor="middle"
              fill="#111827"
              fontSize="21"
              fontWeight="700"
            >
              {pull.id}
            </text>
            <title>
              {pull.name + ' / ' + timestamp(pull.start) + ' into the run'}
            </title>
          </g>
        ))}
      </svg>
      {mapped.length < pulls.length && (
        <p className="coach-footnote">
          {pulls.length - mapped.length} pull markers lack valid coordinates
          within this floor&apos;s bounds and are not plotted.
        </p>
      )}
      <p className="map-attribution">
        Map data &copy; Blizzard Entertainment. Terrain and floor metadata via{' '}
        <a href="https://keystone.guru" target="_blank" rel="noreferrer">
          Keystone.guru
        </a>
        . Markers show pull locations, not a movement path.
      </p>
    </div>
  );
}

export function logUrl(result: AnalysisResult, start: number, end: number) {
  return (
    result.target.url +
    '&start=' +
    Math.round(
      (result.evidence?.reportStart ?? 0) + Math.max(0, start) * 1000,
    ) +
    '&end=' +
    Math.round(
      (result.evidence?.reportStart ?? 0) +
        Math.min(result.evidence?.duration ?? end, end) * 1000,
    )
  );
}

export function WindowDamage({
  points,
  start,
  end,
  pullStart,
}: {
  points: Array<{ time: number; value: number }>;
  start: number;
  end: number;
  pullStart: number;
}) {
  if (!points.length)
    return (
      <p className="coach-empty">
        No damage samples are available for this window.
      </p>
    );
  const max = Math.max(1, ...points.map((point) => point.value)) * 1.1;
  const x = (time: number) =>
    72 + ((time - start) / Math.max(0.001, end - start)) * 694;
  const y = (value: number) => 178 - (value / max) * 145;
  return (
    <div className="window-damage">
      <h4>Your damage per second</h4>
      <svg
        viewBox="0 0 800 230"
        role="img"
        aria-label="Your DPS in the selected pull window"
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="72"
              x2="766"
              y1={y(max * fraction)}
              y2={y(max * fraction)}
              stroke="#334155"
            />
            <text x="62" y={y(max * fraction) + 4} textAnchor="end">
              {compact(max * fraction)}
            </text>
          </g>
        ))}
        <polyline
          points={points
            .map((point) => x(point.time) + ',' + y(point.value))
            .join(' ')}
          fill="none"
          stroke="#67e8f9"
          strokeWidth="2.5"
        />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={x(point.time)}
            cy={y(point.value)}
            r="3"
            fill="#67e8f9"
          >
            <title>
              {'+' +
                (point.time - pullStart).toFixed(1) +
                's into pull: ' +
                fmt(point.value) +
                ' DPS'}
            </title>
          </circle>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <text
            key={fraction}
            x={72 + fraction * 694}
            y="205"
            textAnchor={
              fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'
            }
          >
            +{timestamp(start - pullStart + fraction * (end - start))}
          </text>
        ))}
        <text x="410" y="228" textAnchor="middle">
          Time since this pull started
        </text>
      </svg>
    </div>
  );
}
