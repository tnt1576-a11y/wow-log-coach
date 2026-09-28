'use client';
// oxlint-disable jsx-a11y/prefer-tag-over-role -- Interactive SVG charts require explicit accessible roles.
// oxlint-disable next/no-img-element -- Fixed-size third-party game icons use lazy loading and a local letter fallback.
import { useRef, useState } from 'react';
export { Timeline } from './pull-review';
import { ExternalLink, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@base-ui/react/tooltip';
import { RotationComparison } from './rotation-comparison';
import type { AnalysisResult, MetricDistribution } from '@/lib/domain';
import { GEAR_SLOTS } from '@/lib/evidence';
import { tooltipSpellId } from '@/lib/spell-details';
import { AbilityProvider, GameIcon } from './ability';
export { GameIcon } from './ability';
import { CooldownTimeline } from './cooldown-timeline';
import './report-navigation.css';
import { cohortItem } from '@/lib/gear';
import { compareGear } from '@/lib/comparisons';
import { DamageDiagnosis } from './damage-diagnosis';
import { DefensiveReview } from './defensive-review';
import { ArcaneCoach } from './arcane-workspace';
import { FireCoach } from './fire-workspace';
import { FrostCoach } from './frost-workspace';
import { GuidedSpecCoach } from './guided-spec-workspace';
import { GeneralCoach } from './general-coach';
import { RunBrief } from './run-brief';
import type { ReviewFocus } from '@/lib/defensives';
import { guidePackFor } from '@/lib/guides/registry';

export function Survival({ result }: { result: AnalysisResult }) {
  const evidence = result.evidence;
  const taken = result.targetMetrics.damageTaken ?? [];
  const total = taken.reduce((sum, spell) => sum + spell.total, 0);
  return (
    <div className="coach-stack">
      <Panel
        title="Death review"
        description="Killing blow and the recorded damage/healing window. A killing blow alone does not prove avoidable damage or a missed defensive."
      >
        {evidence?.deaths.length ? (
          evidence.deaths.map((death, index) => (
            <article className="death-card" key={index}>
              <div className="action-heading">
                <span className="icon-label">
                  <GameIcon id={death.id} icon={death.icon} name={death.name} />
                  <span>
                    <strong>{death.name}</strong>
                    <small>Death at {timestamp(death.time)}</small>
                  </span>
                </span>
                <SourceLink
                  result={result}
                  start={Math.max(0, death.time - Math.max(10, death.window))}
                  end={Math.min(evidence.duration, death.time + 2)}
                />
              </div>
              <div className="action-values">
                <span>
                  Window <b>{fmt(death.window)}s</b>
                </span>
                <span>
                  Damage <b>{compact(death.damage)}</b>
                </span>
                <span>
                  Healing <b>{compact(death.healing)}</b>
                </span>
              </div>
              <details>
                <summary>Last recorded damaging hits</summary>
                <div className="death-hits">
                  {death.hits.map((hit, hitIndex) => (
                    <div key={hitIndex}>
                      <span className="mono">
                        {(hit.time - death.time).toFixed(1)}s
                      </span>
                      <GameIcon id={hit.id} icon={hit.icon} name={hit.name} />
                      <span>{hit.name}</span>
                      <strong>{compact(hit.amount)}</strong>
                    </div>
                  ))}
                </div>
              </details>
            </article>
          ))
        ) : (
          <Empty>
            {result.targetMetrics.deaths === 0
              ? 'No deaths were recorded for this player in the selected run.'
              : 'Death details are unavailable, although the aggregate table recorded deaths.'}
          </Empty>
        )}
      </Panel>
      <Panel
        title="What damaged you"
        description="Incoming damage by spell. These are review candidates, not an automatic avoidable-damage list. Check mechanics, assigned duties, and mitigation before drawing conclusions."
      >
        {taken.length ? (
          <div className="incoming-list">
            {taken.slice(0, 20).map((spell) => (
              <div key={spell.id} className="incoming-row">
                <span className="icon-label">
                  <GameIcon id={spell.id} icon={spell.icon} name={spell.name} />
                  <a
                    href={
                      'https://www.wowhead.com/spell=' +
                      tooltipSpellId(spell.id, spell.name)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {spell.name}
                  </a>
                </span>
                <div>
                  <div className="incoming-bar">
                    <i
                      style={{
                        width: total ? (spell.total / total) * 100 + '%' : '0%',
                      }}
                    />
                  </div>
                  <small>
                    {total ? fmt((spell.total / total) * 100) : 0}% of recorded
                    incoming damage
                  </small>
                </div>
                <strong>{compact(spell.total)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No spell-level incoming damage data is available.</Empty>
        )}
        <p className="coach-footnote">
          To review defensives and healing items, search their names in
          Abilities & buffs, then inspect their timestamps in Timeline & map.
          Cooldown readiness is not inferred.
        </p>
      </Panel>
    </div>
  );
}

export function References({ result, preview }: Props) {
  return (
    <div className="coach-stack">
      <Panel
        title="Reference cohort"
        description="Highest individual-DPS parses found within your filters, one qualifying run per player. Key completion time and team score do not determine selection."
      >
        <div className="reference-context">
          <span>
            {result.cohort.percentileMin}-{result.cohort.percentileMax}{' '}
            percentile
          </span>
          <span>{result.cohort.dateLabel}</span>
          <span>
            {result.target.contentType === 'raid'
              ? 'Same boss and difficulty'
              : result.target.keyLevel >= 12
                ? 'Fixed affixes at +12 and above'
                : result.cohort.affixesMatched
                  ? 'Exact affixes'
                  : 'Affixes not matched'}
          </span>
          <span>
            {preview
              ? 'Illustrative preview'
              : result.target.contentType === 'raid'
                ? 'Public boss kills'
                : 'Public timed runs'}
          </span>
          {result.cohort.heroMatch && (
            <span>
              {result.cohort.heroMatch.matched
                ? result.cohort.heroMatch.hero + ' hero-matched'
                : 'Hero tree not matched'}
            </span>
          )}
        </div>
        <div className="selection-method">
          <strong>How these references are selected</strong>
          {result.apiUsage && (
            <p>
              This review used {result.apiUsage.pointsSpent.toFixed(1)} observed
              API points across {result.apiUsage.requests} requests, with{' '}
              {result.apiUsage.cacheHits} cache reuses.
              {result.apiUsage.limited
                ? ' Spending stopped early; collected results are retained.'
                : ''}
            </p>
          )}
          <p>
            {result.target.contentType === 'raid'
              ? 'Warcraft Logs individual DPS leaderboard (metric: dps): same boss, difficulty, class/spec and partition, with kill duration within ' +
                (result.cohort.durationTolerancePercent ?? 20) +
                '% of yours. Boss DPS percentile and your date range are verified.'
              : 'Warcraft Logs individual DPS leaderboard (metric: dps): same dungeon, exact key level, class/spec and partition. We verify your date range and the player’s same-key DPS percentile. Affixes are matched when applicable.'}{' '}
            Candidates are checked highest ranked DPS first; an ineligible run
            does not block another qualifying run by that player.
          </p>
          {result.cohort.selection ? (
            <p>
              Searched {result.cohort.selection.pagesSearched} ranking pages /{' '}
              {result.cohort.selection.rankingRows} ranking entries;{' '}
              {result.cohort.selection.eligibleCandidates} date-matching
              candidates retained.
              {result.cohort.selection.missingDateRows !== undefined &&
                result.cohort.selection.outsideDateRows !== undefined && (
                  <>
                    {' '}
                    {result.cohort.selection.missingDateRows} entries had no
                    usable date; {result.cohort.selection.outsideDateRows} fell
                    outside your date range.
                  </>
                )}{' '}
              Checked {result.cohort.selection.checkedRuns} runs;{' '}
              {result.cohort.selection.filteredRuns} failed filters and{' '}
              {result.cohort.selection.failedRuns} could not be read.{' '}
              {result.cohort.selection.searchLimited
                ? 'Search was bounded to protect API usage; some ranking entries were not checked.'
                : 'Reached the end of the available ranking pages.'}
            </p>
          ) : (
            <p>
              {preview
                ? 'Illustrative data, not a live leaderboard search.'
                : 'Run the analysis again to see search counts and ranked-DPS values.'}
            </p>
          )}
          {result.cohort.selection?.rejectionCounts && (
            <p>
              Filter reasons:{' '}
              {Object.entries(result.cohort.selection.rejectionCounts)
                .map(([reason, count]) => reason + ': ' + count)
                .join(' · ') || 'None'}
              .
            </p>
          )}
          {result.cohort.actualSize < result.cohort.requestedSize &&
            !preview && (
              <p>
                Found {result.cohort.actualSize} matches at{' '}
                {result.cohort.percentileMin}–{result.cohort.percentileMax}{' '}
                percentile in the searched sample. Twenty is a maximum, not a
                requirement.
                {result.cohort.percentileMin >= 99
                  ? ' To look for a larger sample, you can choose 95–100 for your next comparison.'
                  : ' A wider percentile or date range may find more matches.'}
              </p>
            )}
          <p>
            This is the best qualifying sample found in the searched leaderboard
            entries, not a guarantee of the world&apos;s best 20 players or
            every historical parse. Private, unreadable, unlisted, or unsearched
            logs are not covered. Faster groups, larger pulls, external buffs,
            gear, and talents can still increase individual DPS.
          </p>
          {result.cohort.heroMatch && (
            <p>
              {result.cohort.heroMatch.matched
                ? 'References also require recorded ' +
                  result.cohort.heroMatch.hero +
                  ' evidence; unknown and different hero trees are excluded. This does not verify an identical talent build or tier set.'
                : 'Hero tree could not be verified for selection. Compare builds before drawing rotation conclusions.'}
            </p>
          )}
        </div>
        <div className="coach-table-wrap">
          <table className="coach-table">
            <thead>
              <tr>
                <th>Sample rank</th>
                <th>Player</th>
                <th>
                  {result.target.contentType === 'raid'
                    ? 'Boss DPS percentile'
                    : 'Same-key DPS percentile'}
                </th>
                <th>Ranked DPS</th>
                <th>Full-run DPS</th>
                <th>Item level</th>
                <th>Duration</th>
                <th>Log date</th>
              </tr>
            </thead>
            <tbody>
              {result.references.map((run, index) => (
                <tr key={run.reportCode + ':' + run.fightId + ':' + run.player}>
                  <td>#{index + 1}</td>
                  <td>
                    <a
                      className="coach-link"
                      href={run.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {run.player}
                      <ExternalLink size={12} />
                    </a>
                    <small>{run.server}</small>
                  </td>
                  <td>{fmt(run.percentile)}</td>
                  <td>{run.rankingDps ? compact(run.rankingDps) : '-'}</td>
                  <td>{compact(run.dps)}</td>
                  <td>
                    {run.character?.itemLevel !== null &&
                    run.character?.itemLevel !== undefined
                      ? fmt(run.character.itemLevel)
                      : '-'}
                  </td>
                  <td>{timestamp(run.duration / 1000)}</td>
                  <td>
                    {run.startTime
                      ? new Date(run.startTime).toISOString().slice(0, 10)
                      : 'Unavailable'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!result.references.length && (
          <Empty>
            No reference run passed the selected filters. Try a broader date or
            percentile range explicitly.
          </Empty>
        )}
        <p className="coach-footnote">
          Ranked DPS is the amount supplied by Warcraft Logs for leaderboard
          ordering. Full-run DPS is damage-table total divided by the logged
          fight duration, used consistently for this app&apos;s spell
          comparisons. The two can differ. This is a selected high-performance
          cohort, not a random sample of all logs. Popularity and median values
          are descriptive, not a best-build recommendation. Different group
          buffs, routes, hotfixes, and talent builds can still affect results.
        </p>
      </Panel>
    </div>
  );
}

type Props = { result: AnalysisResult; preview: boolean };
const numeric = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
export const fmt = (value: number) => numeric.format(value);
export const compact = (value: number) =>
  new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
export function timestamp(seconds: number) {
  return (
    Math.floor(seconds / 60) +
    ':' +
    String(Math.floor(seconds % 60)).padStart(2, '0')
  );
}
function valueLabel(value: number, unit: MetricDistribution['unit']) {
  return unit === 'damage'
    ? compact(value)
    : fmt(value) +
        (unit === 'percent'
          ? '%'
          : unit === 'perMinute'
            ? '/min'
            : unit === 'seconds'
              ? 's'
              : '');
}

function Panel({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={'coach-panel ' + className}>
      <header className="coach-panel-heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="coach-empty">{children}</p>;
}
function SourceLink({
  result,
  start,
  end,
  children = 'Open evidence',
}: {
  result: AnalysisResult;
  start?: number;
  end?: number;
  children?: React.ReactNode;
}) {
  const evidence = result.evidence;
  const url =
    start !== undefined && evidence
      ? result.target.url +
        '&start=' +
        Math.round(evidence.reportStart + start * 1000) +
        '&end=' +
        Math.round(evidence.reportStart + (end ?? start + 20) * 1000)
      : result.target.url;
  return (
    <a className="coach-link" href={url} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={12} />
    </a>
  );
}

export function RangeGraph({
  metric,
  compactLabel = false,
}: {
  metric: MetricDistribution;
  compactLabel?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  if (!metric.sampleSize)
    return (
      <div className="range-row">
        <span>{metric.label}</span>
        <span className="muted">No reference data</span>
      </div>
    );
  const max = Math.max(metric.target, metric.p75, metric.median, 1) * 1.15;
  const pct = (value: number) =>
    Math.max(0, Math.min(100, (value / max) * 100));
  const detail =
    metric.label +
    ': you ' +
    valueLabel(metric.target, metric.unit) +
    ', reference median ' +
    valueLabel(metric.median, metric.unit) +
    ', middle 50 percent ' +
    valueLabel(metric.p25, metric.unit) +
    ' to ' +
    valueLabel(metric.p75, metric.unit) +
    ', ' +
    metric.sampleSize +
    ' reference logs. Show comparison details.';
  return (
    <Tooltip.Provider delay={180}>
      <Tooltip.Root open={helpOpen} onOpenChange={setHelpOpen}>
        <Tooltip.Trigger
          className="range-row range-help-trigger"
          type="button"
          aria-label={detail}
          closeOnClick={false}
          onClick={() => setHelpOpen(true)}
        >
          <span className="range-label">
            <span>{metric.label}</span>
            <strong>
              {valueLabel(metric.target, metric.unit)} <small>you</small>
            </strong>
          </span>
          <span className="range-track" aria-hidden="true">
            <span
              className="range-band"
              style={{
                left: pct(metric.p25) + '%',
                width: Math.max(0.4, pct(metric.p75) - pct(metric.p25)) + '%',
              }}
            />
            <span
              className="range-median"
              style={{ left: pct(metric.median) + '%' }}
            />
            <span
              className="range-you"
              style={{ left: pct(metric.target) + '%' }}
            />
          </span>
          <span className="range-meta">
            <span>0</span>
            <span>
              {compactLabel ? 'Median' : 'Reference median'}{' '}
              {valueLabel(metric.median, metric.unit)}
              <span className="muted"> / n={metric.sampleSize}</span>
            </span>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner
            sideOffset={10}
            className="metric-tooltip-positioner"
          >
            <Tooltip.Popup className="metric-tooltip">
              <strong>{metric.label}</strong>
              <dl>
                <div>
                  <dt>Cyan dot: your value</dt>
                  <dd>{valueLabel(metric.target, metric.unit)}</dd>
                </div>
                <div>
                  <dt>White line: reference median</dt>
                  <dd>{valueLabel(metric.median, metric.unit)}</dd>
                </div>
                <div>
                  <dt>Purple band: middle 50%</dt>
                  <dd>
                    {valueLabel(metric.p25, metric.unit)} -{' '}
                    {valueLabel(metric.p75, metric.unit)}
                  </dd>
                </div>
                <div>
                  <dt>Reference logs (n)</dt>
                  <dd>{metric.sampleSize}</dd>
                </div>
                {metric.id.startsWith('buff-') &&
                  metric.nonZeroCount !== undefined && (
                    <div>
                      <dt>References with recorded uptime</dt>
                      <dd>
                        {metric.nonZeroCount} / {metric.sampleSize}
                      </dd>
                    </div>
                  )}
                <div>
                  <dt>Your difference from median</dt>
                  <dd>
                    {metric.target >= metric.median ? '+' : ''}
                    {fmt(metric.target - metric.median)}
                    {metric.unit === 'percent'
                      ? ' percentage points'
                      : metric.unit === 'perMinute'
                        ? '/min'
                        : metric.unit === 'seconds'
                          ? 's'
                          : ''}
                  </dd>
                </div>
              </dl>
              <p>
                The median is the middle reference value, not a recommended
                target. The band spans the 25th to 75th percentiles; it is not a
                buff duration or a pass/fail zone.
              </p>
              {metric.id.startsWith('buff-') && (
                <p>
                  Uptime is a percentage of the full dungeon. A buff absent from
                  an available buff table counts as 0%; unavailable tables are
                  excluded. A 0% median does not mean every reference had 0%.
                  External buffs, equipment, talents, and procs can explain
                  differences.
                </p>
              )}
              {metric.sampleSize < 8 && (
                <p>
                  Small sample: use this as context, not a reliable coaching
                  conclusion.
                </p>
              )}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function CoachingPanels({ result, preview }: Props) {
  const isArcane =
    result.target.contentType !== 'raid' &&
    result.target.className === 'Mage' &&
    result.target.specName === 'Arcane';
  const isFire =
    result.target.contentType !== 'raid' &&
    result.target.className === 'Mage' &&
    result.target.specName === 'Fire';
  const isFrost =
    result.target.contentType !== 'raid' &&
    result.target.className === 'Mage' &&
    result.target.specName === 'Frost';
  const guidedPack =
    result.target.contentType === 'raid' ? null : guidePackFor(result);
  const sections = [
    { value: 'review', label: 'Run review' },
    { value: 'timeline', label: 'Rotation comparison' },
    { value: 'cooldowns', label: 'Cooldown timing' },
    { value: 'survival', label: 'Defensives & survival' },
    { value: 'coaching', label: 'Damage diagnosis' },
    { value: 'gear', label: 'Gear & stats' },
    { value: 'abilities', label: 'Abilities & buffs' },
    ...(isArcane ? [{ value: 'arcane', label: 'Arcane guide' }] : []),
    ...(isFire ? [{ value: 'fire', label: 'Fire guide' }] : []),
    ...(isFrost ? [{ value: 'frost', label: 'Frost guide' }] : []),
    ...(guidedPack
      ? [{ value: 'spec-guide', label: guidedPack.specName + ' guide' }]
      : []),
    { value: 'coach', label: 'Practice workshop' },
    { value: 'references', label: 'References' },
  ];
  const [tab, setTab] = useState('review');
  const [visited, setVisited] = useState<string[]>(['review']);
  function selectTab(next: string) {
    setVisited((current) =>
      current.includes(next) ? current : [...current, next],
    );
    setTab(next);
  }
  const [spellSearch, setSpellSearch] = useState('');
  const [lessonFocus, setLessonFocus] = useState<{
    id: string;
    request: number;
  }>();
  function openGuide(next: string, id: string) {
    setLessonFocus((value) => ({ id, request: (value?.request ?? 0) + 1 }));
    navigate(next);
  }
  const [spellKey, setSpellKey] = useState(0);
  const navigation = useRef<HTMLDivElement>(null);
  function navigate(next: string) {
    selectTab(next);
    navigation.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const [reviewFocus, setReviewFocus] = useState<ReviewFocus>({});
  const [reviewKey, setReviewKey] = useState(0);
  function openReview(focus: ReviewFocus) {
    setReviewFocus(focus);
    setReviewKey((value) => value + 1);
    navigate('timeline');
  }
  function openSpells(name = '') {
    setSpellSearch(name);
    setSpellKey((value) => value + 1);
    navigate('abilities');
  }
  return (
    <AbilityProvider result={result}>
      <Tabs value={tab} onValueChange={selectTab}>
        <div ref={navigation} className="report-navigation-anchor" />
        <label className="report-mobile-navigation">
          Review section
          <select
            aria-label="Review section"
            value={tab}
            onChange={(event) => selectTab(event.target.value)}
          >
            {sections.map((section) => (
              <option key={section.value} value={section.value}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <TabsList variant="line" className="coach-tabs">
          {sections.map((section) => (
            <TabsTrigger key={section.value} value={section.value}>
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="review" keepMounted>
          {result.target.contentType === 'raid' && (
            <p className="comparison-context-note">
              Raid review compares recorded damage, cast timing, gear and
              survival. Start with Cooldown timing to compare boss-pull
              schedules. Dungeon-specific guide verdicts are not applied to
              raids.
            </p>
          )}
          <RunBrief
            onGuide={openGuide}
            result={result}
            preview={preview}
            onNavigate={navigate}
            onReview={openReview}
            onSpell={openSpells}
          />
        </TabsContent>
        <TabsContent value="coach" keepMounted>
          {visited.includes('coach') && (
            <GeneralCoach
              result={result}
              onNavigate={navigate}
              onSpell={openSpells}
              onReview={openReview}
            />
          )}
        </TabsContent>
        {isArcane && (
          <TabsContent value="arcane" keepMounted>
            {visited.includes('arcane') && (
              <ArcaneCoach
                lessonFocus={lessonFocus}
                result={result}
                onReview={openReview}
                onNavigate={navigate}
              />
            )}
          </TabsContent>
        )}
        {isFire && (
          <TabsContent value="fire" keepMounted>
            {visited.includes('fire') && (
              <FireCoach
                lessonFocus={lessonFocus}
                result={result}
                onReview={openReview}
                onNavigate={navigate}
              />
            )}
          </TabsContent>
        )}
        {isFrost && (
          <TabsContent value="frost" keepMounted>
            {visited.includes('frost') && (
              <FrostCoach
                lessonFocus={lessonFocus}
                result={result}
                onReview={openReview}
                onNavigate={navigate}
              />
            )}
          </TabsContent>
        )}
        {guidedPack && (
          <TabsContent value="spec-guide" keepMounted>
            {visited.includes('spec-guide') && (
              <GuidedSpecCoach
                lessonFocus={lessonFocus}
                result={result}
                pack={guidedPack}
                onReview={openReview}
                onNavigate={navigate}
              />
            )}
          </TabsContent>
        )}
        <TabsContent value="coaching">
          <DamageDiagnosis
            result={result}
            onNavigate={navigate}
            onSpell={openSpells}
            onReview={openReview}
          />
        </TabsContent>
        <TabsContent value="abilities">
          <Abilities
            key={spellKey}
            result={result}
            search={spellSearch}
            setSearch={setSpellSearch}
          />
        </TabsContent>
        <TabsContent value="timeline">
          <RotationComparison
            key={reviewKey}
            result={result}
            focus={reviewFocus}
            preview={preview}
          />
        </TabsContent>
        <TabsContent value="cooldowns">
          <CooldownTimeline result={result} />
        </TabsContent>
        <TabsContent value="gear">
          <Gear result={result} />
        </TabsContent>
        <TabsContent value="survival">
          <DefensiveReview result={result} onReview={openReview} />
          <details className="survival-extra">
            <summary>Killing blows and incoming-damage breakdown</summary>
            <Survival result={result} />
          </details>
        </TabsContent>
        <TabsContent value="references">
          <References result={result} preview={preview} />
        </TabsContent>
      </Tabs>
    </AbilityProvider>
  );
}

export function Abilities({
  result,
  search,
  setSearch,
}: {
  result: AnalysisResult;
  search: string;
  setSearch: (value: string) => void;
}) {
  const [mode, setMode] = useState('damage');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const spells = (result.spells ?? [])
    .filter((spell) => spell.name.toLowerCase().includes(search.toLowerCase()))
    .filter(
      (spell) =>
        !onlyGaps ||
        (spell.referenceUsers >= 8 && spell.casts.target < spell.casts.p25),
    )
    .filter(
      (spell) =>
        mode !== 'casts' || spell.targetUses > 0 || spell.referenceUsers > 0,
    )
    .sort((a, b) =>
      mode === 'casts'
        ? b.casts.median - a.casts.median
        : b.damage.target - a.damage.target,
    );
  const buffs = (result.buffComparisons ?? []).filter((buff) =>
    buff.label.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="coach-stack">
      <Panel
        title="Ability comparison"
        description="Actual completed casts are separate from damage hits and passive effects. Rates use full run duration; higher is not always better."
      >
        <div className="coach-toolbar">
          <label className="coach-search">
            <Search size={15} />
            <input
              aria-label="Search abilities and buffs"
              placeholder="Search spell or buff..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Ability comparison mode"
            className="coach-select"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="casts">Casts / minute</option>
            <option value="damage">Damage / second</option>
          </select>
          <label className="coach-checkbox">
            <input
              type="checkbox"
              checked={onlyGaps}
              onChange={(event) => setOnlyGaps(event.target.checked)}
            />
            Lower cast pace only
          </label>
        </div>
        <div className="coach-table-wrap">
          <table className="coach-table">
            <thead>
              <tr>
                <th>Ability</th>
                <th>Your casts</th>
                <th>You vs reference median</th>
                <th>Reference users</th>
              </tr>
            </thead>
            <tbody>
              {spells.map((spell) => {
                const metric = mode === 'casts' ? spell.casts : spell.damage;
                const max = Math.max(metric.target, metric.median, 1);
                return (
                  <tr key={spell.id}>
                    <td>
                      <span className="icon-label">
                        <GameIcon
                          id={spell.id}
                          icon={spell.icon}
                          name={spell.name}
                        />
                        <a
                          href={
                            'https://www.wowhead.com/spell=' +
                            tooltipSpellId(spell.id, spell.name)
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {spell.name}
                        </a>
                      </span>
                      {spell.damageIds?.some((id) => id !== spell.id) && (
                        <small>Verified damage-to-cast link</small>
                      )}
                    </td>
                    <td className="mono">
                      {!spell.targetUses && !spell.referenceUsers
                        ? '-'
                        : spell.targetUses}
                    </td>
                    <td
                      aria-label={
                        'Your value: ' +
                        valueLabel(metric.target, metric.unit) +
                        '; reference median: ' +
                        (metric.sampleSize
                          ? valueLabel(metric.median, metric.unit)
                          : 'unavailable')
                      }
                    >
                      <div className="paired-bars" aria-hidden="true">
                        <span>
                          <i
                            style={{ width: (metric.target / max) * 100 + '%' }}
                          />
                        </span>
                        <span>
                          <i
                            style={{
                              width: metric.sampleSize
                                ? (metric.median / max) * 100 + '%'
                                : '0%',
                            }}
                          />
                        </span>
                      </div>
                      <div className="paired-values">
                        <b>{valueLabel(metric.target, metric.unit)}</b>
                        <span>
                          {metric.sampleSize
                            ? valueLabel(metric.median, metric.unit)
                            : 'Unavailable'}
                        </span>
                      </div>
                    </td>
                    <td
                      className="mono"
                      aria-label={
                        'Reference users: ' +
                        spell.referenceUsers +
                        ' of ' +
                        spell.casts.sampleSize
                      }
                    >
                      {spell.referenceUsers}/{spell.casts.sampleSize}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!spells.length && <Empty>No abilities match these filters.</Empty>}
        <p className="coach-footnote">
          Cyan = your run; violet = reference median. Missing spells count as
          zero only in available cast tables. Damage and cast spell IDs can
          differ; verified Arcane spell families are linked. A dash means the
          cast relationship is unverified, not that the ability was unused.
          Spell links open Wowhead.
        </p>
      </Panel>
      <Panel
        title="Buff uptime"
        description="Observed uptime across the full fight. Hover, focus, or tap a bar for its values and explanation. External buffs, talents, and procs are included; this is not a cooldown-availability score."
      >
        <div className="buff-grid">
          {buffs.slice(0, 24).map((buff) => {
            const ability = result.targetMetrics.buffs.find(
              (item) => 'buff-' + item.id === buff.id,
            );
            return (
              <div className="buff-row" key={buff.id}>
                <GameIcon
                  id={Number(buff.id.replace('buff-', ''))}
                  icon={buff.icon ?? ability?.icon}
                  name={buff.label}
                />
                <RangeGraph metric={buff} compactLabel />
              </div>
            );
          })}
        </div>
        {!buffs.length && (
          <Empty>No recorded buff uptime matches the search.</Empty>
        )}
        {buffs.length > 24 && (
          <p className="coach-footnote">
            Showing the 24 largest uptime differences. Search for a specific
            buff to narrow the list.
          </p>
        )}
      </Panel>
    </div>
  );
}

export function Gear({ result }: { result: AnalysisResult }) {
  const [reference, setReference] = useState('cohort');
  const selected = result.references.find(
    (run) => run.reportCode + ':' + run.fightId === reference,
  );
  const comparison = selected?.character
    ? compareGear(result.targetMetrics, [
        { ...result.targetMetrics, character: selected.character },
      ])
    : result.gear;
  const character = result.targetMetrics.character;
  const hasStats = Boolean(character && Object.keys(character.stats).length);
  const hasGear = Boolean(character?.gear.length);
  const referenceLabel = selected?.player ?? 'Reference median';
  const level = comparison?.itemLevel;
  return (
    <div className="coach-stack">
      <Panel
        title="Gear & stat comparison"
        description="Your logged equipment compared with the cohort or one selected player."
      >
        <div className="coach-toolbar">
          <label className="coach-inline-label">
            Compare against
            <select
              className="coach-select"
              aria-label="Gear comparison reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            >
              <option value="cohort">Reference cohort</option>
              {result.references
                .filter((run) => run.character)
                .map((run) => (
                  <option
                    key={run.reportCode + ':' + run.fightId}
                    value={run.reportCode + ':' + run.fightId}
                  >
                    {run.player} /{' '}
                    {run.character?.itemLevel != null
                      ? fmt(run.character.itemLevel) + ' ilvl'
                      : 'item level unavailable'}
                    {!run.character?.gear.length ? ' / item level only' : ''}
                  </option>
                ))}
            </select>
          </label>
          {selected && (
            <a
              className="coach-link"
              href={selected.url}
              target="_blank"
              rel="noreferrer"
            >
              Open selected player
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        {!character && (
          <Empty>
            The selected log has no gear/stat snapshot for this player.
          </Empty>
        )}
        {character && (!hasStats || !hasGear) && (
          <div className="data-availability" role="status">
            <strong>
              This log contains{' '}
              {character.itemLevel != null
                ? 'item level'
                : 'partial equipment data'}
              , but{' '}
              {!hasGear && !hasStats
                ? 'no equipped items or stat ratings'
                : !hasStats
                  ? 'no stat ratings'
                  : 'no equipped-item list'}
              .
            </strong>
            <p>
              Warcraft Logs did not provide those details for{' '}
              {result.target.player}. They cannot be reconstructed from damage
              totals. Missing data is not zero, and this does not mean your
              character has no gear.
            </p>
            <SourceLink result={result}>Check the source report</SourceLink>
          </div>
        )}
        <div
          className="gear-level-comparison"
          aria-label="Item level comparison"
        >
          <div>
            <span>{result.target.player}</span>
            <strong>{level ? fmt(level.target) : 'Unavailable'}</strong>
            <small>Logged item level</small>
          </div>
          <div>
            <span>{referenceLabel}</span>
            <strong>
              {level?.sampleSize ? fmt(level.median) : 'Unavailable'}
            </strong>
            <small>
              {level?.sampleSize ?? 0} reference{' '}
              {level?.sampleSize === 1 ? 'player' : 'players'}
            </small>
          </div>
          <div>
            <span>Difference</span>
            <strong>
              {level?.sampleSize
                ? (level.target >= level.median ? '+' : '') +
                  fmt(level.target - level.median)
                : '-'}
            </strong>
            <small>Item levels, not predicted DPS</small>
          </div>
        </div>
      </Panel>
      <Panel
        title="Stat ratings"
        description="Raw logged values, not percentages or recommended stat weights."
      >
        {hasStats && comparison?.stats.length ? (
          <div className="coach-table-wrap">
            <table className="coach-table stat-comparison-table">
              <thead>
                <tr>
                  <th>Stat</th>
                  <th>{result.target.player}</th>
                  <th>{referenceLabel}</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {comparison.stats.map((stat) => (
                  <tr key={stat.id}>
                    <th scope="row">{stat.label}</th>
                    <td>{fmt(stat.target)}</td>
                    <td>
                      {stat.sampleSize ? fmt(stat.median) : 'Unavailable'}
                    </td>
                    <td>
                      {stat.sampleSize
                        ? (stat.target >= stat.median ? '+' : '') +
                          fmt(stat.target - stat.median)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            Stat comparison unavailable: this report has no logged stat ratings
            for {result.target.player}. Use a report with combatant details to
            compare Haste, Critical Strike, Mastery, and Versatility.
          </Empty>
        )}
        <p className="coach-footnote">
          Different talents, item effects, enchants, and gems can affect damage.
          More of a stat is not automatically better.
        </p>
      </Panel>
      <Panel
        title={
          hasGear
            ? 'Slot-by-slot equipment'
            : 'Reference equipment / your items unavailable'
        }
        description="Combat equipment only. Rings and trinkets show the two most common distinct items across either slot, not a recommended pair. Select a player to see their actual equipped pair."
      >
        {!hasGear && (
          <p className="coach-footnote">
            The source report omitted your equipped-item list. Reference items
            below are for inspection only, not detected upgrades or missing
            slots.
          </p>
        )}
        {comparison?.slots.length ? (
          <div className="gear-slots">
            {comparison.slots.map((slot) => {
              const choice = cohortItem(slot);
              const counterpart = selected
                ? selected.character?.gear.find(
                    (item) => item.slot === slot.slot,
                  )
                : choice.entry?.item;
              return (
                <details
                  className="gear-slot gear-side-by-side"
                  key={slot.slot}
                >
                  <summary>
                    <span className="gear-slot-name">
                      {GEAR_SLOTS[slot.slot] ?? 'Slot ' + slot.slot}
                    </span>
                    <span className="icon-label">
                      <GameIcon
                        icon={slot.target?.icon}
                        name={slot.target?.name ?? '?'}
                      />
                      <span>
                        <small>Your item</small>
                        <strong>
                          {slot.target?.name ??
                            (hasGear
                              ? 'No item in snapshot'
                              : 'Not provided by log')}
                        </strong>
                        <small>
                          {slot.target
                            ? 'ilvl ' + slot.target.itemLevel
                            : 'Unavailable'}
                        </small>
                      </span>
                    </span>
                    <span className="icon-label">
                      <GameIcon
                        icon={counterpart?.icon}
                        name={counterpart?.name ?? '?'}
                      />
                      <span>
                        <small>{selected?.player ?? choice.label}</small>
                        <strong>
                          {counterpart?.name ??
                            (selected
                              ? 'No item recorded in this slot'
                              : choice.missing)}
                        </strong>
                        <small>
                          {selected
                            ? counterpart
                              ? 'ilvl ' + fmt(counterpart.itemLevel)
                              : 'Unavailable'
                            : choice.entry
                              ? choice.entry.count + ' reference players'
                              : 'No reference equipment'}
                        </small>
                      </span>
                    </span>
                  </summary>
                  <div className="gear-details">
                    {slot.target && (
                      <>
                        <p className="coach-footnote">
                          Your enchant:{' '}
                          {slot.target.enchant ??
                            'No permanent enchant recorded'}{' '}
                          / {slot.target.gems.length} recorded gems
                        </p>
                        <div className="coach-toolbar">
                          {slot.target.id > 0 && (
                            <a
                              className="coach-link"
                              href={
                                'https://www.wowhead.com/item=' + slot.target.id
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Your item on Wowhead
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {slot.target.gems.map((gem, index) => (
                            <a
                              className="icon-label"
                              key={index}
                              href={'https://www.wowhead.com/item=' + gem.id}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <GameIcon
                                name={'Gem ' + gem.id}
                                icon={gem.icon}
                              />
                              <span>Gem #{gem.id}</span>
                            </a>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="coach-footnote">
                      {slot.enchantedCount}/{slot.sampleSize} reference items in
                      this slot have a permanent enchant; {slot.gemmedCount}/
                      {slot.sampleSize} have gems. Enchant/socket eligibility is
                      not inferred.
                    </p>
                    <div className="popular-items">
                      {slot.popular.map(({ item, count }) => (
                        <a
                          key={item.id}
                          className="icon-label"
                          href={
                            item.id > 0
                              ? 'https://www.wowhead.com/item=' + item.id
                              : undefined
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          <GameIcon icon={item.icon} name={item.name} />
                          <span>
                            {item.name}
                            <small>
                              {count} reference{' '}
                              {count === 1 ? 'player' : 'players'}
                              {item.enchant ? ' / ' + item.enchant : ''}
                            </small>
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <Empty>
            No equipped-item records are available for this comparison.
          </Empty>
        )}
      </Panel>
    </div>
  );
}
