'use client';
import { useState } from 'react';
import type { AnalysisResult } from '@/lib/domain';
import {
  aurasAroundMoment,
  castsAroundMoment,
  dangerMoments,
  incomingAroundMoment,
  matchingDamageMoments,
  type DangerMoment,
} from '@/lib/defensives';
import { referenceKey } from '@/lib/reference-selection';
import { useReferenceEvidence } from './use-reference-evidence';
import { GameIcon, compact, fmt, timestamp } from './coaching-report';
import { Ability } from './ability';

export function DefensiveIncoming({
  result,
  moment,
  lookback,
}: {
  result: AnalysisResult;
  moment: DangerMoment;
  lookback: number;
}) {
  const incoming = incomingAroundMoment(result, moment, lookback);
  return (
    <section
      className="defense-evidence-card"
      aria-label="Incoming damage abilities and enemy sources"
    >
      <div className="defense-evidence-heading">
        <div>
          <h4>What damage landed?</h4>
          <p>
            {timestamp(incoming.start)}–{timestamp(incoming.end)} ·{' '}
            {compact(incoming.total)} recorded damage
          </p>
        </div>
        <span className="defense-evidence-badge">
          {incoming.deathFallback
            ? 'Death recap only'
            : incoming.complete
              ? 'Hit events loaded'
              : 'Partial hit evidence'}
        </span>
      </div>
      {incoming.sources.length ? (
        <div className="coach-table-wrap">
          <table className="coach-table defense-source-table">
            <thead>
              <tr>
                <th>Incoming ability / enemy</th>
                <th>Damage in window</th>
                <th>Hits / largest hit</th>
              </tr>
            </thead>
            <tbody>
              {incoming.sources.map((source, index) => (
                <tr key={[source.id, source.sourceId, index].join(':')}>
                  <th scope="row">
                    {source.id ? (
                      <Ability
                        id={source.id}
                        name={source.name}
                        icon={source.icon}
                      />
                    ) : (
                      <span className="icon-label">
                        <GameIcon
                          id={source.id}
                          name={source.name}
                          icon={source.icon}
                        />
                        {source.name}
                      </span>
                    )}
                    <small className="defense-source-name">
                      {source.sourceName ?? 'Enemy source not recorded'}
                    </small>
                  </th>
                  <td>
                    {compact(source.amount)}
                    <small>
                      {incoming.total > 0
                        ? Math.round((source.amount / incoming.total) * 100)
                        : 0}
                      % of fetched window damage
                    </small>
                  </td>
                  <td>
                    {source.hits} hits
                    <small>{compact(source.largestHit)} largest</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="training-note">
          No individual damage hits were fetched for this window. A sampled
          graph cannot identify the damaging ability or enemy.
        </p>
      )}
      <p className="training-side-note">
        {incoming.deathFallback
          ? 'The death recap may omit earlier hits and enemy names. '
          : ''}
        {!incoming.complete && !incoming.deathFallback
          ? 'Missing events can change totals and source rankings. '
          : ''}
        These are recorded damage amounts, not damage prevented or proof the
        mechanic was avoidable.
      </p>
    </section>
  );
}

export function DefensiveProtection({
  result,
  moment,
  lookback,
}: {
  result: AnalysisResult;
  moment: DangerMoment;
  lookback: number;
}) {
  const auras = aurasAroundMoment(result, moment, lookback);
  const complete = result.evidence?.defensiveAuras?.complete === true;
  return (
    <section
      className="defense-evidence-card"
      aria-label="Observed personal and external protection"
    >
      <div className="defense-evidence-heading">
        <div>
          <h4>Protection received</h4>
          <p>
            Buff evidence on {result.target.player}, including allied defensives
          </p>
        </div>
        <span className="defense-evidence-badge">
          {complete ? 'Buff events loaded' : 'Partial / unavailable buff data'}
        </span>
      </div>
      {auras.length ? (
        <div className="defense-protection-list">
          {auras.map((aura, index) => (
            <div
              className="defense-protection"
              key={aura.id + ':' + aura.start + ':' + index}
              data-external={aura.external === true}
            >
              <div>
                <Ability id={aura.id} name={aura.name} icon={aura.icon} />
                <small>
                  {aura.sourceName ??
                    (aura.external === false
                      ? result.target.player
                      : 'Unknown caster')}{' '}
                  → {aura.targetName ?? result.target.player} ·{' '}
                  {aura.external === true
                    ? 'External received'
                    : aura.external === false
                      ? 'Self-cast effect'
                      : 'Caster unknown'}
                </small>
              </div>
              <div className="defense-protection-timing">
                <strong>
                  {timestamp(aura.start)}
                  {aura.end === null
                    ? ' · end unobserved'
                    : '–' + timestamp(aura.end)}
                </strong>
                <small>
                  {aura.end === null
                    ? 'Application observed; coverage uncertain'
                    : aura.overlappingHits
                      ? aura.overlappingHits +
                        ' fetched hits inside observed buff interval'
                      : 'No fetched hits strictly inside this interval'}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="training-note">
          No tracked received buffs {complete ? 'recorded' : 'fetched'} in this
          damage window. This does not establish that you had no protection.
        </p>
      )}
      <p className="training-side-note">
        Only paired application and removal events establish an observed
        interval. Open effects and same-timestamp boundaries remain uncertain.
        Overlap does not measure mitigation or prove the effect worked against
        that damage type.
      </p>
    </section>
  );
}

export function DefensivePhases({
  result,
  moment,
  lookback,
}: {
  result: AnalysisResult;
  moment: DangerMoment;
  lookback: number;
}) {
  const casts = castsAroundMoment(result, moment, lookback);
  return (
    <div className="defensive-phases">
      {[
        {
          id: 'before',
          title: 'Before',
          detail: 'Cast before the selected moment',
        },
        {
          id: 'during',
          title: moment.duration
            ? 'During the sample'
            : 'At the same timestamp',
          detail: moment.duration
            ? fmt(moment.duration) + 's sampled window'
            : 'Event order at this instant is uncertain',
        },
        {
          id: 'after',
          title: 'After',
          detail: 'Up to 5s after; recovery or later use',
        },
      ].map((phase) => {
        const items = casts.filter((cast) =>
          phase.id === 'during'
            ? cast.phase === 'at' || cast.phase === 'during'
            : cast.phase === phase.id,
        );
        return (
          <div className="defensive-phase" data-phase={phase.id} key={phase.id}>
            <h4>{phase.title}</h4>
            <small>{phase.detail}</small>
            {items.length ? (
              items.map((cast, index) => (
                <div
                  className="defensive-phase-cast"
                  key={cast.time + ':' + index}
                >
                  <span>
                    <Ability
                      id={cast.id}
                      name={cast.name}
                      icon={cast.icon ?? cast.definition.icon}
                    />
                    <small>
                      {cast.definition.kind === 'recovery'
                        ? 'Self-recovery'
                        : cast.definition.kind === 'group'
                          ? 'Group defensive'
                          : cast.definition.kind === 'external'
                            ? 'External-capable cast; recipient not inferred'
                            : 'Personal defensive'}{' '}
                      · {cast.offset >= 0 ? '+' : ''}
                      {fmt(cast.offset)}s
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p>
                No tracked casts
                {result.evidence?.castsComplete ? '' : ' fetched'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DefensiveReference({
  result,
  lookback,
  selectedMoment,
}: {
  result: AnalysisResult;
  lookback: number;
  selectedMoment?: DangerMoment;
}) {
  const [selected, setSelected] = useState(
    result.references[0] ? referenceKey(result.references[0]) : '',
  );
  const reference = result.references.find(
    (run) => referenceKey(run) === selected,
  );
  const { evidence, error, retry, unavailable } = useReferenceEvidence(
    result,
    reference,
  );
  const [choice, setChoice] = useState<{ key: string; id: string }>();
  const refResult: AnalysisResult | null =
    evidence && reference?.metrics
      ? {
          ...result,
          targetMetrics: reference.metrics,
          evidence,
          target: {
            ...result.target,
            player: reference.player,
            reportCode: reference.reportCode,
            sourceId: reference.sourceId!,
            fightId: reference.fightId,
            className: reference.className,
            specName: reference.specName,
          },
        }
      : null;
  const matched =
    refResult && selectedMoment
      ? matchingDamageMoments(result, refResult, selectedMoment, lookback)
      : [];
  const moments = refResult ? dangerMoments(refResult) : [];
  const selectionKey = selected + ':' + selectedMoment?.id;
  const moment =
    (choice?.key === selectionKey
      ? [...matched, ...moments].find((entry) => entry.id === choice.id)
      : undefined) ??
    matched[0] ??
    moments[0];
  return (
    <div className="training-reference defensive-reference">
      <div className="training-reference-heading">
        <span className="training-row-label">
          WHAT DID A REFERENCE PLAYER DEFEND AGAINST?
        </span>
        <label>
          <span className="sr-only">Defensive reference player</span>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {result.references.map((run, index) => (
              <option value={referenceKey(run)} key={referenceKey(run)}>
                #{index + 1} {run.player} · {compact(run.rankingDps ?? run.dps)}{' '}
                DPS
              </option>
            ))}
          </select>
        </label>
      </div>
      {!reference ? (
        <p className="training-note">
          No reference players match these filters.
        </p>
      ) : !evidence ? (
        <output className="training-reference-loading">
          {unavailable ||
            error ||
            'Loading reference damage and defensive events...'}
          {error && (
            <button className="training-button" onClick={retry}>
              Retry
            </button>
          )}
        </output>
      ) : !refResult ? (
        <p className="training-note">
          Reference metrics are unavailable. Re-analyze to request them.
        </p>
      ) : (
        <>
          <label className="training-field">
            Their damage event
            <select
              aria-label="Reference danger moment"
              value={moment?.id ?? ''}
              onChange={(event) =>
                setChoice({ key: selectionKey, id: event.target.value })
              }
            >
              {!moment && <option value="">No damage events available</option>}
              {matched.length > 0 && (
                <optgroup label="Same incoming abilities as your selected window">
                  {matched.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {timestamp(entry.time)} · {entry.label}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Their deaths and high-damage samples">
                {moments.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {timestamp(entry.time)} ·{' '}
                    {entry.kind === 'death'
                      ? 'Death: ' + entry.label
                      : entry.kind === 'hit'
                        ? 'Hit: ' + entry.label
                        : 'High intake: ' + compact(entry.value) + '/sec'}{' '}
                    ·{' '}
                    {evidence.pulls.find((pull) => pull.id === entry.pullId)
                      ?.name ?? 'Fight timeline'}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <p className="training-side-note">
            {matched.length
              ? 'Matching uses the same damage ability and, when known, the same enemy name. '
              : 'No matching individual damage events were fetched for your selected window; review their independent danger windows. '}
            Damage size, target selection, gear and group support can differ. A
            higher parse does not prove a better defensive decision.
          </p>
          {moment && (
            <>
              <p className="training-note">
                {reference.player} at {timestamp(moment.time)} ·{' '}
                {moment.kind === 'death'
                  ? 'Recorded death'
                  : moment.kind === 'hit'
                    ? 'Matching recorded hit'
                    : fmt(moment.duration) + 's damage sample'}
                {!evidence.castsComplete ? ' / Cast data incomplete' : ''}
              </p>
              <DefensiveIncoming
                result={refResult}
                moment={moment}
                lookback={lookback}
              />
              <DefensiveProtection
                result={refResult}
                moment={moment}
                lookback={lookback}
              />
              <DefensivePhases
                result={refResult}
                moment={moment}
                lookback={lookback}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
