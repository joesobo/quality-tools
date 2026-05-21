import { describe, expect, it } from 'vitest';
import { baseTestRoots, directoryIncludes, packageIncludes } from '../../../../src/mutation/runner/include/roots';

describe('test include roots', () => {
  it.each([
    {
      actual: () => baseTestRoots('extension'),
      expected: ['packages/extension/tests'],
      name: 'package test roots'
    },
    {
      actual: () => packageIncludes('extension'),
      expected: [
        'packages/extension/tests/**/*.test.ts',
        'packages/extension/tests/**/*.test.tsx'
      ],
      name: 'package-wide test globs'
    },
    {
      actual: () => directoryIncludes('extension', 'core/views'),
      expected: [
        'packages/extension/tests/core/views/**/*.test.ts',
        'packages/extension/tests/core/views/**/*.test.tsx'
      ],
      name: 'mirrored directory globs'
    },
    {
      actual: () => directoryIncludes('extension', 'webview/components/graph/runtime/use/graph'),
      expected: [
        'packages/extension/tests/webview/graph/runtime/use/graph/**/*.test.ts',
        'packages/extension/tests/webview/graph/runtime/use/graph/**/*.test.tsx'
      ],
      name: 'webview component directory globs'
    }
  ])('builds $name', ({ actual, expected }) => {
    expect(actual()).toEqual(expected);
  });
});
