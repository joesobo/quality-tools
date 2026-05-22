import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const STRONG_ROOT_MARKERS = ['quality.config.json', 'pnpm-workspace.yaml'];
const FALLBACK_ROOT_MARKERS = ['package.json', '.git'];

export function workspaceRootFrom(start?: string): string | undefined {
  if (!start) {
    return undefined;
  }

  let fallbackRoot: string | undefined;

  for (
    let currentDirectory = resolve(start), previousDirectory = '';
    currentDirectory !== previousDirectory;
    previousDirectory = currentDirectory, currentDirectory = dirname(currentDirectory)
  ) {
    if (STRONG_ROOT_MARKERS.some((marker) => existsSync(join(currentDirectory, marker)))) {
      return currentDirectory;
    }

    if (!fallbackRoot && FALLBACK_ROOT_MARKERS.some((marker) => existsSync(join(currentDirectory, marker)))) {
      fallbackRoot = currentDirectory;
    }
  }

  return fallbackRoot;
}
