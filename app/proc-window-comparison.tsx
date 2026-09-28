'use client';
import { useState } from 'react';
import type { RunEvidence } from '@/lib/domain';
import type { GuideCheck, GuideProcWindow } from '@/lib/guides/types';
import { castDecisionTime } from '@/lib/cast-sequence';
import { GameIcon, timestamp } from './coaching-report';

function WindowDetail({
  window,
  evidence,
  label,
}: {
  window: GuideProcWindow;
  evidence: RunEvidence;
  label: string;
}) {
  const casts = evidence.casts
    .filter(
      (cast) =>
        castDecisionTime(cast) >= window.start &&
        castDecisionTime(cast) <= window.end,
    )
    .sort((a, b) => castDecisionTime(a) - castDecisionTime(b));
  return (
    <section className="proc-window-side">
      <h4>{label}</h4>
      <p>
        {timestamp(window.start)}–{timestamp(window.end)} ·{' '}
        {(window.end - window.start).toFixed(1)}s buff window
      </p>
      <strong>
        {window.consumer
          ? window.consumer.name +
            ' after ' +
            Math.max(
              0,
              castDecisionTime(window.consumer) - window.start,
            ).toFixed(1) +
            's'
          : 'No matching follow-up cast recorded'}
      </strong>
      <details>
        <summary>
          What filled this window? ({casts.length} recorded casts)
        </summary>
        {casts.length ? (
          <ol className="proc-window-casts">
            {casts.map((cast, index) => (
              <li key={cast.time + ':' + index}>
                <span>
                  +{(castDecisionTime(cast) - window.start).toFixed(1)}s
                </span>
                <GameIcon id={cast.id} name={cast.name} icon={cast.icon} />
                <span>
                  {cast.name}
                  {cast === window.consumer ? ' · follow-up' : ''}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            No player casts were recorded inside this window. Check target
            access and downtime.
          </p>
        )}
      </details>
    </section>
  );
}

export function ProcWindowComparison({
  yourCheck,
  referenceCheck,
  time,
  yourEvidence,
  referenceEvidence,
  pullId,
  referenceName,
}: {
  yourCheck: GuideCheck;
  referenceCheck?: GuideCheck;
  time: number;
  yourEvidence: RunEvidence;
  referenceEvidence: RunEvidence;
  pullId?: number;
  referenceName: string;
}) {
  const [selectedStart, setSelectedStart] = useState('');
  const yours = yourCheck.procWindows?.find(
    (window) => Math.abs(window.end - time) < 0.01,
  );
  if (!yours) return null;
  const candidates =
    referenceCheck?.procWindows?.filter((window) => window.pullId === pullId) ??
    [];
  const theirs =
    candidates.find((window) => String(window.start) === selectedStart) ??
    candidates[0];
  return (
    <section
      className="proc-window-comparison"
      aria-label="Same proc window comparison"
    >
      <h3>Compare the same opportunity</h3>
      <p>
        Both examples begin when the same buff appears. Compare your spell
        choices, not the dungeon clock.
      </p>
      {candidates.length > 0 && (
        <label className="training-field">
          Reference buff window
          <select
            value={String(theirs!.start)}
            onChange={(event) => setSelectedStart(event.target.value)}
          >
            {candidates.map((window) => (
              <option key={window.start} value={String(window.start)}>
                {timestamp(window.start)} ·{' '}
                {window.consumer ? window.consumer.name : 'no follow-up'}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="proc-window-pair">
        <WindowDetail window={yours} evidence={yourEvidence} label="You" />
        {theirs ? (
          <WindowDetail
            window={theirs}
            evidence={referenceEvidence}
            label={referenceName}
          />
        ) : (
          <p>
            Choose a comparable pull with a complete window of this buff. No
            matching example is available in the current selection.
          </p>
        )}
      </div>
      <p className="training-note">
        These are full buff windows, which can have different lengths. Cast
        totals and response speed are not scores. Targets, resources, talents
        and mechanics may differ; recorded casts can include triggered effects.
      </p>
    </section>
  );
}
