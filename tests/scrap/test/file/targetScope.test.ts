import { describe, expect, it } from 'vitest';
import { hasExplicitTestFileTarget, isInsideTarget } from '../../../../src/scrap/test/discovery/targetScope';
import { REPO_ROOT } from '../../../../src/shared/resolve/repoRoot';
import { type QualityTarget, resolveQualityTarget } from '../../../../src/shared/resolve/target';

describe('hasExplicitTestFileTarget', () => {
  it('only accepts package-backed file targets', () => {
    expect(hasExplicitTestFileTarget(
      resolveQualityTarget(REPO_ROOT, 'tests/scrap/metrics/compute/basics.test.ts')
    )).toBe(true);
    expect(hasExplicitTestFileTarget(
      resolveQualityTarget(REPO_ROOT, 'src/scrap/metrics/compute.ts')
    )).toBe(false);
    expect(hasExplicitTestFileTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'))).toBe(false);
    expect(hasExplicitTestFileTarget(resolveQualityTarget(REPO_ROOT, 'README.md'))).toBe(false);
  });

  it('rejects file-like targets missing package metadata', () => {
    const baseTarget: QualityTarget = {
      absolutePath: '/repo/tests/example.test.ts',
      kind: 'file',
      relativePath: 'tests/example.test.ts'
    };

    expect(hasExplicitTestFileTarget(baseTarget)).toBe(false);
    expect(hasExplicitTestFileTarget({
      ...baseTarget,
      packageName: 'quality-tools'
    })).toBe(false);
    expect(hasExplicitTestFileTarget({
      ...baseTarget,
      packageRelativePath: 'tests/example.test.ts'
    })).toBe(false);
    expect(hasExplicitTestFileTarget({
      ...baseTarget,
      packageName: 'quality-tools',
      packageRelativePath: 'tests'
    })).toBe(true);
  });

  it('rejects non-file targets even when they point at package tests', () => {
    expect(hasExplicitTestFileTarget({
      absolutePath: '/repo/tests',
      kind: 'directory',
      packageName: 'quality-tools',
      packageRelativePath: 'tests',
      packageRoot: '/repo',
      relativePath: 'tests'
    })).toBe(false);
  });
});

describe('isInsideTarget', () => {
  const repoFile = `${REPO_ROOT}/tests/scrap/metrics/compute/basics.test.ts`;

  it('matches repo, package, directory, and exact file scopes', () => {
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT), REPO_ROOT, repoFile)).toBe(true);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'), REPO_ROOT, repoFile)).toBe(true);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'tests/scrap'), REPO_ROOT, repoFile)).toBe(true);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'tests/scrap/metrics/compute/basics.test.ts'), REPO_ROOT, repoFile)).toBe(true);
  });

  it('does not treat the package root directory itself as a matched package file', () => {
    const packageRoot = `${REPO_ROOT}`;
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'), REPO_ROOT, packageRoot)).toBe(false);
  });

  it('rejects files outside the selected target scope', () => {
    const otherFile = '/tmp/quality-tools-outside/tests/shared/contracts.test.ts';
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'), REPO_ROOT, otherFile)).toBe(false);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'tests/scrap'), REPO_ROOT, otherFile)).toBe(false);
  });

  it('maps source directory targets to their matching test directory', () => {
    const boundaryTestFile = `${REPO_ROOT}/tests/boundaries/analyze.test.ts`;
    const reachabilityTestFile = `${REPO_ROOT}/tests/reachability/analyze.test.ts`;

    expect(
      isInsideTarget(
        resolveQualityTarget(REPO_ROOT, 'src/boundaries'),
        REPO_ROOT,
        boundaryTestFile
      )
    ).toBe(true);
    expect(
      isInsideTarget(
        resolveQualityTarget(REPO_ROOT, 'src/boundaries'),
        REPO_ROOT,
        reachabilityTestFile
      )
    ).toBe(false);
  });

  it('matches the mapped test directory itself for source directory targets', () => {
    const boundaryTestDirectory = `${REPO_ROOT}/tests/boundaries`;

    expect(
      isInsideTarget(
        resolveQualityTarget(REPO_ROOT, 'src/boundaries'),
        REPO_ROOT,
        boundaryTestDirectory
      )
    ).toBe(true);
  });
});
