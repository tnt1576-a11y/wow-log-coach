import type { AnalysisResult } from '../domain';
import { demonologyGuidePack } from '../demonology/guide';
import { furyGuidePack } from '../fury/guide';
import { shadowGuidePack } from '../shadow/guide';
import { survivalGuidePack } from '../survival/guide';
import { windwalkerGuidePack } from '../windwalker/guide';
import type { GuidedSpecPack } from './types';
import { PROC_GUIDES } from './proc-definitions';

/** Curated cross-class packs that use the shared evidence workspace. */
export const GUIDED_SPEC_PACKS: GuidedSpecPack[] = [
  ...PROC_GUIDES.map((guide) => guide.pack),
  demonologyGuidePack,
  furyGuidePack,
  shadowGuidePack,
  survivalGuidePack,
  windwalkerGuidePack,
];

export function guidePackFor(result: AnalysisResult) {
  return (
    GUIDED_SPEC_PACKS.find(
      (pack) =>
        pack.className === result.target.className &&
        pack.specName === result.target.specName,
    ) ?? null
  );
}
