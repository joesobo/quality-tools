import { relativeTo } from '../../shared/util/pathUtils';
import { type QualityTarget } from '../../shared/resolve/target';

export interface ExplicitTestFileTarget extends QualityTarget {
  kind: 'file';
  packageName: string;
  packageRelativePath: string;
}

function isTestPath(packageRelativePath: string | undefined): boolean {
  return packageRelativePath === 'tests' || packageRelativePath?.startsWith('tests/') === true;
}

function sourceTestScope(target: QualityTarget): string | undefined {
  if (!target.packageName || !target.packageRelativePath) {
    return undefined;
  }

  if (target.packageRelativePath === 'src') {
    return `packages/${target.packageName}/tests`;
  }

  if (!target.packageRelativePath.startsWith('src/')) {
    return undefined;
  }

  return `packages/${target.packageName}/tests/${target.packageRelativePath.slice('src/'.length)}`;
}

export function hasExplicitTestFileTarget(target: QualityTarget): target is ExplicitTestFileTarget {
  return target.kind === 'file' &&
    !!target.packageName &&
    !!target.packageRelativePath &&
    isTestPath(target.packageRelativePath);
}

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
    return relativePath.startsWith(`${target.relativePath}/`);
  }

  return relativePath === target.relativePath || relativePath.startsWith(`${target.relativePath}/`);
}
