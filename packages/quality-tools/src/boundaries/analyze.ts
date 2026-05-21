import { existsSync } from 'fs';
import { basename, join } from 'path';
import type { QualityTarget } from '../shared/resolve/target';
import { listWorkspacePackages, type WorkspacePackage } from '../shared/util/workspacePackages';
import { analyzePackage } from './graph/packageAnalysis';
import { mergeReports } from './merge';
import type { BoundaryReport } from './model';

function analyzePackageRoot(
  repoRoot: string,
  workspacePackage: WorkspacePackage,
  scope?: QualityTarget
): BoundaryReport {
  return analyzePackage(repoRoot, workspacePackage, scope);
}

export function analyzeBoundaries(repoRoot: string, target: QualityTarget): BoundaryReport {
  const workspacePackages = listWorkspacePackages(repoRoot);

  if (target.kind === 'repo') {
    return mergeReports(
      'packages',
      workspacePackages.map((workspacePackage) => analyzePackageRoot(repoRoot, workspacePackage))
    );
  }

  if (target.packageName) {
    const workspacePackage = workspacePackages.find((entry) => (
      entry.name === target.packageName ||
      entry.manifestName === target.packageName
    ));

    return analyzePackageRoot(repoRoot, {
      name: target.packageName,
      root: target.packageRoot ?? workspacePackage?.root ?? join(repoRoot, target.packageName),
      relativeRoot: workspacePackage?.relativeRoot
    }, target);
  }

  if (existsSync(target.absolutePath)) {
    const workspacePackage = {
      name: basename(target.absolutePath),
      root: target.absolutePath
    };
    return analyzePackageRoot(repoRoot, workspacePackage, target);
  }

  return {
    deadEnds: [],
    deadSurfaces: [],
    files: [],
    layerViolations: [],
    target: target.relativePath
  };
}
