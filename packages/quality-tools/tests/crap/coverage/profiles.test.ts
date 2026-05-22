import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createCoverageProfiles } from '../../../src/crap/coverage/profiles';
import type { QualityTarget } from '../../../src/shared/resolve/target';

function createRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'quality-tools-crap-profiles-'));
  writeFileSync(join(repoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'modules/*'\n");
  mkdirSync(join(repoRoot, 'modules/parser'), { recursive: true });
  writeFileSync(join(repoRoot, 'modules/parser/package.json'), '{"name":"@scope/parser"}');
  return repoRoot;
}

function parserTarget(repoRoot: string): QualityTarget {
  return {
    absolutePath: join(repoRoot, 'modules/parser'),
    kind: 'package',
    packageName: 'parser',
    packageRelativePath: '.',
    packageRoot: join(repoRoot, 'modules/parser'),
    relativePath: 'modules/parser'
  };
}

describe('createCoverageProfiles', () => {
  it('does not assume host-specific package names for package targets', () => {
    const repoRoot = createRepo();

    expect(createCoverageProfiles(repoRoot, parserTarget(repoRoot))).toEqual([
      {
        args: [
          '--filter',
          '@scope/parser',
          'exec',
          'vitest',
          'run',
          '--coverage',
          '--coverage.reportsDirectory',
          join(repoRoot, 'reports/quality-tools/crap/parser')
        ],
        command: 'pnpm',
        coveragePath: join(repoRoot, 'reports/quality-tools/crap/parser/coverage-final.json'),
        cwd: repoRoot
      }
    ]);
  });

  it('uses configured repo-wide coverage profiles', () => {
    const repoRoot = createRepo();
    writeFileSync(join(repoRoot, 'quality.config.json'), JSON.stringify({
      defaults: {
        crap: {
          coverage: [
            {
              command: 'npm',
              args: ['run', 'coverage'],
              coveragePath: 'custom/coverage-final.json'
            }
          ]
        }
      }
    }));

    expect(createCoverageProfiles(repoRoot, {
      absolutePath: repoRoot,
      kind: 'repo',
      relativePath: '.'
    })).toEqual([
      {
        args: ['run', 'coverage'],
        command: 'npm',
        coveragePath: join(repoRoot, 'custom/coverage-final.json'),
        cwd: repoRoot
      }
    ]);
  });
});
