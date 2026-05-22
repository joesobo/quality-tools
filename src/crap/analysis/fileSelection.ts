import { readFileSync } from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { pathIncludedByDefaultTool, pathIncludedByTool } from '../../config/quality';
import { toPosix } from '../../shared/util/pathUtils';
import { findContainingPackage } from '../../shared/util/packageTarget';
import { listWorkspacePackages } from '../../shared/util/workspacePackages';

function matchesFilterScope(relativePath: string, filterScope: string | undefined): boolean {
  if (!filterScope) {
    return true;
  }

  if (relativePath === filterScope) {
    return true;
  }

  return relativePath.startsWith(`${filterScope}/`);
}

export function shouldIncludeFile(
  filePath: string,
  filterScope: string | undefined,
  repoRoot: string
): boolean {
  const relativePath = toPosix(path.relative(repoRoot, filePath));
  if (!matchesFilterScope(relativePath, filterScope)) {
    return false;
  }

  const workspacePackage = findContainingPackage(filePath, listWorkspacePackages(repoRoot));
  if (!workspacePackage) {
    return pathIncludedByDefaultTool(repoRoot, 'crap', relativePath);
  }

  return pathIncludedByTool(
    repoRoot,
    workspacePackage.name,
    'crap',
    toPosix(path.relative(workspacePackage.root, filePath))
  );
}

export function createSourceFile(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}
