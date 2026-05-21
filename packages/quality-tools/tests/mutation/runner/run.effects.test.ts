import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualityTarget } from '../../../src/shared/resolve/target';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';

const execFileSync = vi.fn();
const copySharedMutationReports = vi.fn(() => '/repo/reports/quality-tools/mutation.json');
const reportMutationSiteViolations = vi.fn();
const resolvePackageToolGlobs = vi.fn(() => ({
  include: ['packages/quality-tools/src/**/*.ts'],
  exclude: ['packages/quality-tools/src/cli/**/*.ts']
}));
const buildMutateGlobs = vi.fn(() => [
  'packages/quality-tools/src/**/*.ts',
  '!packages/quality-tools/src/cli/**/*.ts'
]);
const resolveMutationProfile = vi.fn(() => ({
  configPath: `${REPO_ROOT}/packages/quality-tools/stryker.config.cjs`,
  packageName: 'quality-tools'
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    default: {
      ...actual,
      execFileSync,
    },
    execFileSync,
  };
});

vi.mock('../../../src/mutation/reporting/reportArtifacts', () => ({
  copySharedMutationReports,
  incrementalReportPath: vi.fn((reportKey: string) => (
    `reports/quality-tools/mutation/${reportKey}/stryker-incremental-${reportKey}.json`
  ))
}));

vi.mock('../../../src/mutation/reporting/check', () => ({
  reportMutationSiteViolations
}));

vi.mock('../../../src/config/quality', () => ({
  relativeReportsDir: vi.fn(() => 'reports/quality-tools'),
  resolvePackageToolGlobs
}));

vi.mock('../../../src/mutation/analysis/mutateGlobs', () => ({
  buildMutateGlobs
}));

vi.mock('../../../src/mutation/analysis/profile', () => ({
  resolveMutationProfile
}));

function target(): QualityTarget {
  return {
    absolutePath: `${REPO_ROOT}/packages/quality-tools`,
    kind: 'package',
    packageName: 'quality-tools',
    packageRelativePath: '.',
    packageRoot: `${REPO_ROOT}/packages/quality-tools`,
    relativePath: 'packages/quality-tools'
  };
}

describe('runMutation', () => {
  beforeEach(() => {
    execFileSync.mockClear();
    copySharedMutationReports.mockClear();
    reportMutationSiteViolations.mockClear();
    resolvePackageToolGlobs.mockClear();
    buildMutateGlobs.mockClear();
    resolveMutationProfile.mockClear();
  });

  it('runs Stryker with mutate globs and the shared report directory environment', async () => {
    const { runMutation } = await import('../../../src/mutation/runner/run');

    runMutation(target());

    expect(resolvePackageToolGlobs).toHaveBeenCalledWith(REPO_ROOT, 'quality-tools', 'mutation');
    expect(buildMutateGlobs).toHaveBeenCalledWith(target(), {
      include: ['packages/quality-tools/src/**/*.ts'],
      exclude: ['packages/quality-tools/src/cli/**/*.ts']
    });
    expect(execFileSync).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        expect.stringMatching(/@stryker-mutator\/core.*bin\/stryker\.js$/),
        'run',
        `${REPO_ROOT}/packages/quality-tools/stryker.config.cjs`,
        '--incrementalFile',
        'reports/quality-tools/mutation/quality-tools/stryker-incremental-quality-tools.json',
        '-m',
        'packages/quality-tools/src/**/*.ts,!packages/quality-tools/src/cli/**/*.ts'
      ]),
      expect.objectContaining({
        cwd: REPO_ROOT,
        env: expect.objectContaining({
          QUALITY_TOOLS_REPORTS_DIR: 'reports/quality-tools'
        }),
        stdio: 'inherit',
      }),
    );
    const strykerArgs = execFileSync.mock.calls[0][1] as string[];

    expect(strykerArgs).not.toContain('--testFiles');
    expect(copySharedMutationReports).toHaveBeenCalledWith('quality-tools', REPO_ROOT);
    expect(reportMutationSiteViolations).toHaveBeenCalledWith('/repo/reports/quality-tools/mutation.json');
  });
});
