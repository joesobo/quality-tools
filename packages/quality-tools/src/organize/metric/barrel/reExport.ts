import * as ts from 'typescript';

export const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(lastDot) : '';
}

export function isReExportStatement(statement: ts.Statement): boolean {
  if (!ts.isExportDeclaration(statement)) {
    return false;
  }

  // export * from '...' or export { ... } from '...'
  if (statement.moduleSpecifier) {
    return true;
  }

  const exportClause = statement.exportClause;
  if (exportClause === undefined) {
    return false;
  }

  if (!ts.isNamedExports(exportClause)) {
    return false;
  }

  return exportClause.elements.length > 0;
}
