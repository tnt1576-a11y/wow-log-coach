'use client';
import { useMemo } from 'react';
import type { AnalysisResult } from '@/lib/domain';
import type { BriefMoment } from '@/lib/run-brief';
import type { BuildOverrides } from '@/lib/arcane/catalog';
import { arcaneDecisionContext } from '@/lib/arcane/decision-context';
import { momentContext, patternBreakdown } from '@/lib/review-context';
import { isPrioritySpec } from '@/lib/priority-specs';
import { timestamp, compact } from './coaching-report';

export function MomentInsight({
  result,
  moment,
  overrides,
}: {
  result: AnalysisResult;
  moment: BriefMoment;
  overrides?: BuildOverrides;
}) {
  const context = useMemo(
    () => momentContext(result.evidence, moment),
    [result.evidence, moment],
  );
  const arcane = useMemo(
    () => arcaneDecisionContext(result, moment.time, moment.spellId, overrides),
    [result, moment.time, moment.spellId, overrides],
  );
  if (!isPrioritySpec(result.target)) return null;
  return (
    <details className="moment-insight">
      <summary>
        Explain this moment <span>Context &amp; evidence</span>
      </summary>
      <div className="moment-insight-body">
        <div className="insight-facts">
          <div>
            <span>Recorded action</span>
            <strong>
              {context.cast?.name ??
                (context.death ? 'Death recorded' : 'Review window')}
            </strong>
          </div>
          <div>
            <span>
              {context.endedByDeath
                ? 'Until the next recorded death'
                : 'Remaining in this pull'}
            </span>
            <strong>
              {context.remaining === null
                ? 'Unknown'
                : `${context.remaining.toFixed(1)}s`}
            </strong>
          </div>
          {arcane && (
            <div>
              <span>Hero tree · {arcane.hero.source}</span>
              <strong>
                {arcane.hero.value === 'unknown'
                  ? 'Unknown'
                  : arcane.hero.value}
              </strong>
            </div>
          )}
        </div>
        <p>
          Remaining time ends at the pull boundary or first recorded death. It
          does not establish uninterrupted target access.
        </p>
        {arcane && (
          <>
            <h4>State before the recorded decision</h4>
            <dl className="insight-states">
              {arcane.states.map((s) => (
                <div key={s.id}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
            <h4>What this means</h4>
            {arcane.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p>
              <a href={arcane.source} target="_blank" rel="noreferrer">
                Method guide for this decision
              </a>
            </p>
          </>
        )}
        {context.cast && result.target.className === 'Mage' && (
          <p>
            <strong>Mana context: </strong>
            {context.mana
              ? `${context.mana.percent.toFixed(1)}% at the successful cast event (${timestamp(context.mana.time)}). This is not verified mana before payment.`
              : 'No usable mana snapshot for this exact cast.'}
          </p>
        )}
        {context.death && (
          <>
            <h4>
              Largest recorded hits in the {context.death.window}s lead-up
            </h4>
            {context.hits.length ? (
              <ul>
                {context.hits.map((h, i) => (
                  <li key={i}>
                    {timestamp(h.time)} · {h.name} · {compact(h.amount)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Detailed hit events are unavailable.</p>
            )}
            <p>
              Recorded totals in this window: {compact(context.death.damage)}{' '}
              damage and {compact(context.death.healing)} healing. These totals
              do not establish health at each moment or avoidability.
            </p>
          </>
        )}
        <h4>Defensive and recovery activations nearby</h4>
        {context.defensives.length ? (
          <ul>
            {context.defensives.map((c, i) => (
              <li key={i}>
                {timestamp(c.time)} · {c.name}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {context.castComplete
              ? 'No tracked activation recorded in this lookback.'
              : 'Cast coverage is incomplete; absence cannot be assessed.'}
          </p>
        )}
        <p>
          Lookback: {context.death?.window ?? 10}s. Activations do not prove a
          defensive was still active. Resources, cooldown readiness, movement,
          and attackable targets may be unknown; no exact damage-loss estimate
          is made.
        </p>
      </div>
    </details>
  );
}

export function PatternSummary({
  result,
  moments,
  eligible,
  onPull,
}: {
  result: AnalysisResult;
  moments: BriefMoment[];
  eligible?: number;
  onPull: (id: number) => void;
}) {
  const pattern = useMemo(
    () => patternBreakdown(result, moments),
    [result, moments],
  );
  if (!isPrioritySpec(result.target) || pattern.total < 2) return null;
  return (
    <details className="moment-insight pattern-insight">
      <summary>
        Where this repeats{' '}
        <span>
          {pattern.total} distinct moments · {pattern.rows.length} pulls
        </span>
      </summary>
      <div className="moment-insight-body">
        <p>
          {pattern.boss} on bosses · {pattern.trash} on trash
          {pattern.unlocated > 0
            ? ` · ${pattern.unlocated} without a known pull`
            : ''}
          .
          {eligible !== undefined &&
            ` The guide assessed ${eligible} observations across the run.`}{' '}
          These are review occurrences, not a failure rate. Pull-specific
          opportunity counts are not established.
        </p>
        <div className="pattern-pulls">
          {pattern.rows.map(({ pull, count }) => (
            <button key={pull.id} onClick={() => onPull(pull.id)}>
              <span>
                {timestamp(pull.start)} · {pull.name}
                <small>
                  {pull.boss ? 'Boss' : 'Trash'} ·{' '}
                  {(pull.end - pull.start).toFixed(0)}s pull
                </small>
              </span>
              <strong>
                {count} {count === 1 ? 'moment' : 'moments'}
              </strong>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
