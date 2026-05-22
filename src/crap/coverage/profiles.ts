export interface CoverageProfile {
  coveragePath: string;
  cwd: string;
  env?: Record<string, string>;
  args: string[];
  command: string;
}

import { coverageProfilesForTarget } from './factories';
import { type QualityTarget } from '../../shared/resolve/target';

export function createCoverageProfiles(repoRoot: string, target: QualityTarget): CoverageProfile[] {
  return coverageProfilesForTarget(repoRoot, target);
}
