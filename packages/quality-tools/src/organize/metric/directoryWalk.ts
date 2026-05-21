import { walkDirectoriesRecursive } from './walk/scan';
import { sortDirectoryEntries } from './walk/sort';
import type { DirectoryEntry } from './walk/model';

export type { DirectoryEntry } from './walk/model';
export { sortDirectoryEntries, sortDirectoryNames } from './walk/sort';

export function walkDirectories(rootPath: string): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  walkDirectoriesRecursive(rootPath, entries);
  return sortDirectoryEntries(entries);
}
