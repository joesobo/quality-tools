import { relativeReportsDir } from '../../config/quality';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import type { MutationRunOptions } from './args';

export function buildMutationEnv(options: MutationRunOptions = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    QUALITY_TOOLS_REPORTS_DIR: relativeReportsDir(REPO_ROOT),
    ...(options.testIncludes
      ? { QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify(options.testIncludes) }
      : {})
  };
}
