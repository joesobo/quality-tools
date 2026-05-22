import { existsSync, statSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { listWorkspacePackages } from '../util/workspacePackages';

function packagePathCandidates(repoRoot: string, input: string): string[] {
  const normalizedInput = input.replace(/\/+$/, '');
  return listWorkspacePackages(repoRoot).flatMap((workspacePackage) => {
    const aliases = [
      workspacePackage.name,
      ...(workspacePackage.manifestName ? [workspacePackage.manifestName] : [])
    ];

    return aliases.flatMap((alias) => {
      if (normalizedInput === alias) {
        return [workspacePackage.root];
      }

      if (normalizedInput.startsWith(`${alias}/`)) {
        return [resolve(workspacePackage.root, normalizedInput.slice(alias.length + 1))];
      }

      return [];
    });
  });
}

export function resolveExistingPath(repoRoot: string, input?: string): string {
  if (!input) {
    return repoRoot;
  }

  const candidates = [
    isAbsolute(input) ? input : resolve(repoRoot, input),
    ...packagePathCandidates(repoRoot, input)
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
