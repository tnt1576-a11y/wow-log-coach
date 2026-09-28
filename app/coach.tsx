'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { ApiQuota, useWarcraftLogsStatus } from './api-quota';
import { APP_VERSION } from '@/lib/version';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { AnalysisLoading } from './analysis-loading';
import { readAnalysisResponse } from '@/lib/read-analysis-stream';
import type { AnalysisProgress } from '@/lib/analysis-context';
import { Switch } from '@/components/ui/switch';
import { CoachingPanels } from './coaching-report';
import type {
  AnalysisResult,
  FightOption,
  InspectionResult,
} from '@/lib/domain';
import { demoAnalysis, demoInspection } from '@/lib/demo';
import { affixMatchingApplies, raidDifficultyLabel } from '@/lib/domain';

type Phase = 'idle' | 'inspecting' | 'ready' | 'analyzing' | 'done' | 'error';
type DatePreset = '14' | '30' | '90' | 'all' | 'custom';

export function Coach({ localMode = false }: { localMode?: boolean } = {}) {
  const [reportUrl, setReportUrl] = useState('');
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [fightId, setFightId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [percentilePreset, setPercentilePreset] = useState('95');
  const [percentileMin, setPercentileMin] = useState(95);
  const [percentileMax, setPercentileMax] = useState(100);
  const [datePreset, setDatePreset] = useState<DatePreset>('14');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [matchAffixes, setMatchAffixes] = useState(true);
  const [raidDurationTolerancePercent, setRaidDurationTolerancePercent] =
    useState(20);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult>(demoAnalysis);
  const [preview, setPreview] = useState(true);
  const [hasResult, setHasResult] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const {
    status: apiStatus,
    refresh: refreshApiStatus,
    recordProgress,
  } = useWarcraftLogsStatus();
  const activeAnalysis = useRef<AbortController | null>(null);
  const activeInspection = useRef<AbortController | null>(null);
  const [updates, setUpdates] = useState<AnalysisProgress[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  function appendProgress(update: AnalysisProgress) {
    recordProgress(update);
    setUpdates((items) => [...items.slice(-79), update]);
  }
  useEffect(
    () => () => {
      activeAnalysis.current?.abort();
      activeInspection.current?.abort();
    },
    [],
  );

  const selectedFight = useMemo(
    () => inspection?.fights.find((fight) => fight.id === fightId) ?? null,
    [inspection, fightId],
  );

  async function inspect(url = reportUrl) {
    if (!url.trim()) return;
    activeInspection.current?.abort();
    const controller = new AbortController();
    activeInspection.current = controller;
    setInspection(null);
    setPhase('inspecting');
    setError('');
    try {
      const response = await fetch('/api/inspect', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportUrl: url }),
      });
      const body: unknown = await response.json();
      if (activeInspection.current !== controller) return;
      if (!response.ok)
        throw new Error(apiMessage(body, 'Could not inspect this report.'));
      const data = body as InspectionResult;
      setInspection(data);
      const nextFight = data.selectedFightId ?? data.fights[0]?.id ?? null;
      setFightId(nextFight);
      const fight = data.fights.find((item) => item.id === nextFight);
      setSourceId(data.selectedSourceId ?? fight?.players[0]?.id ?? null);
      setPhase('ready');
    } catch (reason) {
      if (activeInspection.current !== controller || controller.signal.aborted)
        return;
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not inspect this report.',
      );
      setPhase('error');
    } finally {
      if (activeInspection.current === controller)
        activeInspection.current = null;
      void refreshApiStatus();
    }
  }

  async function runAnalysis() {
    if (!fightId || !sourceId || activeAnalysis.current) return;
    const controller = new AbortController();
    activeAnalysis.current = controller;
    setUpdates([]);
    setStartedAt(Date.now());
    let silent = false;
    let timer: ReturnType<typeof setTimeout>;
    const activity = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        silent = true;
        controller.abort();
      }, 70_000);
    };
    activity();
    setPhase('analyzing');
    setError('');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
        },
        signal: controller.signal,
        body: JSON.stringify({
          reportUrl,
          fightId,
          sourceId,
          percentileMin,
          percentileMax,
          datePreset,
          raidDurationTolerancePercent:
            selectedFight?.contentType === 'raid'
              ? raidDurationTolerancePercent
              : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          matchAffixes: Boolean(
            selectedFight &&
            affixMatchingApplies(selectedFight) &&
            matchAffixes,
          ),
        }),
      });
      const body = await readAnalysisResponse(
        response,
        (update) => {
          if (activeAnalysis.current === controller) appendProgress(update);
        },
        activity,
      );
      if (activeAnalysis.current !== controller) return;
      setResult(body);
      setHasResult(true);
      setPreview(body.target.reportCode === 'example');
      setPhase('done');
      setControlsOpen(false);
    } catch (reason) {
      const message = controller.signal.aborted
        ? silent
          ? 'No server activity was received for 70 seconds. The connection was stopped; retry to reuse completed responses.'
          : 'Comparison cancelled. Completed API responses can be reused for 10 minutes.'
        : reason instanceof Error
          ? reason.message
          : 'Analysis failed.';
      if (activeAnalysis.current !== controller) return;
      setError(message);
      appendProgress({ stage: 'error', message, at: Date.now() });
      setPhase('error');
    } finally {
      clearTimeout(timer!);
      if (activeAnalysis.current === controller) activeAnalysis.current = null;
      void refreshApiStatus();
    }
  }

  function chooseFight(value: string) {
    const next = Number(value);
    setFightId(next);
    setSourceId(
      inspection?.fights.find((fight) => fight.id === next)?.players[0]?.id ??
        null,
    );
  }

  function choosePercentile(value: string) {
    setPercentilePreset(value);
    if (value !== 'custom') {
      setPercentileMin(Number(value));
      setPercentileMax(100);
    }
  }

  function usePreview() {
    activeInspection.current?.abort();
    activeInspection.current = null;
    const url = 'https://www.warcraftlogs.com/reports/example#fight=last';
    setReportUrl(url);
    setInspection(demoInspection);
    setFightId(demoInspection.selectedFightId ?? null);
    setSourceId(demoInspection.selectedSourceId ?? null);
    setResult(demoAnalysis);
    setPreview(true);
    setHasResult(true);
    setPhase('ready');
    setError('');
    setControlsOpen(false);
  }

  function reset() {
    activeInspection.current?.abort();
    activeInspection.current = null;
    activeAnalysis.current?.abort();
    activeAnalysis.current = null;
    setUpdates([]);
    setControlsOpen(true);
    setReportUrl('');
    setInspection(null);
    setFightId(null);
    setSourceId(null);
    setPhase('idle');
    setError('');
    setResult(demoAnalysis);
    setPreview(true);
    setHasResult(false);
  }

  const inspectFromTool = useEffectEvent(async (url: string) => {
    setReportUrl(url);
    await inspect(url);
  });
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'start_wow_log_inspection',
          title: 'Inspect Warcraft Logs report',
          description:
            'Load a public Warcraft Logs report into the visible WoW Log Coach workflow.',
          inputSchema: {
            type: 'object',
            properties: {
              reportUrl: {
                type: 'string',
                description: 'A warcraftlogs.com/reports URL.',
              },
            },
            required: ['reportUrl'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          async execute(input) {
            const value = input as { reportUrl?: unknown };
            if (
              typeof value.reportUrl !== 'string' ||
              !value.reportUrl.trim()
            ) {
              throw new Error('reportUrl must be a non-empty string.');
            }
            await inspectFromTool(value.reportUrl);
            return { status: 'inspected', reportUrl: value.reportUrl };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header
        apiStatus={apiStatus}
        localMode={localMode}
        onReset={reset}
        onRefreshQuota={() => {
          void refreshApiStatus(true);
        }}
      />
      <div className="report-workspace">
        <details
          className="analysis-setup"
          open={controlsOpen}
          onToggle={(event) => setControlsOpen(event.currentTarget.open)}
        >
          <summary>
            Report &amp; comparison filters{' '}
            <span>
              {controlsOpen
                ? 'Close setup'
                : 'Change log, player or reference filters'}
            </span>
          </summary>
          <Card className="panel overflow-visible">
            <CardHeader className="border-b border-white/7 pb-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-violet-300">
                <WandSparkles className="size-3.5" /> New comparison
              </div>
              <CardTitle className="text-xl font-semibold text-white">
                Analyze your run
              </CardTitle>
              <CardDescription>
                Paste a Warcraft Logs report. API credentials stay on the
                server.
              </CardDescription>
            </CardHeader>
            <CardContent className="analysis-control-fields pt-1">
              <div className="block space-y-2">
                <span className="field-label">Warcraft Logs URL</span>
                <Input
                  aria-label="Warcraft Logs URL"
                  value={reportUrl}
                  disabled={phase === 'analyzing'}
                  onChange={(event) => {
                    activeInspection.current?.abort();
                    activeInspection.current = null;
                    setReportUrl(event.target.value);
                    setInspection(null);
                    setFightId(null);
                    setSourceId(null);
                    setError('');
                    setPhase('idle');
                  }}
                  placeholder="warcraftlogs.com/reports/..."
                  className="h-11 border-white/10 bg-black/20 text-white placeholder:text-slate-600"
                />
              </div>
              {!inspection ? (
                <>
                  <Button
                    className="h-11 w-full bg-violet-500 font-semibold text-white hover:bg-violet-400"
                    disabled={!reportUrl || phase === 'inspecting'}
                    onClick={() => void inspect()}
                  >
                    {phase === 'inspecting' ? (
                      <>
                        <LoaderCircle className="animate-spin" /> Inspecting
                        report
                      </>
                    ) : (
                      <>
                        Inspect report <ArrowRight />
                      </>
                    )}
                  </Button>
                  <button
                    className="w-full text-center text-xs text-slate-500 transition hover:text-slate-300"
                    onClick={usePreview}
                  >
                    Explore a sample review
                  </button>
                </>
              ) : (
                <AnalysisControls
                  inspection={inspection}
                  selectedFight={selectedFight}
                  fightId={fightId}
                  sourceId={sourceId}
                  chooseFight={chooseFight}
                  setSourceId={setSourceId}
                  percentilePreset={percentilePreset}
                  choosePercentile={choosePercentile}
                  percentileMin={percentileMin}
                  percentileMax={percentileMax}
                  setPercentileMin={setPercentileMin}
                  setPercentileMax={setPercentileMax}
                  datePreset={datePreset}
                  setDatePreset={setDatePreset}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  setDateFrom={setDateFrom}
                  setDateTo={setDateTo}
                  raidDurationTolerancePercent={raidDurationTolerancePercent}
                  setRaidDurationTolerancePercent={
                    setRaidDurationTolerancePercent
                  }
                  matchAffixes={matchAffixes}
                  setMatchAffixes={setMatchAffixes}
                  phase={phase}
                  runAnalysis={runAnalysis}
                />
              )}
              {error && (
                <div
                  role="alert"
                  className="flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/8 p-3 text-xs leading-relaxed text-rose-200"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
          <EvidenceNote />
        </details>
        <section className="min-w-0 space-y-5">
          {(hasResult || phase === 'analyzing') && (
            <Intro result={result} preview={preview} phase={phase} />
          )}
          {phase === 'analyzing' ||
          (phase === 'error' && updates.length > 0) ? (
            <AnalysisLoading
              updates={updates}
              startedAt={startedAt}
              stopped={phase === 'error'}
              onCancel={() => activeAnalysis.current?.abort()}
            />
          ) : hasResult ? (
            <ReportView result={result} preview={preview} />
          ) : (
            <StartReview onPreview={usePreview} ready={Boolean(inspection)} />
          )}
        </section>
      </div>
    </main>
  );
}

interface ControlProps {
  inspection: InspectionResult;
  selectedFight: FightOption | null;
  fightId: number | null;
  sourceId: number | null;
  chooseFight: (value: string) => void;
  setSourceId: (value: number) => void;
  percentilePreset: string;
  choosePercentile: (value: string) => void;
  percentileMin: number;
  percentileMax: number;
  setPercentileMin: (value: number) => void;
  setPercentileMax: (value: number) => void;
  datePreset: DatePreset;
  setDatePreset: (value: DatePreset) => void;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  raidDurationTolerancePercent: number;
  setRaidDurationTolerancePercent: (value: number) => void;
  matchAffixes: boolean;
  setMatchAffixes: (value: boolean) => void;
  phase: Phase;
  runAnalysis: () => void;
}

function AnalysisControls(props: ControlProps) {
  return (
    <>
      <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/6 p-3 text-xs text-emerald-200">
        <Check className="mr-2 inline size-3.5" />
        {props.inspection.reportTitle}
      </div>
      <div className="block space-y-2">
        <span className="field-label">Dungeon run or raid boss kill</span>
        <NativeSelect
          aria-label="Dungeon run or raid boss kill"
          className="w-full"
          value={String(props.fightId ?? '')}
          onChange={(event) => props.chooseFight(event.target.value)}
        >
          {props.inspection.fights.map((fight) => (
            <NativeSelectOption key={fight.id} value={String(fight.id)}>
              {fight.name}{' '}
              {fight.contentType === 'raid'
                ? '· ' + raidDifficultyLabel(fight.difficulty)
                : '+' + fight.keystoneLevel}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="block space-y-2">
        <span className="field-label">DPS player</span>
        <NativeSelect
          aria-label="DPS player"
          className="w-full"
          value={String(props.sourceId ?? '')}
          onChange={(event) => props.setSourceId(Number(event.target.value))}
        >
          {props.selectedFight?.players.map((player) => (
            <NativeSelectOption key={player.id} value={String(player.id)}>
              {player.name} / {player.specName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <span className="field-label">
            {props.selectedFight?.contentType === 'raid'
              ? 'Boss DPS percentile'
              : 'Same-key DPS percentile'}
          </span>
          <NativeSelect
            aria-label="Reference DPS percentile"
            className="w-full"
            value={props.percentilePreset}
            onChange={(event) => props.choosePercentile(event.target.value)}
          >
            <NativeSelectOption value="95">95-100</NativeSelectOption>
            <NativeSelectOption value="99">99-100</NativeSelectOption>
            <NativeSelectOption value="90">90-100</NativeSelectOption>
            <NativeSelectOption value="custom">Custom</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <span className="field-label">Log age</span>
          <NativeSelect
            aria-label="Reference log age"
            className="w-full"
            value={props.datePreset}
            onChange={(event) =>
              props.setDatePreset(event.target.value as DatePreset)
            }
          >
            <NativeSelectOption value="14">Last 14 days</NativeSelectOption>
            <NativeSelectOption value="30">Last 30 days</NativeSelectOption>
            <NativeSelectOption value="90">Last 90 days</NativeSelectOption>
            <NativeSelectOption value="all">
              All current partition
            </NativeSelectOption>
            <NativeSelectOption value="custom">Custom dates</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      {props.percentileMin >= 99 && (
        <p className="text-xs text-muted-foreground">
          99–100 is a narrow range and may return fewer than 20 matches. Your
          selected filters stay in effect throughout the search.
        </p>
      )}
      {props.percentilePreset === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            aria-label="Minimum percentile"
            type="number"
            min={0}
            max={100}
            value={props.percentileMin}
            onChange={(event) =>
              props.setPercentileMin(Number(event.target.value))
            }
          />
          <Input
            aria-label="Maximum percentile"
            type="number"
            min={0}
            max={100}
            value={props.percentileMax}
            onChange={(event) =>
              props.setPercentileMax(Number(event.target.value))
            }
          />
        </div>
      )}
      {props.datePreset === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            aria-label="Start date"
            type="date"
            value={props.dateFrom}
            onChange={(event) => props.setDateFrom(event.target.value)}
          />
          <Input
            aria-label="End date"
            type="date"
            value={props.dateTo}
            onChange={(event) => props.setDateTo(event.target.value)}
          />
        </div>
      )}
      {props.selectedFight?.contentType === 'raid' && (
        <label className="block space-y-2">
          <span className="field-label">Similar kill duration</span>
          <NativeSelect
            aria-label="Raid kill duration tolerance"
            value={String(props.raidDurationTolerancePercent)}
            onChange={(event) =>
              props.setRaidDurationTolerancePercent(Number(event.target.value))
            }
          >
            {[10, 20, 30, 50].map((value) => (
              <NativeSelectOption key={value} value={String(value)}>
                Within {value}% of your fight
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="block text-xs text-slate-400">
            Tighter ranges make cooldown counts more comparable. Wider ranges
            can find more players.
          </span>
        </label>
      )}
      {props.selectedFight && affixMatchingApplies(props.selectedFight) ? (
        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] p-3.5">
          <div>
            <p className="text-sm font-medium text-slate-200">Match affixes</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Recommended for fair comparisons
            </p>
          </div>
          <Switch
            checked={props.matchAffixes}
            onCheckedChange={props.setMatchAffixes}
            aria-label="Match affixes"
          />
        </div>
      ) : (
        <p className="comparison-context-note">
          {props.selectedFight?.contentType === 'raid'
            ? 'References match this boss, difficulty and spec, with fight duration within 20%. Raid boss kills only.'
            : 'Affix matching is automatic at +12 and above: these keys use the fixed affix set.'}
        </p>
      )}
      <Button
        className="h-11 w-full bg-violet-500 font-semibold text-white hover:bg-violet-400"
        disabled={
          !props.fightId || !props.sourceId || props.phase === 'analyzing'
        }
        onClick={() => props.runAnalysis()}
      >
        {props.phase === 'analyzing' ? (
          <>
            <LoaderCircle className="animate-spin" /> Comparing logs
          </>
        ) : (
          <>
            Compare with top 20 <ArrowRight />
          </>
        )}
      </Button>
    </>
  );
}

function StartReview({
  onPreview,
  ready,
}: {
  onPreview: () => void;
  ready: boolean;
}) {
  return (
    <section className="brief-start">
      <span className="brief-kicker">YOUR NEXT RUN, WITH A PLAN</span>
      <h1>
        {ready
          ? 'Your report is ready to review'
          : 'Turn a combat log into your next improvement'}
      </h1>
      <p>
        {ready
          ? 'Choose your run and character, then start the comparison. Your review will combine recorded moments with the matching spec guide.'
          : 'Paste a Warcraft Logs report to find the decisions worth reviewing, see when they happened, and choose one thing to practice.'}
      </p>
      <ol className="brief-start-steps">
        <li>
          <div>
            <strong>Choose your run</strong>
            <span>
              Paste a public report link or code. Select the dungeon run or raid
              boss kill and your DPS character.
            </span>
          </div>
        </li>
        <li>
          <div>
            <strong>Find the moments that matter</strong>
            <span>
              Review deaths, rotation observations and pauses with nearby casts
              and pull context.
            </span>
          </div>
        </li>
        <li>
          <div>
            <strong>Take one focus into your next run</strong>
            <span>
              Choose a concrete action, with the conditions to check before
              changing your play.
            </span>
          </div>
        </li>
      </ol>
      <div className="brief-start-preview">
        <Button variant="outline" onClick={onPreview}>
          Explore a sample review <ArrowRight />
        </Button>
        <span>Illustrative data. No Warcraft Logs quota used.</span>
      </div>
    </section>
  );
}

function Header({
  apiStatus,
  onRefreshQuota,
  localMode,
  onReset,
}: {
  apiStatus: ReturnType<typeof useWarcraftLogsStatus>['status'];
  onRefreshQuota: () => void;
  localMode: boolean;
  onReset: () => void;
}) {
  const configured = apiStatus.configured;
  const label =
    configured === null
      ? 'Checking setup'
      : configured
        ? 'API configured'
        : 'Preview mode';
  const tone = configured
    ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-300'
    : 'border-amber-400/20 bg-amber-400/8 text-amber-300';
  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#090b12]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark">
            <Activity className="size-5" />
          </div>
          <div>
            <p className="font-heading text-[15px] font-semibold tracking-tight text-white">
              WoW Log Coach
            </p>
            <p className="text-xs font-medium text-slate-400">
              <span aria-label={'Version ' + APP_VERSION}>v{APP_VERSION}</span>
              <span aria-hidden="true"> · </span>
              Mythic+ &amp; raid
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={tone + ' hidden sm:inline-flex'}>
            <span className="size-1.5 rounded-full bg-current" />
            {label}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset analysis"
            onClick={onReset}
          >
            <RotateCcw />
          </Button>
          {!localMode && (
            <form method="post" action="/api/access/logout">
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Lock site"
                title="Lock site"
              >
                <LockKeyhole />
              </Button>
            </form>
          )}
        </div>
      </div>
      <ApiQuota status={apiStatus} onRefresh={onRefreshQuota} />
    </header>
  );
}

function Intro({
  result,
  preview,
  phase,
}: {
  result: AnalysisResult;
  preview: boolean;
  phase: Phase;
}) {
  return (
    <div className="report-intro">
      <div>
        <h1>
          {phase === 'analyzing'
            ? 'Building your review...'
            : preview
              ? 'Explore a sample review'
              : result.target.player}
        </h1>
        <p>
          {phase === 'analyzing'
            ? 'Loading your run and matching reference players. Progress appears below.'
            : preview
              ? 'Illustrative preview. Analyze your own log to get a personal review.'
              : result.target.dungeon +
                (result.target.contentType === 'raid'
                  ? ' · ' + raidDifficultyLabel(result.target.difficulty)
                  : ' +' + result.target.keyLevel) +
                ' / ' +
                result.target.specName +
                ' ' +
                result.target.className +
                ' / ' +
                formatDuration(result.target.duration)}
        </p>
      </div>
      {!preview && (
        <Button variant="outline" onClick={() => downloadResult(result)}>
          <Download />
          Export evidence
        </Button>
      )}
    </div>
  );
}

function ReportView({
  result,
  preview,
}: {
  result: AnalysisResult;
  preview: boolean;
}) {
  return (
    <div className="space-y-5">
      {result.warnings.length > 0 && (
        <details className="rounded-xl border border-amber-400/15 bg-amber-400/6 p-3 text-sm text-amber-200">
          <summary className="cursor-pointer">
            {result.warnings.length} data notes &amp; comparison limits
          </summary>
          {result.warnings.map((warning) => (
            <p key={warning} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {warning}
            </p>
          ))}
        </details>
      )}
      <div className="training-report-context">
        <span>
          <b>{result.cohort.actualSize}</b> reference players
        </span>
        <span>
          {result.cohort.percentileMin}-{result.cohort.percentileMax}{' '}
          {result.target.contentType === 'raid' ? 'boss' : 'same-key'} DPS
          percentile
        </span>
        <span>{result.cohort.dateLabel}</span>
        {result.cohort.actualSize < 8 && (
          <strong>Small sample: comparison advice limited</strong>
        )}
        <a href={result.target.url} target="_blank" rel="noreferrer">
          Open source log <ExternalLink size={14} />
        </a>
      </div>
      <CoachingPanels
        key={
          result.generatedAt + result.target.reportCode + result.target.sourceId
        }
        result={result}
        preview={preview}
      />
    </div>
  );
}

function EvidenceNote() {
  return (
    <div className="rounded-xl border border-white/7 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-500">
      <div className="mb-2 flex items-center gap-2 font-medium text-slate-300">
        <ShieldCheck className="size-4 text-emerald-400" /> Evidence, not
        guesswork
      </div>
      Fewer than 8 comparable runs limits comparison advice. Recorded events can
      still be reviewed. Filters are never broadened silently.
    </div>
  );
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

function downloadResult(result: AnalysisResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    'wow-log-coach-' +
    result.target.reportCode +
    '-' +
    result.target.fightId +
    '.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function apiMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object') return fallback;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}
