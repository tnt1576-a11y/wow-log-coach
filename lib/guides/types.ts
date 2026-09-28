import type { AnalysisResult, CastEvent } from '../domain';

export type GuideProcWindow = {
  start: number;
  end: number;
  pullId: number;
  consumer: CastEvent | null;
};

export type GuideMoment = {
  time: number;
  spellId: number;
  detail: string;
};

export type GuideCheck = {
  id: string;
  title: string;
  status: 'review' | 'observed' | 'unavailable' | 'not-applicable';
  detail: string;
  eligible: number;
  moments: GuideMoment[];
  procWindows?: GuideProcWindow[];
  /** All eligible choices, including unflagged reference examples. */
  decisions?: GuideMoment[];
};

export type GuideLesson = {
  id: string;
  title: string;
  short: string;
  why: string;
  tryNext: string;
  verify: string;
  spellId: number;
  sequence?: number[];
  spellLabels?: Record<number, string>;
  check: GuideCheck;
};

export type GuideSummary = {
  label: string;
  value: string;
  note: string;
};

export type GuidedSpecReview = {
  checks: GuideCheck[];
  lessons: GuideLesson[];
  seasonMatches: boolean;
  castCoverage: boolean;
  stateCoverage: boolean;
  summaries: GuideSummary[];
};

export type GuidedSpecPack = {
  className: string;
  specName: string;
  slug: string;
  source: {
    url: string;
    author: string;
    patch: string;
    updated: string;
    reviewed: string;
  };
  limitation: string;
  notes: string[];
  review: (result: AnalysisResult) => GuidedSpecReview;
};
