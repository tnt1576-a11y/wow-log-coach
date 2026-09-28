'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisProgress } from '@/lib/analysis-context';
import './api-quota.css';

type Quota = NonNullable<AnalysisProgress['quota']> & { observedAt?: number };
interface ApiStatus {
  configured: boolean | null;
  quota?: Quota;
  retryAt?: number;
  quotaUnavailable?: boolean;
}

export function useWarcraftLogsStatus() {
  const [status, setStatus] = useState<ApiStatus>({ configured: null });
  const active = useRef<AbortController | null>(null);
  const lastRequest = useRef(0);
  const refresh = useCallback(async (live = false) => {
    if (document.visibilityState === 'hidden' || active.current) return;
    if (Date.now() - lastRequest.current < 1500) return;
    const controller = new AbortController();
    active.current = controller;
    lastRequest.current = Date.now();
    try {
      const response = await fetch('/api/status' + (live ? '?refresh=1' : ''), {
        cache: 'no-store',
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      });
      if (!response.ok) throw new Error('Status unavailable');
      const next = (await response.json()) as ApiStatus;
      if (controller.signal.aborted) return;
      setStatus((current) => {
        const quota =
          next.configured === false
            ? undefined
            : (next.quota?.observedAt ?? 0) >= (current.quota?.observedAt ?? 0)
              ? (next.quota ?? current.quota)
              : current.quota;
        return { ...next, quota, configured: Boolean(next.configured) };
      });
    } catch {
      if (!controller.signal.aborted)
        setStatus((current) => ({ ...current, quotaUnavailable: true }));
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);
  const recordProgress = useCallback((update: AnalysisProgress) => {
    if (!update.quota) return;
    const quota = {
      ...update.quota,
      observedAt: (update.quota as Quota).observedAt ?? update.at,
    };
    setStatus((current) => {
      if ((current.quota?.observedAt ?? 0) > quota.observedAt) return current;
      return {
        ...current,
        quota,
        configured: true,
        quotaUnavailable: false,
        retryAt:
          quota.spent >= quota.limit * 0.9 ? quota.resetAt : current.retryAt,
      };
    });
  }, []);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted) void refresh();
    });
    // Status reads only the local cache; idle tabs make no WCL requests.
    const resume = () => void refresh();
    window.addEventListener('focus', resume);
    window.addEventListener('wcl-quota-changed', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      mounted = false;
      active.current?.abort();
      active.current = null;
      lastRequest.current = 0;
      window.removeEventListener('focus', resume);
      window.removeEventListener('wcl-quota-changed', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [refresh]);
  const resetAt = Math.max(status.quota?.resetAt ?? 0, status.retryAt ?? 0);
  useEffect(() => {
    if (!resetAt || resetAt <= Date.now()) return;
    const timer = setTimeout(
      () => void refresh(),
      Math.min(2147483647, resetAt - Date.now() + 300),
    );
    return () => clearTimeout(timer);
  }, [resetAt, refresh]);
  return { status, refresh, recordProgress };
}

export function remainingPoints(
  quota: Quota | undefined,
  now: number,
): number | null {
  if (
    !quota ||
    !Number.isFinite(quota.limit) ||
    quota.limit <= 0 ||
    !Number.isFinite(quota.spent) ||
    quota.spent < 0 ||
    !Number.isFinite(quota.resetAt) ||
    quota.resetAt <= now
  )
    return null;
  return Math.floor(Math.max(0, quota.limit - quota.spent));
}

export function resetCountdown(resetAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((resetAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60)
    return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
  return minutes + 'm ' + String(seconds % 60).padStart(2, '0') + 's';
}

export function ApiQuota({
  status,
  onRefresh,
}: {
  status: ApiStatus;
  onRefresh?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = now ? remainingPoints(status.quota, now) : null;
  const reserveReached =
    remaining !== null && status.quota!.spent >= status.quota!.limit * 0.9;
  const paused =
    reserveReached || Boolean(status.retryAt && status.retryAt > now);
  const knownReset = Boolean(status.quota && status.quota.resetAt > now);
  const resetAt = knownReset ? status.quota!.resetAt : (status.retryAt ?? 0);
  const stale =
    status.quotaUnavailable ||
    Boolean(status.quota?.observedAt && now - status.quota.observedAt > 90000);
  const low = remaining !== null && remaining <= status.quota!.limit * 0.15;
  const unavailable =
    status.configured === false
      ? 'Not configured'
      : status.quotaUnavailable
        ? 'Quota unavailable'
        : status.quota
          ? 'Waiting for updated quota'
          : 'Not checked yet';
  return (
    <div
      className="api-quota"
      aria-label="Warcraft Logs API quota"
      data-low={low || paused}
    >
      <div className="api-quota-inner">
        <span className="api-quota-label">Warcraft Logs API</span>
        <span className="api-quota-budget">
          {remaining === null ? (
            unavailable
          ) : (
            <>
              <strong>{remaining.toLocaleString()}</strong> /{' '}
              {Math.floor(status.quota!.limit).toLocaleString()} points left
            </>
          )}
        </span>
        {now > 0 && resetAt > now && (
          <span className="api-quota-reset">
            {knownReset ? 'Resets in' : 'Retry in'}{' '}
            <strong>{resetCountdown(resetAt, now)}</strong>
            <span className="api-quota-clock">
              {' '}
              ·{' '}
              {new Date(resetAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </span>
          </span>
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="api-quota-refresh"
            title="Requests current Warcraft Logs quota; uses an API point. Repeated checks within a minute reuse cached data."
          >
            Check quota
          </button>
        )}
        {paused && (
          <span className="api-quota-note">
            New calls paused
            {reserveReached && remaining! > 0 ? ' · 10% safety reserve' : ''}
          </span>
        )}
        {remaining !== null && stale && (
          <span className="api-quota-note">
            Last known{status.quotaUnavailable ? ' · refresh unavailable' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
