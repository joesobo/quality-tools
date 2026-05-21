import { afterEach, describe, expect, it } from 'vitest';
import { collectFileIssues } from '../../src/organize/analyze/issues';
import { cleanupTempDirs, createFileTree } from './testHelpers';

const tempDirs: string[] = [];

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

function collectFromTree(
  tree: Record<string, string>,
  fileNames: string[],
  options: {
    ancestorFolders?: readonly string[];
    banned?: readonly string[];
    discouraged?: readonly string[];
    isPackageEntryDirectory?: boolean;
    threshold?: number;
  } = {}
) {
  const root = createFileTree(tree, tempDirs);

  return collectFileIssues(
    fileNames,
    root,
    [...(options.ancestorFolders ?? [])],
    { banned: [...(options.banned ?? [])], discouraged: [...(options.discouraged ?? [])] },
    options.threshold ?? 0.5,
    options.isPackageEntryDirectory
  );
}

describe('collectFileIssues', () => {
  it.each([
    [
      { 'goodName.ts': 'export const x = 1;', 'anotherGood.ts': 'export const y = 2;' },
      ['goodName.ts', 'anotherGood.ts'],
      {},
      []
    ],
    [
      { 'utils.ts': 'export const helper = () => {};' },
      ['utils.ts'],
      { banned: ['utils', 'helpers'] },
      [{ fileName: 'utils.ts', kind: 'low-info-banned' }]
    ],
    [
      { 'index.ts': 'export { x } from "./a";\nexport { y } from "./b";', 'a.ts': 'export const x = 1;', 'b.ts': 'export const y = 2;' },
      ['index.ts', 'a.ts', 'b.ts'],
      {},
      [{ fileName: 'index.ts', kind: 'barrel' }]
    ],
    [
      { 'srcModule.ts': 'export const x = 1;' },
      ['srcModule.ts'],
      { ancestorFolders: ['src'], threshold: 0.5 },
      [{
        detail: 'filename repeats path context (50% token overlap)',
        fileName: 'srcModule.ts',
        kind: 'redundancy',
        redundancyScore: 0.5
      }]
    ],
    [
      { 'index.ts': 'export const x = 1;' },
      ['index.ts'],
      { banned: ['index'] },
      []
    ],
    [
      { 'index.ts': 'export const x = 1;' },
      ['index.ts'],
      { banned: ['index'], isPackageEntryDirectory: false },
      [{ fileName: 'index.ts', kind: 'low-info-banned' }]
    ]
  ] as const)('collects expected issues for %j', (tree, fileNames, options, expectedIssues) => {
    const result = collectFromTree(tree, [...fileNames], options);

    for (const issue of expectedIssues) {
      expect(result).toContainEqual(expect.objectContaining(issue));
    }
    if (expectedIssues.length === 0) {
      expect(result).toEqual([]);
    }
  });

  it('skips redundancy detection when score is below threshold', () => {
    const result = collectFromTree(
      { 'file.ts': 'export const x = 1;' },
      ['file.ts'],
      { threshold: 0.99 }
    );

    expect(result.find((issue) => issue.kind === 'redundancy')).toBeUndefined();
  });

  it('handles files that cannot be read gracefully', () => {
    const result = collectFromTree(
      { 'good.ts': 'export const x = 1;' },
      ['good.ts', 'nonexistent.ts']
    );

    expect(Array.isArray(result)).toBe(true);
  });

  it('accumulates multiple issue types for the same file', () => {
    const result = collectFromTree(
      { 'utils.ts': 'export { x } from "./a";\nexport { y } from "./b";' },
      ['utils.ts'],
      { banned: ['utils'], threshold: 0.1 }
    );

    expect(result.map((issue) => issue.kind)).toContain('low-info-banned');
  });
});
