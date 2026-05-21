import type { QualityTarget } from '../../shared/resolve/target';
import type { WorkspacePackage } from '../../shared/util/workspacePackages';
import { deadEnds, deadSurfaces } from './deadFiles';
import type { BoundaryFileNode, BoundaryReport, BoundaryViolation } from '../model';

function fileIsInsideScope(filePath: string, scope?: QualityTarget): boolean {
  if (!scope) {
    return true;
  }

  return filePath === scope.relativePath || filePath.startsWith(`${scope.relativePath}/`);
}

function selectedViolations(
  violations: BoundaryViolation[],
  files: BoundaryFileNode[]
): BoundaryViolation[] {
  const scopedPaths = new Set(files.map((file) => file.relativePath));
  return violations.filter((violation) => scopedPaths.has(violation.from));
}

export function selectedFiles(
  files: BoundaryFileNode[],
  scope?: QualityTarget
): BoundaryFileNode[] {
  return files.filter((file) => fileIsInsideScope(file.relativePath, scope));
}

export function createScopedReport(
  workspacePackage: WorkspacePackage,
  files: BoundaryFileNode[],
  violations: BoundaryViolation[],
  scope?: QualityTarget
): BoundaryReport {
  return {
    deadEnds: deadEnds(files),
    deadSurfaces: deadSurfaces(files),
    files,
    layerViolations: selectedViolations(violations, files),
    target: scope?.relativePath ?? workspacePackage.relativeRoot ?? workspacePackage.name
  };
}
