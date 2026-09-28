'use client';
import { useEffect, useState } from 'react';
import type { AnalysisProgress } from '@/lib/analysis-context';
import { Button } from '@/components/ui/button';

const stages = [
  'inspection',
  'target',
  'events',
  'rankings',
  'references',
  'summary',
];
const labels = [
  'Verify report',
  'Load player tables',
  'Load event evidence',
  'Search rankings',
  'Verify references',
  'Build comparisons',
];
export function AnalysisLoading({
  updates,
  startedAt,
  onCancel,
  stopped = false,
}: {
  updates: AnalysisProgress[];
  startedAt: number;
  onCancel: () => void;
  stopped?: boolean;
}) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const last = updates.at(-1);
  const stage =
    [...updates].reverse().find((entry) => stages.includes(entry.stage))
      ?.stage ?? 'inspection';
  const reference = [...updates]
    .reverse()
    .find((entry) => entry.selected !== undefined);
  const rejections = [...updates]
    .reverse()
    .find((entry) => entry.rejectionCounts)?.rejectionCounts;
  const quota = [...updates].reverse().find((entry) => entry.quota)?.quota;
  const budget = [...updates].reverse().find((entry) => entry.budget)?.budget;
  const stats = [...updates]
    .reverse()
    .find((entry) => entry.requests !== undefined);
  const seconds = Math.max(
    0,
    Math.floor(((stopped ? (last?.at ?? now) : now) - startedAt) / 1000),
  );
  return (
    <section
      className="analysis-loading panel"
      aria-label="Comparison progress"
    >
      <header>
        <div>
          <h2>
            {stopped
              ? 'Comparison stopped — activity retained'
              : 'Comparing your log'}
          </h2>
          <p aria-live="polite">
            {last?.message ?? 'Connecting to the comparison service…'}
          </p>
        </div>
        {!stopped && (
          <Button variant="outline" onClick={onCancel}>
            Cancel comparison
          </Button>
        )}
      </header>
      <div className="analysis-stages">
        {labels.map((label, index) => (
          <span
            key={label}
            data-active={index === stages.indexOf(stage)}
            data-done={index < stages.indexOf(stage)}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>
      <div className="analysis-stats">
        <span>
          Elapsed{' '}
          <b>
            {Math.floor(seconds / 60)}m {seconds % 60}s
          </b>
        </span>
        <span>
          API requests <b>{stats?.requests ?? 0}</b>
        </span>
        <span>
          Cache reuses <b>{stats?.cacheHits ?? 0}</b>
        </span>
        <span>
          Matches found <b>{reference?.selected ?? 0}</b> (up to 20)
        </span>
        <span>
          Candidates checked <b>{reference?.checked ?? 0}</b>
        </span>
      </div>
      <p className="analysis-help">
        The review can finish with fewer than 20 matches. Candidates below your
        percentile range are skipped before loading their report or player
        tables. Search checks at most 60 candidates; spending limits return the
        matches already collected. Each API request has a 45-second deadline;
        the whole comparison stops after 15 minutes.
      </p>
      {rejections && Object.keys(rejections).length > 0 && (
        <p className="analysis-help">
          Filtered so far:{' '}
          {Object.entries(rejections)
            .map(([reason, count]) => reason + ': ' + count)
            .join(' · ')}
          .
        </p>
      )}
      {budget && (
        <p className="analysis-budget">
          This review: <b>{budget.pointsSpent.toFixed(1)}</b> observed points
          used · <b>{Math.floor(budget.pointLimit)}</b> point spending
          allowance. Requests stop based on estimated next cost.
        </p>
      )}
      {quota ? (
        <p className="analysis-budget">
          API budget:{' '}
          <b>
            {Math.max(0, quota.limit - quota.spent).toFixed(0)} / {quota.limit}
          </b>{' '}
          points remaining at last update. Reset in{' '}
          {Math.max(
            0,
            Math.ceil((quota.resetAt - Math.max(now, last?.at ?? 0)) / 60_000),
          )}{' '}
          minutes. The app pauses new API calls at 90% usage.
        </p>
      ) : (
        <p className="analysis-help">
          API budget will appear when Warcraft Logs reports it.
        </p>
      )}
      <details open>
        <summary>Activity log · latest {updates.length} updates</summary>
        <ol className="analysis-log">
          {updates.map((entry, index) => (
            <li key={index}>
              <time>{new Date(entry.at).toLocaleTimeString()}</time>
              <span>{entry.message}</span>
            </li>
          ))}
        </ol>
      </details>
      <p className="analysis-help">
        Refreshing does not restore API quota. Cancel stops this connection;
        another tab sharing the same comparison may keep it running. Completed
        report responses are cached for up to an hour; rankings and finished
        comparisons for 10 minutes, within memory limits while this server stays
        running.
      </p>
    </section>
  );
}
