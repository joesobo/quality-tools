import { vi } from 'vitest';
import type { CrapResult } from '../../../src/crap/analysis/run';
import type { CoverageProfile } from '../../../src/crap/coverage/profiles';
import type { IstanbulFileCoverage } from '../../../src/crap/coverage/read';
import { type CrapCliDependencies } from '../../../src/crap/command';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import type { QualityTarget } from '../../../src/shared/resolve/target';

export function packageTarget(): QualityTarget {
  return {
    absolutePath: `${REPO_ROOT}`,
    kind: 'package',
    packageName: 'quality-tools',
    packageRelativePath: '.',
    packageRoot: `${REPO_ROOT}`,
    relativePath: '.'
  };
}

export function coverageProfile(overrides: Partial<CoverageProfile> = {}): CoverageProfile {
  return {
    args: ['vitest'],
    command: 'pnpm',
    coveragePath: '/coverage/a.json',
    cwd: REPO_ROOT,
    ...overrides
  };
}

export function createDependencies(options: {
  profiles?: CoverageProfile[];
  results?: CrapResult[];
  target?: QualityTarget;
} = {}): CrapCliDependencies {
  const {
    profiles = [],
    results = [],
    target = packageTarget()
  } = options;
  const coverageEntry = (coveragePath: string): Record<string, IstanbulFileCoverage> => ({
    [coveragePath]: {
      path: coveragePath,
      s: {},
      statementMap: {}
    }
  });

  return {
    analyzeCrap: vi.fn(() => results),
    createCoverageProfiles: vi.fn(() => profiles),
    readCoverageReport: vi.fn(coverageEntry),
    reportCrap: vi.fn(),
    resolveQualityTarget: vi.fn(() => target),
    runCommand: vi.fn()
  };
}

export function firstMockCall(fn: unknown): unknown[] | undefined {
  return (fn as ReturnType<typeof vi.fn>).mock.calls[0];
}
