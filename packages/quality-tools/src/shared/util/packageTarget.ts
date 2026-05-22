import { type WorkspacePackage } from './workspacePackages';

export function findContainingPackage(
  absolutePath: string,
  workspacePackages: WorkspacePackage[]
): WorkspacePackage | undefined {
  return workspacePackages
    .filter((workspacePackage) => (
      absolutePath === workspacePackage.root || absolutePath.startsWith(`${workspacePackage.root}/`)
    ))
    .sort((left, right) => right.root.length - left.root.length)[0];
}
