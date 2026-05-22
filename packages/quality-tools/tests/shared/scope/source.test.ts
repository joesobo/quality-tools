import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import { assertSourceScope, resolveSourceScope } from '../../../src/shared/scope/source';
import { resolveQualityTarget } from '../../../src/shared/resolve/target';

describe('resolveSourceScope', () => {
  it('does not constrain repo targets to a hardcoded workspace folder', () => {
    expect(resolveSourceScope(resolveQualityTarget(REPO_ROOT))).toBeUndefined();
  });

  it('returns the package root for package targets', () => {
    expect(resolveSourceScope(resolveQualityTarget(REPO_ROOT, 'quality-tools/'))).toBe(
      'packages/quality-tools'
    );
  });

  it('returns the exact source path for file targets', () => {
    expect(
      resolveSourceScope(resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/src/shared/scope/source.ts'))
    ).toBe('packages/quality-tools/src/shared/scope/source.ts');
  });

  it('returns the package src directory when the target is the src folder itself', () => {
    expect(
      resolveSourceScope(resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/src'))
    ).toBe('packages/quality-tools/src');
  });

  it('returns explicit test-tree targets', () => {
    expect(
      resolveSourceScope(resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/tests'))
    ).toBe('packages/quality-tools/tests');
  });

  it('returns non-src package paths without treating src as special', () => {
    expect(resolveSourceScope({
      absolutePath: `${REPO_ROOT}/packages/example/lib/parser.ts`,
      kind: 'file',
      packageRelativePath: 'lib/parser.ts',
      packageRoot: `${REPO_ROOT}/packages/example`,
      relativePath: 'packages/example/lib/parser.ts'
    })).toBe('packages/example/lib/parser.ts');
  });

  it('returns non-package paths as explicit scopes', () => {
    expect(resolveSourceScope({
      absolutePath: `${REPO_ROOT}/docs`,
      kind: 'directory',
      relativePath: 'docs'
    })).toBe('docs');
  });
});

describe('assertSourceScope', () => {
  it('allows repo-wide source analysis without a path prefix', () => {
    expect(assertSourceScope(resolveQualityTarget(REPO_ROOT))).toBeUndefined();
  });

  it('allows non-source-looking targets because tool includes define source policy', () => {
    expect(assertSourceScope(resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/tests'))).toBe(
      'packages/quality-tools/tests'
    );
  });
});
