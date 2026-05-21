import { describe, expect, it } from 'vitest';
import { isInsideTarget, hasExplicitTestFileTarget } from '../../../../src/scrap/test/fileTargetScope';
import { REPO_ROOT } from '../../../../src/shared/resolve/repoRoot';
import { resolveQualityTarget } from '../../../../src/shared/resolve/target';

describe('hasExplicitTestFileTarget', () => {
  it('only accepts package-backed file targets', () => {
    expect(hasExplicitTestFileTarget(
      resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/tests/scrap/metrics/compute/basics.test.ts')
    )).toBe(true);
    expect(hasExplicitTestFileTarget(
      resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/src/scrap/metrics/compute.ts')
    )).toBe(false);
    expect(hasExplicitTestFileTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'))).toBe(false);
    expect(hasExplicitTestFileTarget(resolveQualityTarget(REPO_ROOT, 'README.md'))).toBe(false);
  });
});

describe('isInsideTarget', () => {
  const repoFile = `${REPO_ROOT}/packages/quality-tools/tests/scrap/metrics/compute/basics.test.ts`;

  it('matches repo, package, directory, and exact file scopes', () => {
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT), REPO_ROOT, repoFile)).toBe(true);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'), REPO_ROOT, repoFile)).toBe(true);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/tests/scrap'), REPO_ROOT, repoFile)).toBe(true);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/tests/scrap/metrics/compute/basics.test.ts'), REPO_ROOT, repoFile)).toBe(true);
  });

  it('does not treat the package root directory itself as a matched package file', () => {
    const packageRoot = `${REPO_ROOT}/packages/quality-tools`;
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'), REPO_ROOT, packageRoot)).toBe(false);
  });

  it('rejects files outside the selected target scope', () => {
    const otherFile = `${REPO_ROOT}/packages/extension/tests/shared/contracts.test.ts`;
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'quality-tools/'), REPO_ROOT, otherFile)).toBe(false);
    expect(isInsideTarget(resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/tests/scrap'), REPO_ROOT, otherFile)).toBe(false);
  });

  it('maps source directory targets to their matching test directory', () => {
    const boundaryTestFile = `${REPO_ROOT}/packages/quality-tools/tests/boundaries/analyze.test.ts`;
    const reachabilityTestFile = `${REPO_ROOT}/packages/quality-tools/tests/reachability/analyze.test.ts`;

    expect(
      isInsideTarget(
        resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/src/boundaries'),
        REPO_ROOT,
        boundaryTestFile
      )
    ).toBe(true);
    expect(
      isInsideTarget(
        resolveQualityTarget(REPO_ROOT, 'packages/quality-tools/src/boundaries'),
        REPO_ROOT,
        reachabilityTestFile
      )
    ).toBe(false);
  });
});
