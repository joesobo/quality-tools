import { type QualityTarget } from '../resolve/target';

function isInsideSourceTree(target: QualityTarget): boolean {
  return target.packageRelativePath === 'src' || target.packageRelativePath?.startsWith('src/') === true;
}

export function resolveSourceScope(target: QualityTarget): string | undefined {
  if (target.kind === 'repo') {
    return undefined;
  }

  if (!target.packageRoot) {
    return undefined;
  }

  if (target.kind === 'package') {
    return target.relativePath === '.' ? 'src' : `${target.relativePath}/src`;
  }

  if (!isInsideSourceTree(target)) {
    return undefined;
  }

  return target.relativePath;
}

export function assertSourceScope(target: QualityTarget): string | undefined {
  const scope = resolveSourceScope(target);
  if (!scope && target.kind !== 'repo') {
    throw new Error(
      'This command expects a package root or a path inside a package src/ tree.'
    );
  }
  return scope;
}
