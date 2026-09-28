import { createHash } from 'node:crypto';
import type { AnalysisRequest, AnalysisResult } from './domain';
import { AppError, parseReportLocator } from './domain';
import { analyze } from './analyze';
import { analysisContext, type AnalysisProgress } from './analysis-context';
import { quotaStatus } from './wcl-transport';

export type AnalysisMessage =
  | { type: 'progress'; progress: AnalysisProgress }
  | { type: 'heartbeat'; at: number }
  | { type: 'result'; result: AnalysisResult; cached?: boolean }
  | {
      type: 'error';
      error: { code: string; message: string; details?: unknown };
    };
type Job = {
  controller: AbortController;
  listeners: Set<(message: AnalysisMessage) => void>;
  history: AnalysisProgress[];
  terminal?: AnalysisMessage;
  timer?: ReturnType<typeof setTimeout>;
};
const jobs = new Map<string, Job>();
const completed = new Map<string, { json: string; expiresAt: number }>();
const MAX_RESULT_BYTES = 16 * 1024 * 1024;
function keyFor(input: AnalysisRequest) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        process.env.WCL_CLIENT_ID,
        process.env.WCL_CLIENT_SECRET,
        { ...input, reportUrl: parseReportLocator(input.reportUrl).reportCode },
      ]),
    )
    .digest('hex');
}
function cacheResult(key: string, message: AnalysisMessage) {
  const json = JSON.stringify(message);
  if (json.length * 2 > MAX_RESULT_BYTES) return;
  for (const [id, value] of completed)
    if (value.expiresAt <= Date.now()) completed.delete(id);
  while (
    completed.size >= 5 ||
    [...completed.values()].reduce(
      (total, item) => total + item.json.length * 2,
      0,
    ) +
      json.length * 2 >
      MAX_RESULT_BYTES
  ) {
    const oldest = completed.keys().next().value;
    if (oldest === undefined) break;
    completed.delete(oldest);
  }
  completed.set(key, { json, expiresAt: Date.now() + 10 * 60_000 });
}

export function streamAnalysis(
  request: Request,
  input: AnalysisRequest,
  execute = analyze,
): Response {
  const key = keyFor(input);
  const cached = completed.get(key);
  if (cached && cached.expiresAt > Date.now())
    return new Response(cached.json + '\n', { headers: streamHeaders });
  let job = jobs.get(key);
  const fresh = !job;
  if (!job) {
    if (jobs.size >= 2)
      throw new AppError(
        'Two comparisons are already running. Cancel one before starting another.',
        409,
        'ANALYSIS_BUSY',
      );
    job = {
      controller: new AbortController(),
      listeners: new Set(),
      history: [],
    };
    jobs.set(key, job);
  }
  const activeJob = job;
  const encoder = new TextEncoder();
  let detach = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      // The timer is assigned after the callbacks are initialized.
      // oxlint-disable-next-line prefer-const
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        activeJob.listeners.delete(send);
        request.signal.removeEventListener('abort', stop);
        try {
          controller.close();
        } catch {
          /* Consumer already cancelled. */
        }
        if (!activeJob.listeners.size && !activeJob.terminal) {
          activeJob.controller.abort();
          if (jobs.get(key) === activeJob) jobs.delete(key);
        }
      };
      const send = (message: AnalysisMessage) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
        } catch {
          stop();
          return;
        }
        if (message.type === 'result' || message.type === 'error') stop();
      };
      detach = stop;
      activeJob.listeners.add(send);
      request.signal.addEventListener('abort', stop, { once: true });
      if (request.signal.aborted) {
        stop();
        return;
      }
      for (const update of activeJob.history)
        send({ type: 'progress', progress: update });
      if (!fresh)
        send({
          type: 'progress',
          progress: {
            at: Date.now(),
            stage: 'connection',
            message:
              'Reconnected to the existing comparison; no duplicate analysis started.',
          },
        });
      heartbeat = setInterval(
        () => send({ type: 'heartbeat', at: Date.now() }),
        5000,
      );
    },
    cancel() {
      detach();
    },
  });
  if (fresh) {
    let timedOut = false;
    activeJob.timer = setTimeout(() => {
      timedOut = true;
      activeJob.controller.abort();
    }, 15 * 60_000);
    const publish = (update: AnalysisProgress) => {
      activeJob.history.push(update);
      if (activeJob.history.length > 50) activeJob.history.shift();
      for (const listener of activeJob.listeners)
        listener({ type: 'progress', progress: update });
    };
    const finish = (message: AnalysisMessage) => {
      activeJob.terminal = message;
      clearTimeout(activeJob.timer);
      for (const listener of activeJob.listeners) listener(message);
      if (jobs.get(key) === activeJob) jobs.delete(key);
    };
    void analysisContext.run(
      {
        signal: activeJob.controller.signal,
        publish,
        requests: 0,
        cacheHits: 0,
      },
      async () => {
        try {
          if (activeJob.controller.signal.aborted)
            throw new AppError(
              'Comparison cancelled.',
              499,
              'ANALYSIS_CANCELLED',
            );
          const result = await execute(input);
          if (activeJob.controller.signal.aborted)
            throw new AppError(
              'Comparison cancelled.',
              499,
              'ANALYSIS_CANCELLED',
            );
          cacheResult(key, { type: 'result', result, cached: true });
          finish({ type: 'result', result });
        } catch (error) {
          const failure =
            error instanceof AppError
              ? error
              : new AppError(
                  'The comparison could not be completed. Completed API responses are cached for retry.',
                  500,
                  'ANALYSIS_FAILED',
                );
          finish({
            type: 'error',
            error: {
              code: timedOut ? 'ANALYSIS_TIMEOUT' : failure.code,
              message: timedOut
                ? 'Comparison exceeded 15 minutes and was stopped. Try again to reuse cached responses, or choose different filters.'
                : failure.message,
              details: failure.details ?? quotaStatus(),
            },
          });
        }
      },
    );
  }
  return new Response(stream, { headers: streamHeaders });
}
const streamHeaders = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
  'X-Accel-Buffering': 'no',
};
