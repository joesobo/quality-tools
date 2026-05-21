import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  coverageProfilesForTarget,
  defaultCoverageProfile
} from '../../../src/crap/coverage/factories';
import type { QualityTarget } from '../../../src/shared/resolve/target';

function createRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-crap-profile-'));
  writeFileSync(join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
  mkdirSync(join(repoRoot, 'apps/web'), { recursive: true });
  writeFileSync(join(repoRoot, 'apps/web/package.json'), '{"name":"@scope/web"}');
  return repoRoot;
}

function packageTarget(repoRoot: string): QualityTarget {
  return {
    absolutePath: join(repoRoot, 'apps/web'),
    kind: 'package',
    packageName: 'web',
    packageRelativePath: '.',
    packageRoot: join(repoRoot, 'apps/web'),
    relativePath: 'apps/web'
  };
}

describe('coverageProfileFactories', () => {
  it('builds a generic package-local Vitest coverage profile', () => {
    const repoRoot = createRepo();

    expect(defaultCoverageProfile(repoRoot, packageTarget(repoRoot))).toEqual({
      args: ['--filter', '@scope/web', 'exec', 'vitest', 'run', '--coverage'],
      command: 'pnpm',
      coveragePath: join(repoRoot, 'apps/web/coverage/coverage-final.json'),
      cwd: repoRoot
    });
  });

  it('builds a generic repo-level Vitest coverage profile', () => {
    const repoRoot = createRepo();

    expect(defaultCoverageProfile(repoRoot, {
      absolutePath: repoRoot,
      kind: 'repo',
      relativePath: '.'
    })).toEqual({
      args: ['exec', 'vitest', 'run', '--coverage'],
      command: 'pnpm',
      coveragePath: join(repoRoot, 'coverage/coverage-final.json'),
      cwd: repoRoot
    });
  });

  it('uses configured coverage command templates when present', () => {
    const repoRoot = createRepo();
    writeFileSync(join(repoRoot, 'quality.config.json'), JSON.stringify({
      reportsDir: 'artifacts/quality',
      packages: {
        web: {
          crap: {
            coverage: {
              args: ['--filter', '{packageJsonName}', 'run', 'coverage', '--', '{targetPath}'],
              command: 'pnpm',
              coveragePath: '{reportsDir}/coverage/{packageName}/coverage-final.json',
              cwd: '{repoRoot}',
              env: {
                COVERAGE_TARGET: '{target}'
              }
            }
          }
        }
      }
    }));

    expect(coverageProfilesForTarget(repoRoot, packageTarget(repoRoot))).toEqual([
      {
        args: ['--filter', '@scope/web', 'run', 'coverage', '--', 'apps/web'],
        command: 'pnpm',
        coveragePath: join(repoRoot, 'artifacts/quality/coverage/web/coverage-final.json'),
        cwd: repoRoot,
        env: {
          COVERAGE_TARGET: 'apps/web'
        }
      }
    ]);
  });
});
