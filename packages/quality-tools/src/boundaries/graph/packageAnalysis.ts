import { basename } from 'path';
import { parseFileImports } from '../../organize/cohesion/parse';
import type { QualityTarget } from '../../shared/resolve/target';
import type { WorkspacePackage } from '../../shared/util/workspacePackages';
import { resolveImportTarget } from './imports';
import { createNodesByPath, type BoundaryNodeIndex } from './nodeIndex';
import { createScopedReport, selectedFiles } from './scope';
import type { BoundaryReport, BoundaryViolation } from '../model';

function* collectViolations(
  absolutePath: string,
  nodesByPath: BoundaryNodeIndex,
  candidatePaths: Set<string>
): Iterable<BoundaryViolation> {
  const node = nodesByPath.get(absolutePath)!;

  const imports = parseFileImports(absolutePath, basename(absolutePath));
  for (const specifier of imports) {
    const resolvedImport = resolveImportTarget(absolutePath, specifier, candidatePaths);
    if (!resolvedImport) {
      continue;
    }

    const importedNode = nodesByPath.get(resolvedImport)!;

    node.outgoing += 1;
    importedNode.incoming += 1;

    if (
      node.layer &&
      importedNode.layer &&
      node.layer !== importedNode.layer &&
      !node.allowedLayers.includes(importedNode.layer)
    ) {
      yield {
        from: node.relativePath,
        fromLayer: node.layer,
        reason: `${node.layer} cannot depend on ${importedNode.layer}`,
        to: importedNode.relativePath,
        toLayer: importedNode.layer
      };
    }
  }
}

export function analyzePackage(
  repoRoot: string,
  workspacePackage: WorkspacePackage,
  scope?: QualityTarget
): BoundaryReport {
  const { candidatePaths, nodesByPath } = createNodesByPath(repoRoot, workspacePackage);
  const violations = Array.from(candidatePaths).flatMap((absolutePath) =>
    Array.from(collectViolations(absolutePath, nodesByPath, candidatePaths))
  );

  return createScopedReport(
    workspacePackage,
    selectedFiles([...nodesByPath.values()], scope),
    violations,
    scope
  );
}
