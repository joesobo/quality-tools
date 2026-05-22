function isHidden(name: string): boolean {
  return name.startsWith('.');
}

export function isExcludedDirectory(name: string): boolean {
  if (isHidden(name)) {
    return true;
  }

  return name === 'node_modules' || name === 'coverage' || name === 'reports' || name === 'dist' || name === 'dist-e2e';
}

export function isTypeScriptOrJavaScriptFile(name: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(name);
}
