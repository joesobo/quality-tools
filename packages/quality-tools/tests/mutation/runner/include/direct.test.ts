import { describe, expect, it } from 'vitest';
import { directIncludes } from '../../../../src/mutation/runner/include/direct';

describe('directIncludes', () => {
  it('builds the exact direct include set for ordinary files', () => {
    expect(
      directIncludes('packages/extension/tests', {
        camelName: 'graphViewProvider',
        directory: 'extension',
        dottedRelativePath: 'extension.graphViewProvider',
        includeBroadFallback: true,
        name: 'graphViewProvider',
        relativeTestDirectory: 'extension/'
      })
    ).toEqual([
      'packages/extension/tests/extension/**/*.test.ts',
      'packages/extension/tests/extension/**/*.test.tsx',
      'packages/extension/tests/extension/**/*.mutations.test.ts',
      'packages/extension/tests/extension/**/*.mutations.test.tsx',
      'packages/extension/tests/extension/graphViewProvider.test.ts',
      'packages/extension/tests/extension/graphViewProvider.test.tsx',
      'packages/extension/tests/extension/graphViewProvider.mutations.test.ts',
      'packages/extension/tests/extension/graphViewProvider.mutations.test.tsx',
      'packages/extension/tests/extension/graphViewProvider*.test.ts',
      'packages/extension/tests/extension/graphViewProvider*.test.tsx',
      'packages/extension/tests/extension/graphViewProvider/**/*.test.ts',
      'packages/extension/tests/extension/graphViewProvider/**/*.test.tsx',
      'packages/extension/tests/extension.graphViewProvider.test.ts',
      'packages/extension/tests/extension.graphViewProvider.test.tsx',
      'packages/extension/tests/extension.graphViewProvider.mutations.test.ts',
      'packages/extension/tests/extension.graphViewProvider.mutations.test.tsx',
      'packages/extension/tests/extension/graphViewProviderRule.test.ts',
      'packages/extension/tests/extension/graphViewProviderRule.test.tsx',
      'packages/extension/tests/extension.test.ts',
      'packages/extension/tests/extension.test.tsx',
      'packages/extension/tests/extension.mutations.test.ts',
      'packages/extension/tests/extension.mutations.test.tsx'
    ]);
  });

  it('does not create ancestor feature includes for root-level files', () => {
    const includes = directIncludes('packages/example/tests', {
        camelName: 'index',
        directory: '.',
        dottedRelativePath: 'index',
        includeBroadFallback: true,
        name: 'index',
        relativeTestDirectory: ''
      });

    expect(includes).not.toContain('packages/example/tests/..test.ts');
    expect(includes.every((pattern) => pattern.includes('index') || pattern.includes('**'))).toBe(true);
  });
});
