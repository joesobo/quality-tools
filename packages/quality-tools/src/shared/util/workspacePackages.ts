import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export interface WorkspacePackage {
  name: string;
  relativeRoot?: string;
  root: string;
}

type DirectoryEntry = {
  isDirectory(): boolean;
  name: string;
};

export function resolveWorkspacePackages(
  packagesRoot: string,
  entries: DirectoryEntry[]
): WorkspacePackage[] {
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      relativeRoot: `packages/${entry.name}`,
      root: join(packagesRoot, entry.name)
    }))
    .filter((entry) => existsSync(join(entry.root, 'package.json')))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function listWorkspacePackages(repoRoot: string): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];
  if (existsSync(join(repoRoot, 'src')) && existsSync(join(repoRoot, 'package.json'))) {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8')) as { name?: string };
    packages.push({
      name: packageJson.name?.split('/').pop() ?? 'root',
      relativeRoot: '.',
      root: repoRoot
    });
  }

  const packagesRoot = join(repoRoot, 'packages');
  if (!existsSync(packagesRoot)) {
    return packages;
  }

  return [
    ...packages,
    ...resolveWorkspacePackages(packagesRoot, readdirSync(packagesRoot, { withFileTypes: true }))
  ];
}
