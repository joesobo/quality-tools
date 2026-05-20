import { execFileSync } from 'child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { resolvePackageToolGlobs } from '../../config/quality';
import { type QualityTarget } from '../../shared/resolve/target';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { buildMutateGlobs } from '../analysis/mutateGlobs';
import { copySharedMutationReports, incrementalReportPath } from '../reporting/reportArtifacts';
import { reportMutationSiteViolations } from '../reporting/check';
import { resolveMutationProfile } from '../analysis/profile';
import { sanitizeReportKey } from '../../shared/util/reportKey';
import { resolveScopedVitestIncludes } from './vitestIncludes';

const require = createRequire(import.meta.url);

function strykerBinPath(): string {
  return join(dirname(require.resolve('@stryker-mutator/core/package.json')), 'bin/stryker.js');
}

function buildArgs(target: QualityTarget): { args: string[]; reportKey: string } {
  const profile = resolveMutationProfile(target);
  const reportKey = target.kind === 'package'
    ? profile.packageName
    : sanitizeReportKey(target.relativePath);
  const args = ['run', profile.configPath, '--incrementalFile', incrementalReportPath(reportKey)];
  const configPatterns = resolvePackageToolGlobs(REPO_ROOT, profile.packageName, 'mutation');
  args.push('-m', buildMutateGlobs(target, configPatterns).join(','));

  return { args, reportKey };
}

export function runMutation(target: QualityTarget): void {
  const { args, reportKey } = buildArgs(target);
  const scopedVitestIncludes = resolveScopedVitestIncludes(target);
  const env = {
    ...process.env,
    QUALITY_TOOLS_VITEST_SCOPE: target.packageName === 'extension'
      ? 'extension'
      : process.env.QUALITY_TOOLS_VITEST_SCOPE ?? 'workspace',
    ...(scopedVitestIncludes
      ? {
          QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify(scopedVitestIncludes),
        }
      : {}),
  };
  execFileSync(process.execPath, [strykerBinPath(), ...args], { cwd: REPO_ROOT, env, stdio: 'inherit' });
  const reportPath = copySharedMutationReports(reportKey, REPO_ROOT);
  reportMutationSiteViolations(reportPath);
}

export function buildMutationArgsForTest(target: QualityTarget): string[] {
  return buildArgs(target).args;
}
