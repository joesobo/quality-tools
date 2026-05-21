import { describe, expect, it } from 'vitest';
import {
  pathIncludedByDefaultTool,
  resolvePackageBoundaryConfig,
  resolveDefaultToolPatterns,
  resolvePackageToolGlobs,
  resolvePackageToolPatterns
} from '../../src/config/quality';
import {
  createQualityConfigRepo,
  DEFAULT_QUALITY_CONFIG,
  OVERRIDE_ONLY_QUALITY_CONFIG
} from './qualityRepo';

describe('resolvePackageToolPatterns', () => {
  it('merges default and package-specific tool patterns', () => {
    expect(
      resolvePackageToolPatterns(createQualityConfigRepo(DEFAULT_QUALITY_CONFIG), 'example', 'mutation')
    ).toEqual({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', '**/index.ts', 'src/ignored.ts']
    });
  });

  it('handles package overrides when no defaults are configured', () => {
    expect(
      resolvePackageToolPatterns(
        createQualityConfigRepo(OVERRIDE_ONLY_QUALITY_CONFIG, 'quality-tools-config-override-'),
        'example',
        'mutation'
      )
    ).toEqual({
      include: [],
      exclude: ['src/ignored.ts']
    });
  });
});

describe('resolveDefaultToolPatterns', () => {
  it('returns default patterns without requiring package metadata', () => {
    expect(resolveDefaultToolPatterns(createQualityConfigRepo(DEFAULT_QUALITY_CONFIG), 'crap')).toEqual({
      include: [],
      exclude: ['**/*.test.ts', 'src/generated/**']
    });
  });
});

describe('pathIncludedByDefaultTool', () => {
  it('applies default patterns to repo-relative paths', () => {
    const repoRoot = createQualityConfigRepo(DEFAULT_QUALITY_CONFIG);

    expect(pathIncludedByDefaultTool(repoRoot, 'crap', 'tools/report.ts')).toBe(true);
    expect(pathIncludedByDefaultTool(repoRoot, 'crap', 'tools/report.test.ts')).toBe(false);
  });
});

describe('resolvePackageToolGlobs', () => {
  it('expands package-relative patterns into repo-relative globs', () => {
    expect(resolvePackageToolGlobs(createQualityConfigRepo(DEFAULT_QUALITY_CONFIG), 'example', 'mutation')).toEqual({
      include: ['example/src/**/*.ts'],
      exclude: [
        'example/src/**/*.d.ts',
        'example/**/index.ts',
        'example/src/ignored.ts'
      ]
    });
  });
});

describe('resolvePackageBoundaryConfig', () => {
  it('returns empty defaults when the config has no defaults or package override', () => {
    expect(
      resolvePackageBoundaryConfig(
        createQualityConfigRepo({ packages: {} }, 'quality-tools-boundary-empty-'),
        'missing'
      )
    ).toEqual({
      entrypoints: [],
      exclude: [],
      include: [],
      layers: []
    });
  });
});
