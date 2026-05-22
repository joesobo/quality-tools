import { type QualityTarget } from '../../../shared/resolve/target';

function packageRelativeRoot(target: QualityTarget): string | undefined {
  if (!target.packageRelativePath) {
    return undefined;
  }

  if (target.packageRelativePath === '.') {
    return target.relativePath;
  }

  if (target.relativePath === target.packageRelativePath) {
    return '.';
  }

  const suffix = `/${target.packageRelativePath}`;
  return target.relativePath.endsWith(suffix)
    ? target.relativePath.slice(0, -suffix.length)
    : undefined;
}

function packageTestRoot(target: QualityTarget): string | undefined {
  const relativeRoot = packageRelativeRoot(target);
  if (!relativeRoot) {
    return undefined;
  }

  return relativeRoot === '.' ? 'tests' : `${relativeRoot}/tests`;
}

export function sourceTestScope(target: QualityTarget): string | undefined {
  if (!target.packageRoot || !target.packageRelativePath) {
    return undefined;
  }

  const testRoot = packageTestRoot(target);
  if (!testRoot) {
    return undefined;
  }

  if (target.packageRelativePath === 'src') {
    return testRoot;
  }

  if (!target.packageRelativePath.startsWith('src/')) {
    return undefined;
  }

  return `${testRoot}/${target.packageRelativePath.slice('src/'.length)}`;
}
