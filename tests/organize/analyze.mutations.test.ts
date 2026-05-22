import { afterEach, describe, expect, it } from 'vitest';
import { analyze } from '../../src/organize/analyze/run';
import { cleanupTempDirs, createFileTree, createTarget } from './testHelpers';

const tempDirs: string[] = [];

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

function analyzeTree(tree: Record<string, string | null>) {
  const root = createFileTree(tree, tempDirs);
  return analyze(createTarget(root));
}

function metricFor(tree: Record<string, string | null>, directoryPath: string) {
  return analyzeTree(tree).find((metric) => metric.directoryPath === directoryPath);
}

describe('analyze mutation coverage', () => {
  it.each([
    [{ 'file.ts': 'export const x = 1;' }, '.'],
    [{ 'src/file.ts': 'export const x = 1;' }, 'src'],
    [{ 'src/core/utils/file.ts': 'export const x = 1;' }, 'src/core/utils'],
    [{ 'a/b/c/file.ts': 'export const x = 1;' }, 'a/b/c']
  ] as const)('emits a metric for %s', (tree, directoryPath) => {
    expect(metricFor(tree, directoryPath)).toBeDefined();
  });

  it.each([
    [{ 'empty/': null }, 'empty', 0],
    [{ 'src/srcFile.ts': 'export const x = 1;' }, 'src', 0.5],
    [
      {
        'src/srcFile.ts': 'export const x = 1;',
        'src/srcUtils.ts': 'export const y = 2;',
        'src/other.ts': 'export const z = 3;'
      },
      'src',
      0.33
    ],
    [
      {
        'data/data1.ts': 'export const x = 1;',
        'data/data2.ts': 'export const y = 2;'
      },
      'data',
      0.5
    ]
  ] as const)('calculates rounded average redundancy for %s', (tree, directoryPath, expected) => {
    expect(metricFor(tree, directoryPath)?.averageRedundancy).toBe(expected);
  });

  it.each([
    [{ 'config/configFile.ts': 'export const x = 1;' }, 'config', true],
    [{ 'data/tool.ts': 'export const x = 1;' }, 'data', false],
    [{ 'scrap/scrapData.ts': 'export const x = 1;' }, 'scrap', true],
    [{ 'utils/utilsHelper.ts': 'export const x = 1;' }, 'utils', true],
    [{ 'api/apiClient.ts': 'export const x = 1;' }, 'api', true]
  ] as const)('detects redundancy issues for %s', (tree, directoryPath, shouldHaveIssue) => {
    const redundancyIssues = metricFor(tree, directoryPath)?.fileIssues.filter((issue) => issue.kind === 'redundancy') ?? [];

    expect(redundancyIssues.length > 0).toBe(shouldHaveIssue);
    for (const issue of redundancyIssues) {
      expect(issue.detail).toMatch(/\d+%/);
      expect(issue.redundancyScore).toEqual(expect.any(Number));
    }
  });

  it.each([
    [{ 'utils.ts': 'export const x = 1;' }, 'utils.ts', true],
    [{ 'helpers.ts': 'export const x = 1;' }, 'helpers.ts', true],
    [{ 'models.ts': 'export const x = 1;', 'legitimate.ts': 'export const y = 2;' }, 'legitimate.ts', false]
  ] as const)('handles low-info issues for %s', (tree, fileName, shouldHaveIssue) => {
    const rootMetric = metricFor(tree, '.');
    const lowInfoIssues = rootMetric?.fileIssues.filter((issue) =>
      issue.fileName === fileName && issue.kind === 'low-info-banned'
    ) ?? [];

    expect(lowInfoIssues.length > 0).toBe(shouldHaveIssue);
  });

  it.each([
    [{ 'src/srcModule.ts': 'export const x = 1;', 'src/srcService.ts': 'export const y = 2;' }, 'src'],
    [{ 'noredun.ts': 'export const x = 1;' }, '.'],
    [{ 'api/apiClient.ts': 'export const x = 1;', 'api/apiServer.ts': 'export const y = 2;' }, 'api']
  ] as const)('keeps average redundancy finite and rounded for %s', (tree, directoryPath) => {
    const value = metricFor(tree, directoryPath)?.averageRedundancy ?? 0;
    const decimalPart = String(value).split('.')[1];

    expect(value).toBe(Math.round(value * 100) / 100);
    expect(value).toBeLessThanOrEqual(1);
    expect(Number.isFinite(value)).toBe(true);
    expect(decimalPart?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it('keeps root and child metrics distinct when both are present', () => {
    const result = analyzeTree({
      'file.ts': 'export const x = 1;',
      'src/file.ts': 'export const y = 2;'
    });

    expect(result.find((metric) => metric.directoryPath === '.')).toBeDefined();
    expect(result.find((metric) => metric.directoryPath === 'src')).toBeDefined();
    expect(result.map((metric) => metric.directoryPath).every((directoryPath) => !directoryPath.includes('//'))).toBe(true);
  });
});
