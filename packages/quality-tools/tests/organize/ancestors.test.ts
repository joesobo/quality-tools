import { describe, expect, it } from 'vitest';
import { computeAverageRedundancy, extractAncestorFolders } from '../../src/organize/analyze/ancestors';

describe('extractAncestorFolders', () => {
  it.each([
    ['.', []],
    ['src', ['src']],
    ['src/core/utils', ['src', 'core', 'utils']],
    ['src\\core\\utils', ['src', 'core', 'utils']],
    ['src/core\\utils', ['src', 'core', 'utils']],
    ['src//core///utils', ['src', 'core', 'utils']],
    ['', []],
    ['src/', ['src']],
    ['/src/core', ['src', 'core']],
    ['src/core.test/utils', ['src', 'core.test', 'utils']]
  ])('extracts ancestor folders from %s', (directoryPath, expected) => {
    expect(extractAncestorFolders(directoryPath)).toEqual(expected);
  });
});

describe('computeAverageRedundancy', () => {
  it.each([
    [[], ['src'], 0],
    [['file.ts'], [], 0],
    [['srcFile.ts'], ['src'], 0.5],
    [['srcFile.ts', 'coreUtils.ts'], ['src', 'core'], 0.5],
    [['unrelated.ts', 'other.ts'], ['src'], 0]
  ])('averages redundancy for %j against %j', (files, ancestors, expected) => {
    expect(computeAverageRedundancy(files, ancestors)).toBe(expected);
  });
});
