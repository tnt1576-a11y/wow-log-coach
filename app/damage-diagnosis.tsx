'use client';
import { useMemo, useState } from 'react';
import { ArrowRight, Crosshair, Info, Shield } from 'lucide-react';
import type { AnalysisResult } from '@/lib/domain';
import { buildDiagnosis } from '@/lib/diagnosis';
import { compareOutputPerCast } from '@/lib/output-comparison';
import type { ReviewFocus } from '@/lib/defensives';
import { GameIcon, compact, fmt } from './coaching-report';
import { CoachDialog } from './coach-dialog';

export function ComparisonBars({
  label,
  target,
  reference,
  unit = '',
  detail,
}: {
  label: string;
  target: number | null;
  reference: number | null;
  unit?: string;
  detail: string;
}) {
  const max = Math.max(1, target ?? 0, reference ?? 0);
  return (
    <div className="output-comparison">
      <div className="output-comparison-label">
        <h4>{label}</h4>
        <CoachDialog
          label={
            <>
              <Info size={15} />
              <span className="sr-only">About {label}</span>
            </>
          }
          title={label}
          description={detail}
        >
          <p>
            Cyan is you; purple is the reference median. Longer bars mean a
            larger number, not necessarily better play.
          </p>
        </CoachDialog>
      </div>
      {[
        { name: 'You', value: target },
        { name: 'Reference', value: reference },
      ].map((row) => (
        <div className="output-bar-row" key={row.name}>
          <span>{row.name}</span>
          <i aria-hidden="true">
            <b
              style={{
                width:
                  row.value === null
                    ? 0
                    : Math.max(0, (row.value / max) * 100) + '%',
              }}
            />
          </i>
          <strong>
            {row.value === null
              ? 'Unknown'
              : (unit === '/min' ? fmt(row.value) : compact(row.value)) + unit}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function DamageDiagnosis({
  result,
  onNavigate,
  onSpell,
  onReview,
}: {
  result: AnalysisResult;
  onNavigate: (tab: string) => void;
  onSpell: (name: string) => void;
  onReview: (focus: ReviewFocus) => void;
}) {
  const review = useMemo(() => buildDiagnosis(result), [result]);
  const [spellId, setSpellId] = useState<number>();
  const [taskId, setTaskId] = useState('');
  const driver =
    review.drivers.find((item) => item.spell.id === spellId) ??
    review.drivers[0];
  const task =
    review.tasks.find((item) => item.id === taskId) ?? review.tasks[0];
  const perCast = driver ? compareOutputPerCast(result, driver.spell.id) : null;
  return (
    <div className="training-workspace output-workspace">
      <header className="training-toolbar">
        <div className="training-heading">
          <span className="training-eyebrow">DAMAGE DIAGNOSIS</span>
          <h2>Find the difference worth working on</h2>
        </div>
        <button
          className="training-button"
          onClick={() => onNavigate('references')}
        >
          How were references chosen? <Info size={16} />
        </button>
      </header>
      <div className="training-score-strip">
        <div>
          <span>Your full-run DPS</span>
          <strong>{compact(result.targetMetrics.dps)}</strong>
        </div>
        <div>
          <span>Reference median</span>
          <strong>
            {review.overall?.sampleSize
              ? compact(review.overall.median)
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <span>Observed difference</span>
          <strong>
            {!review.sufficient || review.deficit === null
              ? 'Need more logs'
              : (review.deficit > 0 ? '-' : '+') +
                fmt(Math.abs(review.deficit)) +
                '%'}
          </strong>
        </div>
        <div className="training-score-caption">
          <span>{result.cohort.actualSize} individual-DPS references</span>
          <small>
            Same spec, dungeon and key. The gap is not a recoverable-damage
            estimate.
          </small>
        </div>
      </div>
      <div className="training-toolbar-actions output-context-links">
        <button className="training-button" onClick={() => onNavigate('gear')}>
          {result.gear?.itemLevel?.sampleSize
            ? 'Compare gear: ' +
              fmt(result.gear.itemLevel.target) +
              ' vs ' +
              fmt(result.gear.itemLevel.median) +
              ' ilvl'
            : 'Check equipment data'}{' '}
          <ArrowRight size={16} />
        </button>
        <button
          className="training-button"
          onClick={() => onNavigate('abilities')}
        >
          Check buff differences <ArrowRight size={16} />
        </button>
      </div>
      {!review.sufficient && (
        <p className="training-alert">
          At least 8 matching references are required for coaching conclusions.
          Your recorded events remain available.
        </p>
      )}
      {task && (
        <section className="output-start">
          <div className="output-task-picker">
            <span className="training-eyebrow">START HERE</span>
            {review.tasks.map((item, index) => (
              <button
                key={item.id}
                data-selected={task.id === item.id}
                onClick={() => setTaskId(item.id)}
              >
                <span>{index + 1}</span>
                {item.title}
              </button>
            ))}
          </div>
          <div className="output-task">
            <span className="training-status">Review candidate</span>
            <h3>{task.title}</h3>
            <p>
              <b>Observed</b> {task.observation}
            </p>
            <div className="training-next-action">
              <Crosshair size={21} />
              <div>
                <span>CHECK NEXT</span>
                <p>{task.check}</p>
              </div>
            </div>
            <button
              className="training-button training-primary"
              onClick={() =>
                task.focus
                  ? onReview(task.focus)
                  : task.spellName
                    ? onSpell(task.spellName)
                    : onNavigate(task.destination)
              }
            >
              {task.destination === 'survival'
                ? 'Review defensive timing'
                : task.focus
                  ? 'Compare this window'
                  : 'Open spell comparison'}{' '}
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}
      <div className="training-desk">
        <aside className="training-focus-list">
          <div className="training-section-label">SPELL OUTPUT DIFFERENCES</div>
          {review.drivers.map((item) => (
            <button
              className="training-focus"
              data-selected={driver?.spell.id === item.spell.id}
              onClick={() => setSpellId(item.spell.id)}
              key={item.spell.id}
            >
              <GameIcon
                id={item.spell.id}
                name={item.spell.name}
                icon={item.spell.icon}
              />
              <span>
                <strong>{item.spell.name}</strong>
                <small>
                  {compact(item.difference)} less DPS &middot;{' '}
                  {fmt(item.percent)}%
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
          <p className="training-side-note">
            Largest independent spell shortfalls first. These are not additive
            pieces of the total gap.
          </p>
          <button
            className="training-secondary-link"
            onClick={() => onNavigate('survival')}
          >
            <Shield size={17} /> Defensives &amp; survival{' '}
            <ArrowRight size={16} />
          </button>
        </aside>
        <section className="training-lesson">
          {driver ? (
            <>
              <div className="training-lesson-heading">
                <div>
                  <span className="training-eyebrow">CASTS OR OUTPUT?</span>
                  <h3>{driver.spell.name}</h3>
                </div>
                <GameIcon
                  id={driver.spell.id}
                  name={driver.spell.name}
                  icon={driver.spell.icon}
                />
              </div>
              <p className="training-why">{driver.explanation}</p>
              <ComparisonBars
                label="Damage contribution"
                target={driver.spell.damage.target}
                reference={driver.spell.damage.median}
                unit=" DPS"
                detail={
                  'Full-run spell damage divided by run duration. Reference middle 50%: ' +
                  compact(driver.spell.damage.p25) +
                  ' to ' +
                  compact(driver.spell.damage.p75) +
                  ' DPS, across ' +
                  driver.spell.damage.sampleSize +
                  ' logs. Independent medians cannot be added together.'
                }
              />
              <ComparisonBars
                label="Cast frequency"
                target={
                  result.targetMetrics.casts && driver.hasCastComparison
                    ? driver.spell.casts.target
                    : null
                }
                reference={
                  driver.hasCastComparison ? driver.spell.casts.median : null
                }
                unit="/min"
                detail={
                  'Recorded casts per full-run minute; ' +
                  driver.spell.referenceUsers +
                  ' references used this spell. This does not measure missed available cooldowns. Channel ticks never count as extra casts.'
                }
              />
              <ComparisonBars
                label="Damage per recorded cast"
                target={perCast?.target ?? null}
                reference={perCast?.usable ? perCast.median : null}
                detail={
                  'Total linked spell-family damage divided by actual cast count in each run, then the median of those per-run ratios. ' +
                  (perCast?.sampleSize ?? 0) +
                  ' usable reference logs; at least 8 required. This is not a single-target hit or a damage-loss calculation. More targets, buffs, gear and proc interactions change it.'
                }
              />
              <div className="training-next-action">
                <Crosshair size={22} />
                <div>
                  <span>WHAT TO CHECK</span>
                  <p>{driver.check}</p>
                </div>
              </div>
              <p className="training-verify">
                Pull size, targets, talents, equipment and external buffs are
                not normalized. These charts narrow the question; they do not
                prove its cause.
              </p>
              <div className="training-lesson-actions">
                <button
                  className="training-button training-primary"
                  onClick={() => onReview({ spellId: driver.spell.id })}
                >
                  Compare spell timing <ArrowRight size={17} />
                </button>
                <button
                  className="training-button"
                  onClick={() => onSpell(driver.spell.name)}
                >
                  All spell details
                </button>
              </div>
            </>
          ) : (
            <div className="training-no-lesson">
              <Info size={26} />
              <h3>No supported spell shortfall</h3>
              <p>
                {review.sufficient
                  ? 'No difference passed the size and evidence checks. This is not a perfect-rotation verdict.'
                  : 'More comparable logs are needed before suggesting spell-output priorities.'}
              </p>
              <button
                className="training-button"
                onClick={() => onNavigate('timeline')}
              >
                Explore a reference run
              </button>
            </div>
          )}
        </section>
      </div>
      <details className="training-details">
        <summary>Other cast and buff differences</summary>
        <div className="output-more">
          {review.lowerCasts.map((spell) => (
            <button
              className="training-focus"
              key={spell.id}
              onClick={() => onSpell(spell.name)}
            >
              <GameIcon id={spell.id} name={spell.name} icon={spell.icon} />
              <span>
                <strong>{spell.name}</strong>
                <small>
                  {fmt(spell.casts.target)}/min vs {fmt(spell.casts.median)}/min
                  median
                </small>
              </span>
            </button>
          ))}
          {review.lowerBuffs.map((buff) => (
            <button
              className="training-focus"
              key={buff.id}
              onClick={() => onSpell(buff.label)}
            >
              <GameIcon
                id={Number(buff.id.replace('buff-', ''))}
                name={buff.label}
                icon={buff.icon}
              />
              <span>
                <strong>{buff.label}</strong>
                <small>
                  {fmt(buff.target)}% uptime vs {fmt(buff.median)}% median
                </small>
              </span>
            </button>
          ))}
        </div>
        <p className="training-note">
          Buffs can come from another player or equipment. Lower uptime is not
          automatically a player mistake.
        </p>
      </details>
      <details className="training-details">
        <summary>Full-run metrics and reference ranges</summary>
        <div className="coach-table-wrap">
          <table className="coach-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>You</th>
                <th>Reference median</th>
                <th>Middle 50%</th>
              </tr>
            </thead>
            <tbody>
              {result.metrics.map((metric) => (
                <tr key={metric.id}>
                  <th>{metric.label}</th>
                  <td>{fmt(metric.target)}</td>
                  <td>
                    {metric.sampleSize ? fmt(metric.median) : 'Unavailable'}
                  </td>
                  <td>
                    {metric.sampleSize
                      ? fmt(metric.p25) + ' - ' + fmt(metric.p75)
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
