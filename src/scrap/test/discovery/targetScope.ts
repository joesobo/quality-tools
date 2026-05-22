import { type QualityTarget } from '../../../shared/resolve/target';
import { relativeTo } from '../../../shared/util/pathUtils';
import { sourceTestScope } from './sourceScope';
export { hasExplicitTestFileTarget, type ExplicitTestFileTarget } from './explicitTarget';

export function isInsideTarget(target: QualityTarget, repoRoot: string, absolutePath: string): boolean {
  const relativePath = relativeTo(repoRoot, absolutePath);
  const mappedTestScope = sourceTestScope(target);

  if (mappedTestScope) {
    return relativePath === mappedTestScope || relativePath.startsWith(`${mappedTestScope}/`);
  }

  if (target.kind === 'repo') {
    return true;
  }

  if (target.kind === 'package') {
    if (target.relativePath === '.') {
      return relativePath !== '' &&
        relativePath !== '.' &&
        relativePath !== '..' &&
        !relativePath.startsWith('../');
    }

    return relativePath.startsWith(`${target.relativePath}/`);
  }

  return relativePath === target.relativePath || relativePath.startsWith(`${target.relativePath}/`);
}
