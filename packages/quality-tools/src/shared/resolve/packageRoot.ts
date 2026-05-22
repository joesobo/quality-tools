import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function packageRootFrom(repoRoot: string | undefined, start?: string): string | undefined {
  if (!start) {
    return undefined;
  }

  for (
    let currentDirectory = resolve(start), previousDirectory: string | undefined;
    currentDirectory !== previousDirectory;
    previousDirectory = currentDirectory, currentDirectory = dirname(currentDirectory)
  ) {
    if (repoRoot && currentDirectory === repoRoot) {
      return undefined;
    }

    if (existsSync(join(currentDirectory, 'package.json'))) {
      return currentDirectory;
    }
  }

  return undefined;
}
