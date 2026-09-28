'use client';
import { useState } from 'react';
import type { buildArcaneReview } from '@/lib/arcane/review';
import { ARCANE } from '@/lib/arcane/catalog';
import type { ReviewFocus } from '@/lib/defensives';
import { timestamp } from './coaching-report';

export function ArcaneBurstReview({
  setups,
  onReview,
}: {
  setups: ReturnType<typeof buildArcaneReview>['burstSetups'];
  onReview: (focus: ReviewFocus) => void;
}) {
  const [page, setPage] = useState(0);
  if (!setups.length) return null;
  const excluded = setups.filter((s) => s.observedSeconds < 20).length;
  const start = Math.min(page * 8, Math.floor((setups.length - 1) / 8) * 8);
  return (
    <details className="moment-insight" aria-label="Burst window context">
      <summary>
        Your burst windows{' '}
        <span>
          {setups.length} Surge casts · {excluded} shortened windows excluded
          from setup checks
        </span>
      </summary>
      <div className="moment-insight-body">
        <p>
          Setup checks require 20 recorded seconds after Surge before the pull
          ends or you die. This is a review window, not the duration of Arcane
          Surge. Short windows remain available to inspect.
        </p>
        <div className="arcane-window-table-wrap">
          <table>
            <caption>Surge timing and recorded Touch follow-up</caption>
            <thead>
              <tr>
                <th scope="col">Surge</th>
                <th scope="col">Touch after Surge</th>
                <th scope="col">Time before boundary</th>
                <th scope="col">Context</th>
              </tr>
            </thead>
            <tbody>
              {setups.slice(start, start + 8).map((s, i) => (
                <tr key={s.time + ':' + i}>
                  <th scope="row">
                    <button
                      className="training-button"
                      onClick={() =>
                        onReview({ time: s.startedAt, spellId: ARCANE.surge })
                      }
                    >
                      {timestamp(s.startedAt)}
                    </button>
                  </th>
                  <td>
                    {s.delay === null
                      ? 'Not recorded in observed slice'
                      : `+${s.delay.toFixed(1)}s`}
                  </td>
                  <td>
                    {s.observedSeconds.toFixed(1)}s ·{' '}
                    {s.endedByDeath ? 'recorded death' : 'pull / log end'}
                  </td>
                  <td>
                    {s.observedSeconds < 20
                      ? 'Shortened; no setup verdict'
                      : 'Setup assessable; readiness unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {setups.length > 8 && (
          <div className="brief-pager">
            <button
              className="training-button"
              disabled={start === 0}
              onClick={() => setPage(Math.max(0, page - 1))}
            >
              Previous burst windows
            </button>
            <span>
              {start + 1}–{Math.min(start + 8, setups.length)} / {setups.length}
            </span>
            <button
              className="training-button"
              disabled={start + 8 >= setups.length}
              onClick={() => setPage(page + 1)}
            >
              Next burst windows
            </button>
          </div>
        )}
        <p>
          Touch delay is measured from successful Surge. A short pull, target
          transition, or planned cooldown hold can explain the sequence. This
          does not count missed cooldown uses or predict damage gained.
        </p>
      </div>
    </details>
  );
}
