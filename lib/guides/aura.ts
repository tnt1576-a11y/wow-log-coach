import type { AnalysisResult } from '../domain';

export type GuideAuraWindow = {
  start: number;
  end: number;
  pullId: number;
};

export function closedGuideAuraWindows(
  result: AnalysisResult,
  specName: string,
  auraId: number,
): GuideAuraWindow[] {
  const evidence = result.evidence;
  if (!evidence?.guide?.complete || evidence.guide.specName !== specName)
    return [];
  const events = evidence.guide.auras
    .filter((event) => event.id === auraId)
    .sort((a, b) => a.time - b.time);
  const raw: Array<{ start: number; end: number; closed: boolean }> = [];
  let start: number | null = null;
  for (const event of events) {
    if (event.type !== 'removebuff' && event.stacks === 0) {
      // Explicit depletion without a remove event is an ambiguous lifecycle.
      // Drop it rather than bridging into a later fresh application.
      start = null;
      continue;
    }
    if (event.type === 'applybuff') {
      // A new application cannot complete an older unterminated lifecycle.
      start = event.time;
      continue;
    }
    if (event.type === 'removebuff') {
      if (start !== null && event.time > start)
        raw.push({ start, end: event.time, closed: true });
      start = null;
    } else if (start === null) start = event.time;
  }
  if (start !== null)
    raw.push({ start, end: evidence.duration, closed: false });
  return raw.flatMap((window): GuideAuraWindow[] => {
    const pull = evidence.pulls.find(
      (item) => window.start >= item.start && window.start < item.end,
    );
    if (
      !pull ||
      !window.closed ||
      window.end >= pull.end - 0.5 ||
      evidence.deaths.some((death) => Math.abs(death.time - window.end) <= 1)
    )
      return [];
    return [{ start: window.start, end: window.end, pullId: pull.id }];
  });
}

export function auraStacksBefore(
  result: AnalysisResult,
  specName: string,
  auraId: number,
  time: number,
) {
  const events = (
    result.evidence?.guide?.specName === specName
      ? result.evidence.guide.auras
      : []
  )
    .filter((event) => event.id === auraId && event.time < time - 0.01)
    .sort((a, b) => a.time - b.time);
  let stacks = 0;
  for (const event of events) {
    if (event.type === 'removebuff') stacks = 0;
    else if (event.stacks !== null) stacks = event.stacks;
    else if (event.type === 'removebuffstack') stacks = Math.max(0, stacks - 1);
    else if (event.type === 'applybuff') stacks = Math.max(1, stacks);
  }
  return stacks;
}
