import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import { existingTestRoots, isTestPath } from './testRootsSupport';

describe('isTestPath', () => {
  it('recognizes test roots and nested test paths', () => {
    expect(isTestPath('tests')).toBe(true);
    expect(isTestPath('tests/unit/sample.test.ts')).toBe(true);
    expect(isTestPath('src/file.ts')).toBe(false);
    expect(isTestPath(undefined)).toBe(false);
  });
});

describe('existingTestRoots', () => {
  it('returns repo-relative test roots that exist', () => {
    expect(existingTestRoots(REPO_ROOT)).toEqual(['tests']);
  });
});
