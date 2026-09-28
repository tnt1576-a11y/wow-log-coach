'use client';
import { useState } from 'react';
import type { AnalysisResult } from '@/lib/domain';
import {
  methodBuild,
  methodBranches,
  methodGuideFor,
} from '@/lib/guides/method';
import './method-guide.css';

export function MethodGuidePanel({
  result,
  confirmedHero,
}: {
  result: AnalysisResult;
  confirmedHero?: string;
}) {
  const guide = methodGuideFor(result);
  if (!guide) return null;
  return (
    <MethodContext
      key={
        result.target.reportCode +
        ':' +
        result.target.fightId +
        ':' +
        result.target.sourceId
      }
      result={result}
      guide={guide}
      confirmedHero={confirmedHero}
    />
  );
}
function MethodContext({
  result,
  guide,
  confirmedHero,
}: {
  result: AnalysisResult;
  guide: NonNullable<ReturnType<typeof methodGuideFor>>;
  confirmedHero?: string;
}) {
  const [targets, setTargets] = useState(1);
  const [previewHero, setPreviewHero] = useState('auto');
  const build = methodBuild(guide, result.targetMetrics);
  const actualHero = build.conflict
    ? null
    : confirmedHero !== undefined
      ? confirmedHero !== 'unknown'
        ? confirmedHero
        : null
      : build.hero;
  const hero = previewHero === 'auto' ? actualHero : previewHero;
  const branches = methodBranches(guide, result.targetMetrics, hero, targets);
  const active = branches.filter((b) => !b.missing.length);
  const conditional = branches.filter((b) => b.missing.length);
  const seasonMatches =
    result.target.rankingZoneId === 55 && result.cohort.partition?.id === 1;
  const comparable = result.references.filter(
    (r) =>
      r.metrics &&
      r.className === guide.className &&
      r.specName === guide.specName &&
      actualHero &&
      methodBuild(guide, r.metrics).hero === actualHero,
  );
  return (
    <section className="method-guide" aria-label="Method rotation context">
      <div className="method-heading">
        <div>
          <span className="training-eyebrow">
            METHOD · PATCH {guide.source.patch}
          </span>
          <h3>Rotation for your build</h3>
        </div>
        <a href={guide.source.url} target="_blank" rel="noreferrer">
          Read full guide ↗
        </a>
      </div>
      <p className="training-note">
        {guide.source.author} · Updated {guide.source.updated}. These are review
        priorities, not a repeatable button sequence or a full rotation score.
      </p>
      {!seasonMatches && (
        <output>
          This log is outside the reviewed season or lacks season metadata.
          Guidance below is for study only.
        </output>
      )}
      <div className="method-controls">
        <label className="training-field">
          Hero context
          <select
            value={previewHero}
            onChange={(e) => setPreviewHero(e.target.value)}
          >
            <option value="auto">
              From this log:{' '}
              {build.conflict
                ? 'conflicting evidence'
                : (actualHero ?? 'unknown')}
            </option>
            {Object.keys(guide.heroes).map((h) => (
              <option key={h} value={h}>
                Preview {h}
              </option>
            ))}
          </select>
        </label>
        <label className="training-field">
          Enemies in the moment you are reviewing
          <select
            value={targets}
            onChange={(e) => setTargets(Number(e.target.value))}
          >
            <option value={1}>1 — single target</option>
            <option value={2}>2 — cleave</option>
            <option value={3}>3 — multi-target</option>
            <option value={4}>4+ — AoE</option>
          </select>
        </label>
      </div>
      <p className="training-note">
        Enemy count is selected by you, not inferred from a trash-pull label.
        Preview selections do not change automated findings or reference
        selection.
      </p>
      {(previewHero !== 'auto' || !actualHero) && (
        <p className="method-warning">
          {previewHero !== 'auto'
            ? 'Hero preview only — this does not confirm that the character used this tree.'
            : 'Hero tree is not established. Choose a preview to study it; hero-specific advice is withheld until then.'}
        </p>
      )}
      <ul className="training-guide-notes">
        {active.map((b) => (
          <li key={b.text}>
            {b.text}
            {b.requires?.length ? (
              <small>
                {' '}
                Requires: {b.requires.join(', ')} — recorded in this character’s
                talents.
              </small>
            ) : null}
          </li>
        ))}
      </ul>
      {conditional.length > 0 && (
        <details>
          <summary>
            {conditional.length} talent-dependent priorities need confirmation
          </summary>
          {conditional.map((b) => (
            <div className="method-conditional" key={b.text}>
              <p>{b.text}</p>
              <small>
                Not applied to your build: {b.missing.join(', ')} not
                established in the log. Missing records do not mean untalented.
              </small>
            </div>
          ))}
        </details>
      )}
      <details>
        <summary>Build evidence &amp; reference compatibility</summary>
        <p>
          {actualHero
            ? `${actualHero}: ${build.hero ? 'learned-talent evidence' : 'Arcane build evidence / confirmation'}.`
            : 'No unambiguous hero identification.'}{' '}
          {comparable.length} of {result.references.length} references have
          positive learned-talent evidence for the same hero. This is not a
          full-build match.
        </p>
        <ul>
          {build.talents.map((t) => (
            <li key={t.name}>
              {t.name}: {t.present ? 'recorded' : 'unknown'}
            </li>
          ))}
        </ul>
        <p>
          Match hero, key level and pull context before comparing casts.
          Resource readiness, target health, pet counts and all alternative
          talent builds are not simulated.
        </p>
        <a
          href={`https://www.method.gg/guides/${guide.slug}/talents`}
          target="_blank"
          rel="noreferrer"
        >
          Check Method’s talent builds ↗
        </a>
      </details>
    </section>
  );
}
