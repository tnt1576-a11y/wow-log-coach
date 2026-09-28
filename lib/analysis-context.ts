import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from './domain';

export interface AnalysisBudget {
  pointLimit: number;
  pointsSpent: number;
  limited: boolean;
}
export interface AnalysisProgress {
  budget?: AnalysisBudget;
  stage: string;
  message: string;
  checked?: number;
  selected?: number;
  rejectionCounts?: Record<string, number>;
  pages?: number;
  candidates?: number;
  requests?: number;
  cacheHits?: number;
  quota?: {
    limit: number;
    spent: number;
    resetAt: number;
    observedAt?: number;
  };
  at: number;
}
export const analysisContext = new AsyncLocalStorage<{
  budget?: AnalysisBudget;
  signal: AbortSignal;
  publish: (update: AnalysisProgress) => void;
  requests: number;
  cacheHits: number;
}>();
export function checkCancelled() {
  if (analysisContext.getStore()?.signal.aborted)
    throw new AppError(
      'Comparison stopped. Completed API responses can be reused on retry.',
      499,
      'ANALYSIS_CANCELLED',
    );
}
export function progress(
  stage: string,
  message: string,
  details: Partial<AnalysisProgress> = {},
) {
  const context = analysisContext.getStore();
  context?.publish({
    stage,
    message,
    at: Date.now(),
    requests: context.requests,
    cacheHits: context.cacheHits,
    budget: context.budget ? { ...context.budget } : undefined,
    ...details,
  });
}
export function rethrowFatal(error: unknown) {
  checkCancelled();
  if (
    error instanceof AppError &&
    [
      'WCL_RATE_LIMITED',
      'WCL_QUOTA_GUARD',
      'WCL_AUTH_FAILED',
      'WCL_AUTH_INVALID',
      'WCL_NOT_CONFIGURED',
      'WCL_TIMEOUT',
      'WCL_REQUEST_FAILED',
      'ANALYSIS_CANCELLED',
    ].includes(error.code)
  )
    throw error;
}

export function isQuotaStop(error: unknown): error is AppError {
  return (
    error instanceof AppError &&
    ['WCL_RATE_LIMITED', 'WCL_QUOTA_GUARD'].includes(error.code)
  );
}
