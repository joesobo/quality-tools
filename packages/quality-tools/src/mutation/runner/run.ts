import { execFileSync } from 'child_process';
import { type QualityTarget } from '../../shared/resolve/target';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { copySharedMutationReports } from '../reporting/reportArtifacts';
import { reportMutationSiteViolations } from '../reporting/check';
import { buildMutationArgs, buildMutationArgsForTest } from './args';
import { strykerBinPath } from './strykerBinary';
import { appendScopedVitestFiles, buildMutationEnv } from './vitestRuntime';

export function runMutation(target: QualityTarget): void {
  const { args, reportKey } = buildMutationArgs(target);
  appendScopedVitestFiles(args, target);
  execFileSync(process.execPath, [strykerBinPath(), ...args], {
    cwd: REPO_ROOT,
    env: buildMutationEnv(target),
    stdio: 'inherit'
  });
  const reportPath = copySharedMutationReports(reportKey, REPO_ROOT);
  reportMutationSiteViolations(reportPath);
}

export { buildMutationArgsForTest };
