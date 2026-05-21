import { relativeReportsDir } from '../../config/quality';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';

export function buildMutationEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    QUALITY_TOOLS_REPORTS_DIR: relativeReportsDir(REPO_ROOT)
  };
}
