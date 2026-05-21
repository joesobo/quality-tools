import { existsSync, statSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { listWorkspacePackages } from '../util/workspacePackages';

export function resolveExistingPath(repoRoot: string, input?: string): string {
  if (!input) {
    return repoRoot;
  }

  const packageShorthand = input.replace(/\/+$/, '');
  const workspacePackages = listWorkspacePackages(repoRoot);
  const shorthandPackage = workspacePackages.find((workspacePackage) => (
    workspacePackage.name === packageShorthand ||
    workspacePackage.manifestName === packageShorthand
  ));
  const candidates = [
    isAbsolute(input) ? input : resolve(repoRoot, input),
    ...(shorthandPackage ? [shorthandPackage.root] : [])
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Target not found: ${input}`);
  }

  return found;
}

export function pathKind(absolutePath: string): 'directory' | 'file' {
  return statSync(absolutePath).isDirectory() ? 'directory' : 'file';
}
