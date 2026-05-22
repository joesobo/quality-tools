import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import { resolveMutationProfile } from '../../../src/mutation/analysis/profile';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import { resolveQualityTarget } from '../../../src/shared/resolve/target';

const require = createRequire(import.meta.url);
const rootStrykerConfig = require(`${REPO_ROOT}/stryker.config.cjs`) as {
  dryRunTimeoutMinutes?: number;
  plugins?: string[];
  reporters?: string[];
  testRunner?: string;
};

describe('mutation profiles', () => {
  afterEach(() => {
    delete process.env.QUALITY_TOOLS_VITEST_CONFIG;
    delete process.env.QUALITY_TOOLS_VITEST_DIR;
    vi.resetModules();
  });

  it('uses the package-owned Stryker config for workspace packages', () => {
    expect(resolveMutationProfile(resolveQualityTarget(REPO_ROOT, 'quality-tools/'))).toMatchObject({
      configPath: `${REPO_ROOT}/stryker.config.cjs`,
      packageName: 'quality-tools'
    });
  });

  it('raises the shared dry-run timeout above the stryker default', () => {
    expect(rootStrykerConfig).toMatchObject({
      dryRunTimeoutMinutes: expect.any(Number),
    });
    expect(rootStrykerConfig.dryRunTimeoutMinutes).toBeGreaterThanOrEqual(30);
  });

  it('routes shared mutation through the repo-local vitest runner', () => {
    expect(rootStrykerConfig.testRunner).toBe('quality-tools-vitest');
    expect(rootStrykerConfig.plugins?.join(' ')).toContain('quality-tools-vitest-runner.mjs');
  });

  it('enables append-only mutation progress in CI logs', () => {
    expect(rootStrykerConfig.reporters).toContain('progress');
  });

  it('uses the shared Stryker config for repo or non-package targets', () => {
    expect(resolveMutationProfile({
      absolutePath: `${REPO_ROOT}/docs`,
      kind: 'directory',
      relativePath: 'docs'
    })).toMatchObject({
      configPath: `${REPO_ROOT}/stryker.config.cjs`
    });
  });
});
