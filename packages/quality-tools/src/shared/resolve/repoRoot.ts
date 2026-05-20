import { resolve } from 'node:path';
import { moduleDirectory } from './moduleDirectory';
import { packageRootFrom } from './packageRoot';
import { workspaceRootFrom } from './workspaceRoot';

export interface RepoRootOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  moduleUrl?: string;
}

function envRepoRoot(env: NodeJS.ProcessEnv): string | undefined {
  const configuredRoot = env.TEST_REPO_ROOT ?? env.QUALITY_TOOLS_ROOT ?? env.GITHUB_WORKSPACE;
  return configuredRoot ? resolve(configuredRoot) : undefined;
}

export function resolveRepoRoot(options: RepoRootOptions = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const configuredRepoRoot = envRepoRoot(env);
  if (configuredRepoRoot) {
    return configuredRepoRoot;
  }

  const cwdWorkspaceRoot = workspaceRootFrom(cwd);
  if (cwdWorkspaceRoot) {
    return cwdWorkspaceRoot;
  }

  throw new Error(`Unable to resolve project root from cwd "${cwd}"`);
}

export function resolvePackageRoot(options: RepoRootOptions = {}): string {
  const moduleUrl = options.moduleUrl ?? import.meta.url;
  const modulePath = moduleDirectory(moduleUrl);
  const discoveredPackageRoot = packageRootFrom(undefined, modulePath);

  if (discoveredPackageRoot) {
    return discoveredPackageRoot;
  }

  throw new Error(`Unable to resolve quality-tools package root from module URL "${moduleUrl}"`);
}

export const REPO_ROOT = resolveRepoRoot();
export const PACKAGE_ROOT = resolvePackageRoot();
