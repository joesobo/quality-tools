import { type QualityTarget } from '../resolve/target';

export function resolveSourceScope(target: QualityTarget): string | undefined {
  if (target.kind === 'repo') {
    return undefined;
  }

  return target.relativePath;
}

export function assertSourceScope(target: QualityTarget): string | undefined {
  const scope = resolveSourceScope(target);
  if (!scope && target.kind !== 'repo') {
    throw new Error(
      'This command expects the repo root, a package root, a directory, or a file target.'
    );
  }
  return scope;
}
