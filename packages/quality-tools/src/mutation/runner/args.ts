import { resolveDefaultToolPatterns, resolvePackageToolGlobs } from '../../config/quality';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { type QualityTarget } from '../../shared/resolve/target';
import { sanitizeReportKey } from '../../shared/util/reportKey';
import { buildMutateGlobs } from '../analysis/mutateGlobs';
import { resolveMutationProfile } from '../analysis/profile';
import { incrementalReportPath } from '../reporting/reportArtifacts';

export interface MutationRunOptions {
  force?: boolean;
}

export function buildMutationArgs(
  target: QualityTarget,
  options: MutationRunOptions = {}
): { args: string[]; reportKey: string } {
  const profile = resolveMutationProfile(target);
  const reportKey = target.kind === 'repo'
    ? 'repo'
    : target.kind === 'package' && profile.packageName
    ? profile.packageName
    : sanitizeReportKey(target.relativePath);
  const args = ['run', profile.configPath, '--incrementalFile', incrementalReportPath(reportKey)];
  if (options.force) {
    args.push('--force');
  }
  const configPatterns = profile.packageName
    ? resolvePackageToolGlobs(REPO_ROOT, profile.packageName, 'mutation')
    : resolveDefaultToolPatterns(REPO_ROOT, 'mutation');
  args.push('-m', buildMutateGlobs(target, configPatterns).join(','));

  return { args, reportKey };
}

export function buildMutationArgsForTest(
  target: QualityTarget,
  options: MutationRunOptions = {}
): string[] {
  return buildMutationArgs(target, options).args;
}
