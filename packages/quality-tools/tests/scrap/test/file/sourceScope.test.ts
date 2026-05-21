import { describe, expect, it } from 'vitest';
import { sourceTestScope } from '../../../../src/scrap/test/discovery/sourceScope';
import { type QualityTarget } from '../../../../src/shared/resolve/target';

function target(overrides: Partial<QualityTarget>): QualityTarget {
  return {
    absolutePath: '/repo/packages/quality-tools/src/scrap',
    kind: 'directory',
    relativePath: 'packages/quality-tools/src/scrap',
    ...overrides
  };
}

describe('sourceTestScope', () => {
  it('maps package source roots and nested source directories to tests', () => {
    expect(sourceTestScope(target({
      packageName: 'quality-tools',
      packageRelativePath: 'src'
    }))).toBe('packages/quality-tools/tests');

    expect(sourceTestScope(target({
      packageName: 'quality-tools',
      packageRelativePath: 'src/scrap'
    }))).toBe('packages/quality-tools/tests/scrap');
  });

  it('ignores non-source and incomplete package targets', () => {
    expect(sourceTestScope(target({
      packageName: 'quality-tools',
      packageRelativePath: 'tests/scrap'
    }))).toBeUndefined();

    expect(sourceTestScope(target({
      packageRelativePath: 'src/scrap'
    }))).toBeUndefined();

    expect(sourceTestScope(target({
      packageName: 'quality-tools'
    }))).toBeUndefined();
  });
});
