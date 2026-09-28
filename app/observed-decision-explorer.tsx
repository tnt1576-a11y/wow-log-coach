'use client';
import { useState, type ReactNode } from 'react';
import type { GuideCheck, GuideMoment } from '@/lib/guides/types';
import { GameIcon, timestamp } from './coaching-report';
import type { RunEvidence } from '@/lib/domain';
import { momentSequence, castDecisionTime } from '@/lib/cast-sequence';

export function ObservedDecisionExplorer({
  checks,
  renderReference,
  evidence,
}: {
  checks: GuideCheck[];
  evidence?: RunEvidence;
  renderReference: (check: GuideCheck, decision: GuideMoment) => ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const [checkId, setCheckId] = useState('');
  const [index, setIndex] = useState(0);
  const choices = checks.filter(
    (check) =>
      check.status === 'observed' &&
      check.eligible > 0 &&
      check.decisions?.length,
  );
  const check = choices.find((entry) => entry.id === checkId) ?? choices[0];
  const decisions = check?.decisions ?? [];
  const decision = decisions[index] ?? decisions[0];
  if (!check || !decision) return null;
  return (
    <section
      className="training-lesson"
      aria-label="Study decisions without flags"
    >
      <h3>No flags? Study your recorded decisions</h3>
      <p className="training-note">
        These decisions passed the limited check, not a complete rotation test.
        Compare the setup and follow-through with a DPS-selected reference to
        investigate differences. No mistake or recoverable damage is implied.
      </p>
      <button
        className="training-button"
        aria-expanded={opened}
        onClick={() => setOpened(!opened)}
      >
        {opened ? 'Close recorded decisions' : 'Compare recorded decisions'}
      </button>
      {opened && (
        <>
          <label className="training-field">
            Decision check
            <select
              value={check.id}
              onChange={(event) => {
                setCheckId(event.target.value);
                setIndex(0);
              }}
            >
              {choices.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </label>
          <label className="training-field">
            Your assessed decision
            <select
              value={decisions.indexOf(decision)}
              onChange={(event) => setIndex(Number(event.target.value))}
            >
              {decisions.map((entry, i) => (
                <option key={entry.time + ':' + i} value={i}>
                  {i + 1} / {decisions.length} · {timestamp(entry.time)}
                </option>
              ))}
            </select>
          </label>
          <p className="training-observation">{decision.detail}</p>
          <div className="training-replay">
            <span className="training-row-label">YOUR RECORDED CASTS</span>
            <div className="training-spell-sequence">
              {momentSequence(evidence, decision.time, decision.spellId).map(
                (cast, i) => (
                  <div
                    className="training-spell-step"
                    key={cast.time + ':' + i}
                    data-focus={
                      cast.id === decision.spellId &&
                      castDecisionTime(cast) === decision.time
                    }
                  >
                    <GameIcon id={cast.id} name={cast.name} icon={cast.icon} />
                    <strong>{cast.name}</strong>
                    <small>
                      {(castDecisionTime(cast) - decision.time >= 0
                        ? '+'
                        : '') +
                        (castDecisionTime(cast) - decision.time).toFixed(1)}
                      s
                    </small>
                  </div>
                ),
              )}
            </div>
          </div>
          <p className="training-note">{check.detail}</p>
          <div key={check.id + ':' + decision.time}>
            {renderReference(check, decision)}
          </div>
        </>
      )}
    </section>
  );
}
