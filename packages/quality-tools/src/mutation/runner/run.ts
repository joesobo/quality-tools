import { execFileSync } from 'child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { globSync } from 'glob';
import { resolvePackageToolGlobs } from '../../config/quality';
import { type QualityTarget } from '../../shared/resolve/target';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { relativeTo, toPosix } from '../../shared/util/pathUtils';
import { buildMutateGlobs } from '../analysis/mutateGlobs';
import { copySharedMutationReports, incrementalReportPath } from '../reporting/reportArtifacts';
import { reportMutationSiteViolations } from '../reporting/check';
import { resolveMutationProfile } from '../analysis/profile';
import { sanitizeReportKey } from '../../shared/util/reportKey';
import { resolveScopedVitestIncludes } from './include/vitest';

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

function defaultVitestConfig(target: QualityTarget): string | undefined {
  if (process.env.QUALITY_TOOLS_VITEST_CONFIG || !target.packageRoot) {
    return undefined;
  }

  const packageConfig = join(target.packageRoot, 'vitest.config.ts');
  return existsSync(packageConfig) ? packageConfig : undefined;
}

function defaultVitestDir(target: QualityTarget): string | undefined {
  if (process.env.QUALITY_TOOLS_VITEST_DIR || !target.packageRoot) {
    return undefined;
  }

  return relativeTo(REPO_ROOT, target.packageRoot);
}

function expandExistingTestIncludes(includes: string[]): string[] {
  return [...new Set(
    includes.flatMap((include) => globSync(include, { cwd: REPO_ROOT, nodir: true }).map(toPosix))
  )];
}

export function runMutation(target: QualityTarget): void {
  const { args, reportKey } = buildArgs(target);
  const scopedVitestIncludes = resolveScopedVitestIncludes(target);
  const scopedVitestFiles = scopedVitestIncludes ? expandExistingTestIncludes(scopedVitestIncludes) : [];
  if (scopedVitestFiles.length > 0) {
    args.push('--testFiles', scopedVitestFiles.join(','));
  }
  const vitestConfig = defaultVitestConfig(target);
  const vitestDir = defaultVitestDir(target);
  const env = {
    ...process.env,
    QUALITY_TOOLS_VITEST_SCOPE: target.packageName === 'extension'
      ? 'extension'
      : process.env.QUALITY_TOOLS_VITEST_SCOPE ?? 'workspace',
    ...(vitestConfig
      ? {
          QUALITY_TOOLS_VITEST_CONFIG: vitestConfig,
        }
      : {}),
    ...(vitestDir
      ? {
          QUALITY_TOOLS_VITEST_DIR: vitestDir,
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
