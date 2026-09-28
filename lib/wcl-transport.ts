import { AppError } from './domain';
import { analysisContext, checkCancelled, progress } from './analysis-context';

const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const TTL = 10 * 60_000;
const MAX_BYTES = 20 * 1024 * 1024;
const QUOTA_REFRESH_MS = 60_000;
const MAX_ANALYSIS_POINTS = 600;
const MAX_ANALYSIS_REQUESTS = 120;
let meteredTail: Promise<void> = Promise.resolve();
const operationCosts = new Map<string, number>();
const QUOTA_QUERY =
  'query QuotaStatus { rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn } }';
export interface WclQuota {
  limit: number;
  spent: number;
  resetAt: number;
  observedAt?: number;
}
let credentialScope = '';
let token: { value: string; expiresAt: number } | null = null;
let tokenPending: Promise<string> | null = null;
const cache = new Map<string, { json: string; expiresAt: number }>();
let cacheBytes = 0;
let quota: WclQuota | undefined;
let quotaAttemptAt = Number.NEGATIVE_INFINITY;
let quotaUnavailable = false;
let quotaPending: { owner: string; promise: Promise<void> } | undefined;
let blockedUntil = 0;
let active = 0;
const queue: Array<() => void> = [];
const inFlight = new Map<
  string,
  { signal?: AbortSignal; owner: string; promise: Promise<unknown> }
>();

export function credentialsConfigured() {
  return Boolean(process.env.WCL_CLIENT_ID && process.env.WCL_CLIENT_SECRET);
}
function scope() {
  const next = JSON.stringify([
    process.env.WCL_CLIENT_ID,
    process.env.WCL_CLIENT_SECRET,
  ]);
  if (next !== credentialScope) {
    credentialScope = next;
    token = null;
    tokenPending = null;
    cache.clear();
    cacheBytes = 0;
    quota = undefined;
    quotaAttemptAt = Number.NEGATIVE_INFINITY;
    quotaUnavailable = false;
    quotaPending = undefined;
    blockedUntil = 0;
    operationCosts.clear();
  }
  return next;
}
export function quotaStatus() {
  scope();
  return {
    quota: quota && quota.resetAt > Date.now() ? quota : undefined,
    retryAt: blockedUntil > Date.now() ? blockedUntil : undefined,
    quotaUnavailable: quotaUnavailable || undefined,
  };
}
/** Lightweight status refresh; shares all transport limits and credential scope. */
export async function refreshQuotaStatus() {
  const owner = scope();
  const now = Date.now();
  if (!credentialsConfigured() || blockedUntil > now) return quotaStatus();
  if (quotaPending?.owner === owner) {
    await quotaPending.promise;
    return quotaStatus();
  }
  if (
    quota &&
    quota.resetAt > now &&
    now - (quota.observedAt ?? 0) < QUOTA_REFRESH_MS
  )
    return quotaStatus();
  const resetAt = Math.max(quota?.resetAt ?? 0, blockedUntil);
  const crossedReset =
    resetAt > 0 && resetAt <= now && quotaAttemptAt < resetAt;
  if (!crossedReset && now - quotaAttemptAt < QUOTA_REFRESH_MS)
    return quotaStatus();
  quotaAttemptAt = now;
  const entry = {
    owner,
    promise: (async () => {
      try {
        await graphql(QUOTA_QUERY, {});
        if (owner === credentialScope)
          quotaUnavailable =
            !quota ||
            quota.resetAt <= Date.now() ||
            (quota.observedAt ?? 0) < now;
      } catch {
        // Status stays usable during an outage; never present missing data as 0.
        if (owner === credentialScope) quotaUnavailable = true;
      }
    })(),
  };
  quotaPending = entry;
  try {
    await entry.promise;
  } finally {
    if (quotaPending === entry) quotaPending = undefined;
  }
  return quotaStatus();
}

function quotaError() {
  return new AppError(
    'Warcraft Logs API budget is unavailable. Retry after ' +
      new Date(blockedUntil).toLocaleTimeString('en') +
      '. Cached responses are still reusable; refreshing does not reset the quota.',
    429,
    'WCL_RATE_LIMITED',
    { retryAt: blockedUntil, quota },
  );
}
async function slot(signal?: AbortSignal) {
  checkCancelled();
  if (active >= 4)
    await new Promise<void>((resolve, reject) => {
      const start = () => {
        signal?.removeEventListener('abort', abort);
        resolve();
      };
      const abort = () => {
        const index = queue.indexOf(start);
        if (index >= 0) queue.splice(index, 1);
        reject(new AppError('Comparison stopped.', 499, 'ANALYSIS_CANCELLED'));
      };
      queue.push(start);
      signal?.addEventListener('abort', abort, { once: true });
    });
  else active++;
  return () => {
    const next = queue.shift();
    if (next) next();
    else active--;
  };
}
interface ApiBody {
  access_token?: string;
  expires_in?: number;
  data?: {
    rateLimitData?: {
      limitPerHour: number;
      pointsSpentThisHour: number;
      pointsResetIn: number;
    };
    [key: string]: unknown;
  };
  errors?: Array<{ message?: string }>;
}
async function fetchJson(url: string, init: RequestInit, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(45_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    // The deadline includes reading the response body, not just its headers.
    const body = response.ok ? ((await response.json()) as ApiBody) : null;
    return { response, body };
  } catch (error) {
    if (signal?.aborted)
      throw new AppError('Comparison stopped.', 499, 'ANALYSIS_CANCELLED');
    if (timeout.aborted)
      throw new AppError(
        'Warcraft Logs did not finish a request within 45 seconds. Retry to reuse completed responses.',
        504,
        'WCL_TIMEOUT',
      );
    if (error instanceof AppError) throw error;
    throw new AppError(
      'Warcraft Logs could not be reached or returned an unreadable response. Retry shortly.',
      502,
      'WCL_REQUEST_FAILED',
    );
  }
}
async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  if (tokenPending) return tokenPending;
  const clientId = process.env.WCL_CLIENT_ID,
    secret = process.env.WCL_CLIENT_SECRET;
  if (!clientId || !secret)
    throw new AppError(
      'Warcraft Logs credentials are not configured. Add your client ID and secret to .env.local.',
      503,
      'WCL_NOT_CONFIGURED',
    );
  const owner = credentialScope;
  const pending = (async () => {
    const { response, body } = await fetchJson(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(clientId + ':' + secret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!response.ok)
      throw new AppError(
        response.status === 401
          ? 'Warcraft Logs rejected the configured credentials.'
          : 'Could not authenticate with Warcraft Logs.',
        502,
        'WCL_AUTH_FAILED',
      );
    if (typeof body?.access_token !== 'string' || !body.access_token)
      throw new AppError(
        'Warcraft Logs returned an invalid token response.',
        502,
        'WCL_AUTH_INVALID',
      );
    if (owner === credentialScope)
      token = {
        value: body.access_token,
        expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
      };
    return body.access_token as string;
  })();
  tokenPending = pending;
  try {
    return await pending;
  } finally {
    if (tokenPending === pending) tokenPending = null;
  }
}
function remember(key: string, data: unknown, ttl: number) {
  const json = JSON.stringify(data);
  if (json.length * 2 > MAX_BYTES) return;
  const old = cache.get(key);
  if (old) {
    cacheBytes -= old.json.length * 2;
    cache.delete(key);
  }
  for (const [id, value] of cache)
    if (value.expiresAt <= Date.now()) {
      cache.delete(id);
      cacheBytes -= value.json.length * 2;
    }
  while (cache.size >= 160 || cacheBytes + json.length * 2 > MAX_BYTES) {
    const id = cache.keys().next().value;
    if (id === undefined) break;
    cacheBytes -= cache.get(id)!.json.length * 2;
    cache.delete(id);
  }
  cache.set(key, { json, expiresAt: Date.now() + ttl });
  cacheBytes += json.length * 2;
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const owner = scope();
  checkCancelled();
  const key = JSON.stringify([query, variables]);
  const context = analysisContext.getStore();
  const pending = inFlight.get(key);
  if (
    pending &&
    pending.owner === owner &&
    pending.signal === context?.signal
  ) {
    if (context) context.cacheHits++;
    progress('api', 'Reused an identical request already in progress.');
    return structuredClone(await pending.promise) as T;
  }
  const entry = {
    signal: context?.signal,
    owner,
    promise: executeGraphql<T>(query, variables),
  };
  inFlight.set(key, entry);
  try {
    return await entry.promise;
  } finally {
    if (inFlight.get(key) === entry) inFlight.delete(key);
  }
}

export function analysisBudgetStatus() {
  const budget = analysisContext.getStore()?.budget;
  return budget ? { ...budget } : undefined;
}
function budgetError(message: string) {
  const context = analysisContext.getStore();
  if (context?.budget) context.budget.limited = true;
  progress('budget', message, { quota });
  return new AppError(message, 429, 'WCL_QUOTA_GUARD', {
    budget: analysisBudgetStatus(),
    quota,
  });
}
function estimatedCost(query: string) {
  const operation = query.match(/query\s+(\w+)/)?.[1] ?? query;
  return (
    operationCosts.get(operation) ??
    Math.max(
      2,
      (query.match(/\b(?:table|graph|events)\s*\(/g)?.length ?? 0) * 12 + 2,
    )
  );
}
// Serialize report requests so the next decision includes the previous cost.
// Quota-only queries are exempt, avoiding a preflight deadlock.
async function meteredSlot() {
  const previous = meteredTail;
  let release!: () => void;
  meteredTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
}

async function executeGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const owner = scope();
  checkCancelled();
  const key = JSON.stringify([query, variables]);
  const context = analysisContext.getStore();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    if (context) context.cacheHits++;
    progress('api', 'Reused a cached Warcraft Logs response.', { quota });
    return JSON.parse(hit.json) as T;
  }
  const metered = Boolean(
    context && /\b(?:reportData|worldData)\b/.test(query),
  );
  const releaseMeter = metered ? await meteredSlot() : () => {};
  let release = () => {};
  let before: WclQuota | undefined;
  const estimate = estimatedCost(query);
  try {
    checkCancelled();
    // A different job may have completed this response while we waited.
    const ready = cache.get(key);
    if (ready && ready.expiresAt > Date.now()) {
      if (context) context.cacheHits++;
      progress('api', 'Reused a cached Warcraft Logs response.', { quota });
      return JSON.parse(ready.json) as T;
    }
    if (metered) {
      if (!quota || quota.resetAt <= Date.now()) await refreshQuotaStatus();
      if (!quota || quota.resetAt <= Date.now())
        throw budgetError(
          'Could not verify Warcraft Logs quota. No report requests were sent. Try Check quota before retrying.',
        );
      context!.budget ??= {
        pointLimit: Math.max(
          0,
          Math.min(
            MAX_ANALYSIS_POINTS,
            quota.limit * 0.2,
            (quota.limit * 0.9 - quota.spent) * 0.5,
          ),
        ),
        pointsSpent: 0,
        limited: false,
      };
      if (
        context!.budget.limited ||
        context!.requests >= MAX_ANALYSIS_REQUESTS ||
        context!.budget.pointsSpent + estimate > context!.budget.pointLimit
      )
        throw budgetError(
          'This review reached its API spending allowance. Returning the information already collected.',
        );
      if (quota.spent + estimate >= quota.limit * 0.9)
        throw budgetError(
          'Stopped before the next estimated request could reach the API safety reserve. Returning collected information.',
        );
      before = { ...quota };
    }
    release = await slot(context?.signal);
    checkCancelled();
    if (blockedUntil > Date.now()) throw quotaError();
    const value = await accessToken();
    checkCancelled();
    const monitoredQuery = query.includes('rateLimitData')
      ? query
      : query.replace(
          '{',
          '{ rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn } ',
        );
    if (context) context.requests++;
    const operation = query.match(/query\s+(\w+)/)?.[1] ?? 'data';
    progress('api', 'Requesting ' + operation + ' from Warcraft Logs.', {
      quota,
    });
    const { response, body } = await fetchJson(
      API_URL,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + value,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: monitoredQuery, variables }),
      },
      context?.signal,
    );
    const data = body?.data;
    const rate = data?.rateLimitData;
    const validRate = Boolean(
      rate &&
      Number.isFinite(rate.limitPerHour) &&
      rate.limitPerHour > 0 &&
      Number.isFinite(rate.pointsSpentThisHour) &&
      rate.pointsSpentThisHour >= 0 &&
      Number.isFinite(rate.pointsResetIn) &&
      rate.pointsResetIn >= 0,
    );
    if (owner === credentialScope && rate && validRate) {
      quota = {
        limit: rate.limitPerHour,
        spent: rate.pointsSpentThisHour,
        resetAt: Date.now() + rate.pointsResetIn * 1000,
        observedAt: Date.now(),
      };
      quotaUnavailable = false;
      if (quota.spent >= quota.limit * 0.9) blockedUntil = quota.resetAt;
      if (metered && context?.budget && before) {
        const spent =
          quota.spent < before.spent
            ? quota.spent
            : Math.max(0, quota.spent - before.spent);
        context.budget.pointsSpent += spent;
        const operation = query.match(/query\s+(\w+)/)?.[1] ?? query;
        operationCosts.set(
          operation,
          Math.max(operationCosts.get(operation) ?? 0, spent * 1.25 + 1),
        );
        if (context.budget.pointsSpent >= context.budget.pointLimit)
          context.budget.limited = true;
      }
      progress(
        'quota',
        'Usage reported with this response; no extra quota request.',
        { quota },
      );
    }
    if (
      metered &&
      context?.budget &&
      (!validRate || owner !== credentialScope)
    ) {
      context.budget.pointsSpent += estimate;
      context.budget.limited = true;
    }
    const message = Array.isArray(body?.errors)
      ? body.errors
          .map((entry: { message?: string }) => entry.message ?? '')
          .join('; ')
      : '';
    if (
      response.status === 429 ||
      /rate.?limit|quota|points.*(exceed|limit)/i.test(message)
    ) {
      const retryHeader = response.headers.get('retry-after');
      const seconds = retryHeader === null ? NaN : Number(retryHeader);
      const retry = Number.isFinite(seconds)
        ? Date.now() + seconds * 1000
        : retryHeader
          ? Date.parse(retryHeader)
          : NaN;
      if (owner === credentialScope)
        blockedUntil = Math.max(
          blockedUntil,
          quota && quota.resetAt > Date.now()
            ? quota.resetAt
            : Date.now() + 60_000,
          Number.isFinite(retry) ? retry : 0,
        );
      throw quotaError();
    }
    if (!response.ok) {
      if (response.status === 401 && owner === credentialScope) token = null;
      throw new AppError(
        'Warcraft Logs request failed with status ' + response.status + '.',
        502,
        response.status === 401 ? 'WCL_AUTH_FAILED' : 'WCL_REQUEST_FAILED',
      );
    }
    if (message) {
      if (/permission|private|unauthorized/i.test(message))
        throw new AppError(
          'This report is private or not available through the public API.',
          403,
          'WCL_REPORT_PRIVATE',
        );
      throw new AppError(
        'Warcraft Logs could not complete the query: ' + message,
        502,
        'WCL_GRAPHQL_ERROR',
      );
    }
    if (!data)
      throw new AppError(
        'Warcraft Logs returned no data.',
        502,
        'WCL_EMPTY_RESPONSE',
      );
    if (owner === credentialScope)
      remember(
        key,
        data,
        query === QUOTA_QUERY
          ? Math.max(
              0,
              Math.min(
                QUOTA_REFRESH_MS,
                (quota?.resetAt ?? Date.now()) - Date.now(),
              ),
            )
          : query.includes('characterRankings')
            ? TTL
            : 60 * 60_000,
      );
    return data as T;
  } finally {
    release();
    releaseMeter();
  }
}
