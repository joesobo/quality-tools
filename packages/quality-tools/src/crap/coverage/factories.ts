import { readFileSync } from 'fs';
import { join } from 'path';
import { type CoverageProfile } from './profiles';
import { listWorkspacePackages } from '../../shared/util/workspacePackages';

export function extensionCoverageProfile(repoRoot: string): CoverageProfile {
  return {
    ...workspacePackageCoverageProfile(repoRoot, 'extension'),
    coveragePath: join(repoRoot, 'coverage/coverage-final.json')
  };
}

export function qualityToolsCoverageProfile(repoRoot: string): CoverageProfile {
  return workspacePackageCoverageProfile(repoRoot, 'quality-tools');
}

function packageFilterName(repoRoot: string, packageName: string): string {
  const workspacePackage = listWorkspacePackages(repoRoot).find((entry) => entry.name === packageName);
  if (!workspacePackage) {
    return packageName;
  }

  const packageJson = JSON.parse(readFileSync(join(workspacePackage.root, 'package.json'), 'utf-8')) as {
    name?: string;
  };
  return packageJson.name ?? packageName;
}

export function workspacePackageCoverageProfile(
  repoRoot: string,
  packageName: string
): CoverageProfile {
  const filterName = packageFilterName(repoRoot, packageName);

  return {
    coveragePath: join(repoRoot, 'coverage', packageName, 'coverage-final.json'),
    cwd: repoRoot,
    env: {
      QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify([
        `packages/${packageName}/tests/**/*.test.ts`,
        `packages/${packageName}/tests/**/*.test.tsx`
      ]),
      QUALITY_TOOLS_VITEST_SCOPE: 'workspace'
    },
    args: ['--filter', filterName, 'exec', 'vitest', 'run', '--config', 'vitest.config.ts', '--coverage'],
    command: 'pnpm'
  };
}
