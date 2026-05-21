import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualityTarget } from '../../../src/shared/resolve/target';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';

const execFileSync = vi.fn();
const copySharedMutationReports = vi.fn(() => '/repo/reports/mutation.json');
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
const resolveScopedVitestIncludes = vi.fn<(target: QualityTarget) => string[] | undefined>(() => undefined);

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
  incrementalReportPath: vi.fn((reportKey: string) => `reports/mutation/${reportKey}/stryker-incremental-${reportKey}.json`)
}));

vi.mock('../../../src/mutation/reporting/check', () => ({
  reportMutationSiteViolations
}));

vi.mock('../../../src/config/quality', () => ({
  resolvePackageToolGlobs
}));

vi.mock('../../../src/mutation/analysis/mutateGlobs', () => ({
  buildMutateGlobs
}));

vi.mock('../../../src/mutation/analysis/profile', () => ({
  resolveMutationProfile
}));

vi.mock('../../../src/mutation/runner/include/vitest', () => ({
  resolveScopedVitestIncludes
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

function fileTarget(): QualityTarget {
  return {
    absolutePath: `${REPO_ROOT}/packages/quality-tools/src/mutation/runner/run.ts`,
    kind: 'file',
    packageName: 'quality-tools',
    packageRelativePath: 'src/mutation/runner/run.ts',
    packageRoot: `${REPO_ROOT}/packages/quality-tools`,
    relativePath: 'packages/quality-tools/src/mutation/runner/run.ts'
  };
}

describe('runMutation', () => {
  beforeEach(() => {
    delete process.env.QUALITY_TOOLS_VITEST_CONFIG;
    delete process.env.QUALITY_TOOLS_VITEST_DIR;
    execFileSync.mockClear();
    copySharedMutationReports.mockClear();
    reportMutationSiteViolations.mockClear();
    resolvePackageToolGlobs.mockClear();
    buildMutateGlobs.mockClear();
    resolveMutationProfile.mockClear();
    resolveScopedVitestIncludes.mockReset();
    resolveScopedVitestIncludes.mockReturnValue(undefined);
  });

  it('runs stryker and reports site violations for the copied report', async () => {
    const { runMutation } = await import('../../../src/mutation/runner/run');
    resolveScopedVitestIncludes.mockReturnValue([
      'packages/quality-tools/tests/**/*.test.ts',
      'packages/quality-tools/tests/**/*.test.tsx',
      'packages/quality-tools/tests/**/*.test.ts',
      'packages/quality-tools/tests/**/*.test.tsx',
    ]);

    runMutation(target());

    expect(resolvePackageToolGlobs).toHaveBeenCalledWith(REPO_ROOT, 'quality-tools', 'mutation');
    expect(buildMutateGlobs).toHaveBeenCalledWith(target(), {
      include: ['packages/quality-tools/src/**/*.ts'],
      exclude: ['packages/quality-tools/src/cli/**/*.ts']
    });
    expect(execFileSync).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        expect.stringContaining('@stryker-mutator/core'),
        'run',
        `${REPO_ROOT}/packages/quality-tools/stryker.config.cjs`,
        '--incrementalFile',
        'reports/mutation/quality-tools/stryker-incremental-quality-tools.json',
        '-m',
        'packages/quality-tools/src/**/*.ts,!packages/quality-tools/src/cli/**/*.ts',
        '--testFiles',
      ]),
      expect.objectContaining({
        cwd: REPO_ROOT,
        env: expect.objectContaining({
          ...process.env,
          QUALITY_TOOLS_VITEST_CONFIG: `${REPO_ROOT}/packages/quality-tools/vitest.config.ts`,
          QUALITY_TOOLS_VITEST_DIR: 'packages/quality-tools',
        }),
        stdio: 'inherit',
      }),
    );
    const strykerArgs = execFileSync.mock.calls[0][1] as string[];
    const testFiles = strykerArgs[strykerArgs.indexOf('--testFiles') + 1];

    expect(testFiles).toContain('packages/quality-tools/tests/mutation/runner/run.effects.test.ts');
    expect(testFiles).not.toContain('*');
    expect(copySharedMutationReports).toHaveBeenCalledWith('quality-tools', REPO_ROOT);
    expect(reportMutationSiteViolations).toHaveBeenCalledWith('/repo/reports/mutation.json');
  });

  it('preserves an explicit vitest config override', async () => {
    const { runMutation } = await import('../../../src/mutation/runner/run');
    process.env.QUALITY_TOOLS_VITEST_CONFIG = '/custom/vitest.config.ts';
    process.env.QUALITY_TOOLS_VITEST_DIR = 'custom-package';

    runMutation(target());

    const options = execFileSync.mock.calls[0][2] as { env: Record<string, string> };

    expect(options.env.QUALITY_TOOLS_VITEST_CONFIG).toBe('/custom/vitest.config.ts');
    expect(options.env.QUALITY_TOOLS_VITEST_DIR).toBe('custom-package');
  });

  it('passes scoped vitest includes for file targets', async () => {
    const { runMutation } = await import('../../../src/mutation/runner/run');
    resolveScopedVitestIncludes.mockReturnValue([
      'packages/quality-tools/tests/mutation/runner/run.test.ts',
      'packages/quality-tools/tests/mutation/runner/run.test.tsx',
    ]);

    runMutation(fileTarget());

    const options = execFileSync.mock.calls[0][2] as { env: Record<string, string> };
    const strykerArgs = execFileSync.mock.calls[0][1] as string[];
    const testFiles = strykerArgs[strykerArgs.indexOf('--testFiles') + 1];

    expect(options.env.QUALITY_TOOLS_VITEST_DIR).toBe('packages/quality-tools');
    expect(testFiles).toBe('packages/quality-tools/tests/mutation/runner/run.test.ts');
  });

  it('passes scoped vitest includes for directory targets', async () => {
    const { runMutation } = await import('../../../src/mutation/runner/run');
    resolveScopedVitestIncludes.mockReturnValue([
      'packages/quality-tools/tests/mutation/**/*.test.ts',
      'packages/quality-tools/tests/mutation/**/*.test.tsx',
    ]);

    runMutation({
      absolutePath: `${REPO_ROOT}/packages/quality-tools/src/mutation`,
      kind: 'directory',
      packageName: 'quality-tools',
      packageRelativePath: 'src/mutation',
      packageRoot: `${REPO_ROOT}/packages/quality-tools`,
      relativePath: 'packages/quality-tools/src/mutation',
    });

    const strykerArgs = execFileSync.mock.calls[0][1] as string[];
    const testFiles = strykerArgs[strykerArgs.indexOf('--testFiles') + 1];

    expect(testFiles).toContain('packages/quality-tools/tests/mutation/runner/run.effects.test.ts');
    expect(testFiles).not.toContain('*');

    expect(execFileSync).toHaveBeenCalledWith(
      process.execPath,
      expect.any(Array),
      expect.objectContaining({
        cwd: REPO_ROOT,
        env: expect.objectContaining({
          QUALITY_TOOLS_VITEST_DIR: 'packages/quality-tools',
        }),
        stdio: 'inherit',
      }),
    );
  });
});
