import { existsSync } from 'fs';
import { join } from 'path';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import { relativeTo } from '../../../src/shared/util/pathUtils';

const TEST_ROOTS = ['tests'] as const;

export function isTestPath(packageRelativePath: string | undefined): boolean {
  return TEST_ROOTS.some((root) => (
    packageRelativePath === root ||
    packageRelativePath?.startsWith(`${root}/`) === true
  ));
}

export function existingTestRoots(packageRoot: string): string[] {
  return TEST_ROOTS
    .map((segment) => join(packageRoot, segment))
    .filter((value) => existsSync(value))
    .map((value) => relativeTo(REPO_ROOT, value));
}
