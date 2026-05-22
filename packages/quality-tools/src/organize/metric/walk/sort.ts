import type { DirectoryEntry } from './model';

export function sortDirectoryNames(names: string[]): string[] {
  return [...names].sort();
}

export function sortDirectoryEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  return [...entries].sort((left, right) => left.directoryPath.localeCompare(right.directoryPath));
}
