import { describe, expect, it, vi } from 'vitest';
import { expandExistingTestIncludes } from '../../../src/mutation/runner/vitestRuntime';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';

describe('expandExistingTestIncludes', () => {
  it('expands package-relative patterns from the repository root and only returns files', () => {
    const glob = vi.fn(() => ['packages/example/tests/a.test.ts', 'packages/example/tests/a.test.ts']);

    expect(expandExistingTestIncludes(['packages/example/tests/**/*.test.ts'], glob)).toEqual([
      'packages/example/tests/a.test.ts'
    ]);
    expect(glob).toHaveBeenCalledWith('packages/example/tests/**/*.test.ts', {
      cwd: REPO_ROOT,
      nodir: true
    });
  });
});
