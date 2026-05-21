import { type QualityTarget } from '../../../shared/resolve/target';

function packageTestRoot(packageName: string): string {
  return `packages/${packageName}/tests`;
}

export function sourceTestScope(target: QualityTarget): string | undefined {
  if (!target.packageName || !target.packageRelativePath) {
    return undefined;
  }

  if (target.packageRelativePath === 'src') {
    return packageTestRoot(target.packageName);
  }

  if (!target.packageRelativePath.startsWith('src/')) {
    return undefined;
  }

  return `${packageTestRoot(target.packageName)}/${target.packageRelativePath.slice('src/'.length)}`;
}
