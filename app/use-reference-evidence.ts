'use client';
import { useEffect, useState } from 'react';
import type { AnalysisResult, ReferenceRun, RunEvidence } from '@/lib/domain';
import { referenceKey } from '@/lib/reference-selection';

export function useReferenceEvidence(
  result: AnalysisResult,
  reference?: ReferenceRun,
) {
  const key = [
    result.target.reportCode,
    result.target.fightId,
    result.target.sourceId,
    result.cohort.affixesMatched,
    result.cohort.durationTolerancePercent,
    reference ? referenceKey(reference) : '',
  ].join(':');
  const [loaded, setLoaded] = useState<{
    key: string;
    evidence: RunEvidence;
  }>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!reference?.sourceId || result.target.reportCode === 'example') return;
    const controller = new AbortController();
    fetch('/api/reference-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: {
          reportCode: result.target.reportCode,
          fightId: result.target.fightId,
          sourceId: result.target.sourceId,
        },
        reference: {
          reportCode: reference.reportCode,
          fightId: reference.fightId,
          sourceId: reference.sourceId,
        },
        matchAffixes: result.cohort.affixesMatched,
        raidDurationTolerancePercent: result.cohort.durationTolerancePercent,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as RunEvidence & {
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(
            body.error?.message ?? 'Reference events unavailable',
          );
        return body;
      })
      .then((evidence) => {
        if (!controller.signal.aborted) setLoaded({ key, evidence });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure({
            key,
            message:
              error instanceof Error
                ? error.message
                : 'Reference events unavailable',
          });
      })
      .finally(() => {
        if (!controller.signal.aborted)
          window.dispatchEvent(new Event('wcl-quota-changed'));
      });
    return () => controller.abort();
  }, [result, reference, key, attempt]);
  return {
    evidence: loaded?.key === key ? loaded.evidence : undefined,
    error: failure?.key === key ? failure.message : '',
    retry: () => {
      setFailure(undefined);
      setAttempt((value) => value + 1);
    },
    unavailable:
      result.target.reportCode === 'example'
        ? 'Live reference events are disabled in the example report.'
        : !reference?.sourceId
          ? 'Re-analyze to identify this reference player.'
          : '',
  };
}
