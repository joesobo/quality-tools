import { type QualityTarget } from '../../shared/resolve/target';
import { type ResolvedToolPatterns } from '../../config/quality';

function buildScopeIncludes(scope: string, kind: QualityTarget['kind']): string[] {
  if (kind === 'file') {
    return [scope];
  }

  return [`${scope}/**/*.ts`, `${scope}/**/*.tsx`];
}

export function buildMutateGlobs(target: QualityTarget, patterns: ResolvedToolPatterns): string[] {
  if (target.kind === 'repo') {
    return [
      ...(patterns.include.length > 0 ? patterns.include : ['**/*.ts', '**/*.tsx']),
      ...patterns.exclude.map((pattern) => `!${pattern}`)
    ];
  }

  if (target.kind === 'package') {
    return [
      ...(patterns.include.length > 0
        ? patterns.include
        : [`${target.relativePath}/**/*.ts`, `${target.relativePath}/**/*.tsx`]),
      ...patterns.exclude.map((pattern) => `!${pattern}`)
    ];
  }

  return [
    ...buildScopeIncludes(target.relativePath, target.kind),
    ...patterns.exclude.map((pattern) => `!${pattern}`)
  ];
}
