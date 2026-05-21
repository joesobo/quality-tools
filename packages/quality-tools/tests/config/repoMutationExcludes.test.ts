import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { resolvePackageToolGlobs } from '../../src/config/quality';
import { REPO_ROOT } from '../../src/shared/resolve/repoRoot';
import { listWorkspacePackages } from '../../src/shared/util/workspacePackages';

describe('repo mutation excludes', () => {
  it('only includes exclude globs that match files in this repo', () => {
    const packageNames = listWorkspacePackages(REPO_ROOT).map((workspacePackage) => workspacePackage.name);

    const misses = packageNames.flatMap((packageName) => {
      const { exclude } = resolvePackageToolGlobs(REPO_ROOT, packageName, 'mutation');

      return exclude.flatMap((pattern) => (
        globSync(pattern, {
          cwd: REPO_ROOT,
          dot: true,
          nodir: true,
          posix: true
        }).length === 0
          ? [`${packageName}:${pattern}`]
          : []
      ));
    });

    expect(misses).toEqual([]);
  });
});
