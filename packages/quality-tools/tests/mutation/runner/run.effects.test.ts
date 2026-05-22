import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { QualityTarget } from '../../../src/shared/resolve/target';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';

const spawn = vi.fn((_command: string, _args: string[], _options: object) => {
  const child = new EventEmitter();
  setTimeout(() => child.emit('exit', 0), 0);
  return child;
});
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
      spawn,
    },
    spawn,
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
    spawn.mockClear();
    copySharedMutationReports.mockClear();
    reportMutationSiteViolations.mockClear();
    resolvePackageToolGlobs.mockClear();
    buildMutateGlobs.mockClear();
    resolveMutationProfile.mockClear();
  });

  it('runs Stryker with mutate globs and the shared report directory environment', async () => {
    const { runMutation } = await import('../../../src/mutation/runner/run');

    await runMutation(target());

    expect(resolvePackageToolGlobs).toHaveBeenCalledWith(REPO_ROOT, 'quality-tools', 'mutation');
    expect(buildMutateGlobs).toHaveBeenCalledWith(target(), {
      include: ['packages/quality-tools/src/**/*.ts'],
      exclude: ['packages/quality-tools/src/cli/**/*.ts']
    });
    expect(spawn).toHaveBeenCalledWith(
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
    const strykerArgs = (spawn.mock.calls[0]?.[1] ?? []) as unknown as string[];

    expect(strykerArgs).not.toContain('--testFiles');
    expect(copySharedMutationReports).toHaveBeenCalledWith('quality-tools', REPO_ROOT);
    expect(reportMutationSiteViolations).toHaveBeenCalledWith('/repo/reports/quality-tools/mutation.json');
  });

  it('uses explicit mutate globs and test includes when provided by a host wrapper', async () => {
    const { runMutation } = await import('../../../src/mutation/runner/run');

    await runMutation(target(), {
      mutateGlobs: ['packages/quality-tools/src/mutation/**/*.ts'],
      testIncludes: ['packages/quality-tools/tests/mutation/**/*.test.ts'],
    });

    expect(buildMutateGlobs).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        '-m',
        'packages/quality-tools/src/mutation/**/*.ts,!packages/quality-tools/src/cli/**/*.ts',
      ]),
      expect.objectContaining({
        env: expect.objectContaining({
          QUALITY_TOOLS_VITEST_INCLUDE_JSON: JSON.stringify([
            'packages/quality-tools/tests/mutation/**/*.test.ts',
          ]),
        }),
      }),
    );
  });

  it('rejects when Stryker exits unsuccessfully', async () => {
    spawn.mockImplementationOnce(() => {
      const child = new EventEmitter();
      setTimeout(() => child.emit('exit', 1), 0);
      return child;
    });
    const { runMutation } = await import('../../../src/mutation/runner/run');

    await expect(runMutation(target())).rejects.toThrow('Stryker exited with code 1.');
  });
});
