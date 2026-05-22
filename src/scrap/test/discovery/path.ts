export function isTestPath(packageRelativePath: string | undefined): boolean {
  if (!packageRelativePath) {
    return false;
  }

  return packageRelativePath === 'tests' || packageRelativePath.startsWith('tests/');
}
