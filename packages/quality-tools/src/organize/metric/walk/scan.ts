import { readdirSync } from 'fs';
import { resolve } from 'path';
import { isExcludedDirectory, isTypeScriptOrJavaScriptFile } from './filters';
import { sortDirectoryNames } from './sort';
import type { DirectoryEntry } from './model';

export function scanDirectory(directoryPath: string): Pick<DirectoryEntry, 'files' | 'subdirectories'> {
  const items = readdirSync(directoryPath, { withFileTypes: true });

  const files: string[] = [];
  const subdirectories: string[] = [];

  for (const item of items) {
    if (item.isFile() && isTypeScriptOrJavaScriptFile(item.name)) {
      files.push(item.name);
    } else if (item.isDirectory() && !isExcludedDirectory(item.name)) {
      subdirectories.push(item.name);
    }
  }

  return {
    files: sortDirectoryNames(files),
    subdirectories: sortDirectoryNames(subdirectories)
  };
}

export function walkDirectoriesRecursive(directoryPath: string, entries: DirectoryEntry[]): void {
  const entry = scanDirectory(directoryPath);

  entries.push({
    directoryPath,
    files: entry.files,
    subdirectories: entry.subdirectories
  });

  for (const subdirectory of entry.subdirectories) {
    walkDirectoriesRecursive(resolve(directoryPath, subdirectory), entries);
  }
}
