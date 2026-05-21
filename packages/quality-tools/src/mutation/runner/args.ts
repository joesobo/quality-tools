import { resolvePackageToolGlobs } from '../../config/quality';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { type QualityTarget } from '../../shared/resolve/target';
import { sanitizeReportKey } from '../../shared/util/reportKey';
import { buildMutateGlobs } from '../analysis/mutateGlobs';
import { resolveMutationProfile } from '../analysis/profile';
import { incrementalReportPath } from '../reporting/reportArtifacts';

export function buildMutationArgs(target: QualityTarget): { args: string[]; reportKey: string } {
  const profile = resolveMutationProfile(target);
  const reportKey = target.kind === 'package'
    ? profile.packageName
    : sanitizeReportKey(target.relativePath);
  const args = ['run', profile.configPath, '--incrementalFile', incrementalReportPath(reportKey)];
  const configPatterns = resolvePackageToolGlobs(REPO_ROOT, profile.packageName, 'mutation');
  args.push('-m', buildMutateGlobs(target, configPatterns).join(','));

  return { args, reportKey };
}

export function buildMutationArgsForTest(target: QualityTarget): string[] {
  return buildMutationArgs(target).args;
}
