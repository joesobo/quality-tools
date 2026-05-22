import { describe, expect, it } from 'vitest';
import {
  loadQualityConfig,
  relativeReportPath,
  relativeReportsDir,
  resolveMutationStrykerConfig,
  resolvePackageCrapCoverage
} from '../../src/config/quality';
import {
  createQualityConfigMissingRepo,
  createQualityConfigRepo,
  DEFAULT_QUALITY_CONFIG
} from './qualityRepo';

describe('loadQualityConfig', () => {
  it('returns an empty config when the file is missing', () => {
    expect(loadQualityConfig(createQualityConfigMissingRepo())).toEqual({});
  });

  it('loads the repo quality config', () => {
    expect(loadQualityConfig(createQualityConfigRepo(DEFAULT_QUALITY_CONFIG))).toMatchObject({
      defaults: {
        mutation: {
          include: ['src/**/*.ts']
        }
      }
    });
  });

  it('resolves the shared reports directory from config', () => {
    const repoRoot = createQualityConfigRepo(DEFAULT_QUALITY_CONFIG);

    expect(relativeReportsDir(repoRoot)).toBe('artifacts/quality');
    expect(relativeReportPath(repoRoot, 'mutation', 'mutation.json')).toBe(
      'artifacts/quality/mutation/mutation.json'
    );
  });

  it('resolves package-specific CRAP coverage and mutation config', () => {
    const repoRoot = createQualityConfigRepo(DEFAULT_QUALITY_CONFIG);

    expect(resolvePackageCrapCoverage(repoRoot, 'example')).toEqual([
      {
        args: ['--filter', '{packageJsonName}', 'exec', 'vitest', 'run', '--coverage'],
        command: 'pnpm',
        coveragePath: '{reportsDir}/coverage/{packageName}/coverage-final.json'
      }
    ]);
    expect(resolveMutationStrykerConfig(repoRoot, 'example')).toBe(`${repoRoot}/config/stryker.example.cjs`);
    expect(resolveMutationStrykerConfig(repoRoot, 'missing')).toBe(`${repoRoot}/config/stryker.base.cjs`);
  });
});
