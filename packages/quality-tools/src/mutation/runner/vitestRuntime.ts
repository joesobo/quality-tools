import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'glob';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { type QualityTarget } from '../../shared/resolve/target';
import { relativeTo, toPosix } from '../../shared/util/pathUtils';
import { resolveScopedVitestIncludes } from './include/vitest';

type GlobSync = (pattern: string, options: { cwd: string; nodir: true }) => string[];

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

export function expandExistingTestIncludes(includes: string[], glob: GlobSync = globSync as GlobSync): string[] {
  return [...new Set(
    includes.flatMap((include) => glob(include, { cwd: REPO_ROOT, nodir: true }).map(toPosix))
  )];
}

export function appendScopedVitestFiles(args: string[], target: QualityTarget): void {
  const scopedVitestIncludes = resolveScopedVitestIncludes(target);
  const scopedVitestFiles = scopedVitestIncludes ? expandExistingTestIncludes(scopedVitestIncludes) : [];
  if (scopedVitestFiles.length === 0) {
    return;
  }

  args.push('--testFiles', scopedVitestFiles.join(','));
}

export function buildMutationEnv(target: QualityTarget): NodeJS.ProcessEnv {
  const vitestConfig = defaultVitestConfig(target);
  const vitestDir = defaultVitestDir(target);

  return {
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
}
