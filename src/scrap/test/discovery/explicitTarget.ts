import { type QualityTarget } from '../../../shared/resolve/target';
import { isTestPath } from './path';

export interface ExplicitTestFileTarget extends QualityTarget {
  kind: 'file';
  packageName: string;
  packageRelativePath: string;
}

export function hasExplicitTestFileTarget(target: QualityTarget): target is ExplicitTestFileTarget {
  if (target.kind !== 'file') {
    return false;
  }

  if (!target.packageName || !target.packageRelativePath) {
    return false;
  }

  return isTestPath(target.packageRelativePath);
}
