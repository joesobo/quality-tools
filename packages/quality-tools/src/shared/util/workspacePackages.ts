import { existsSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { globSync } from 'glob';
import { toPosix } from './pathUtils';

export interface WorkspacePackage {
  manifestName?: string;
  name: string;
  relativeRoot?: string;
  root: string;
}

function workspacePackageFromPackageJson(repoRoot: string, relativePackageJson: string): WorkspacePackage {
  const packageJsonPath = join(repoRoot, relativePackageJson);
  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string };
  const relativeRoot = toPosix(dirname(relativePackageJson));

  return {
    ...(manifest.name ? { manifestName: manifest.name } : {}),
    name: manifest.name?.split('/').pop() ?? basename(dirname(packageJsonPath)),
    relativeRoot,
    root: join(repoRoot, relativeRoot)
  };
}

function pnpmWorkspaceGlobs(repoRoot: string): string[] {
  const workspacePath = join(repoRoot, 'pnpm-workspace.yaml');
  if (!existsSync(workspacePath)) {
    return [];
  }

  const lines = readFileSync(workspacePath, 'utf-8').split(/\r?\n/);
  const packageGlobs: string[] = [];
  let inPackagesBlock = false;

  for (const line of lines) {
    if (/^\s*packages\s*:/.test(line)) {
      inPackagesBlock = true;
      continue;
    }

    if (!inPackagesBlock) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
    if (match) {
      packageGlobs.push(match[1]);
    }
  }

  return packageGlobs;
}

function packageJsonWorkspaceGlobs(repoRoot: string): string[] {
  const packageJsonPath = join(repoRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    workspaces?: string[] | { packages?: string[] };
  };
  if (Array.isArray(manifest.workspaces)) {
    return manifest.workspaces;
  }

  return manifest.workspaces?.packages ?? [];
}

function workspaceGlobs(repoRoot: string): string[] {
  return pnpmWorkspaceGlobs(repoRoot).length > 0
    ? pnpmWorkspaceGlobs(repoRoot)
    : packageJsonWorkspaceGlobs(repoRoot);
}

function packageJsonGlob(pattern: string): string {
  const normalizedPattern = toPosix(pattern).replace(/\/$/, '');
  return normalizedPattern.endsWith('/package.json')
    ? normalizedPattern
    : `${normalizedPattern}/package.json`;
}

function discoverWorkspacePackageJsons(repoRoot: string): string[] {
  const positiveGlobs = workspaceGlobs(repoRoot).filter((pattern) => !pattern.startsWith('!'));
  const negativeGlobs = workspaceGlobs(repoRoot)
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => packageJsonGlob(pattern.slice(1)));

  return [...new Set(
    positiveGlobs.flatMap((pattern) => globSync(packageJsonGlob(pattern), {
      cwd: repoRoot,
      dot: true,
      ignore: ['**/node_modules/**', ...negativeGlobs],
      nodir: true,
      posix: true
    }))
  )].sort();
}

function shouldIncludeRootPackage(repoRoot: string, packageJsons: string[]): boolean {
  return existsSync(join(repoRoot, 'package.json')) &&
    (packageJsons.length === 0 || existsSync(join(repoRoot, 'src')) || existsSync(join(repoRoot, 'tests')));
}

export function listWorkspacePackages(repoRoot: string): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];
  const packageJsons = discoverWorkspacePackageJsons(repoRoot);

  if (shouldIncludeRootPackage(repoRoot, packageJsons)) {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8')) as { name?: string };
    packages.push({
      ...(packageJson.name ? { manifestName: packageJson.name } : {}),
      name: packageJson.name?.split('/').pop() ?? 'root',
      relativeRoot: '.',
      root: repoRoot
    });
  }

  return [
    ...packages,
    ...packageJsons.map((packageJson) => workspacePackageFromPackageJson(repoRoot, packageJson))
  ].sort((left, right) => left.name.localeCompare(right.name));
}
