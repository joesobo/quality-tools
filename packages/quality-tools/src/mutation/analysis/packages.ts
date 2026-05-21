import { existsSync } from 'fs';
import { join } from 'path';
import { type WorkspacePackage, listWorkspacePackages } from '../../shared/util/workspacePackages';

function hasSourceDirectory(workspacePackage: WorkspacePackage): boolean {
  return existsSync(join(workspacePackage.root, 'src'));
}

function hasMutationTests(workspacePackage: WorkspacePackage): boolean {
  return existsSync(join(workspacePackage.root, 'tests'));
}

export function discoverMutationPackageNames(repoRoot: string): string[] {
  return listWorkspacePackages(repoRoot)
    .filter(hasSourceDirectory)
    .filter(hasMutationTests)
    .map((workspacePackage): string => workspacePackage.name);
}
