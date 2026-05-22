import { describe, expect, it } from 'vitest';
import { sourceTestScope } from '../../../../src/scrap/test/discovery/sourceScope';
import { type QualityTarget } from '../../../../src/shared/resolve/target';

function target(overrides: Partial<QualityTarget>): QualityTarget {
  return {
    absolutePath: '/repo/src/scrap',
    kind: 'directory',
    packageRoot: '/repo',
    relativePath: 'src/scrap',
    ...overrides
  };
}

describe('sourceTestScope', () => {
  it('maps package source roots and nested source directories to tests', () => {
    expect(sourceTestScope(target({
      packageName: 'quality-tools',
      packageRelativePath: 'src',
      relativePath: 'src'
    }))).toBe('tests');

    expect(sourceTestScope(target({
      packageName: 'quality-tools',
      packageRelativePath: 'src/scrap'
    }))).toBe('tests/scrap');
  });

  it('ignores non-source and incomplete package targets', () => {
    expect(sourceTestScope(target({
      packageName: 'quality-tools',
      packageRelativePath: 'tests/scrap',
      relativePath: 'tests/scrap'
    }))).toBeUndefined();

    expect(sourceTestScope(target({
      packageRelativePath: 'src/scrap',
      packageRoot: undefined
    }))).toBeUndefined();

    expect(sourceTestScope(target({
      packageName: 'quality-tools'
    }))).toBeUndefined();
  });
});
