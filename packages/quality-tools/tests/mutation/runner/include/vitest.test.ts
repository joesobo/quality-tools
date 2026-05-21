import { describe, expect, it } from 'vitest';
import { resolveScopedVitestIncludes } from '../../../../src/mutation/runner/include/vitest';
import type { QualityTarget } from '../../../../src/shared/resolve/target';

function target(overrides: Partial<QualityTarget>): QualityTarget {
  return {
    absolutePath: '/repo/packages/extension',
    kind: 'package',
    packageName: 'extension',
    packageRelativePath: '.',
    packageRoot: '/repo/packages/extension',
    relativePath: 'packages/extension',
    ...overrides,
  };
}

function sourceFileTarget(
  packageRelativePath: string,
  overrides: Partial<QualityTarget> = {}
): QualityTarget {
  const packageName = overrides.packageName ?? 'extension';
  const packageRoot = overrides.packageRoot ?? `/repo/packages/${packageName}`;

  return target({
    absolutePath: `${packageRoot}/${packageRelativePath}`,
    kind: 'file',
    packageName,
    packageRelativePath,
    packageRoot,
    relativePath: `packages/${packageName}/${packageRelativePath}`,
    ...overrides
  });
}

function sourceDirectoryTarget(packageRelativePath: string): QualityTarget {
  return target({
    absolutePath: `/repo/packages/extension/${packageRelativePath}`,
    kind: 'directory',
    packageRelativePath,
    relativePath: `packages/extension/${packageRelativePath}`,
  });
}

describe('resolveScopedVitestIncludes package targets', () => {
  it('returns package-local test patterns for package targets', () => {
    expect(resolveScopedVitestIncludes(target({ kind: 'package' }))).toEqual([
      'packages/extension/tests/**/*.test.ts',
      'packages/extension/tests/**/*.test.tsx',
    ]);
  });
});

describe('resolveScopedVitestIncludes file targets', () => {
  it.each([
    {
      absent: [],
      expected: [
        'packages/extension/tests/extension/graphViewProvider.test.ts',
        'packages/extension/tests/extension/graphViewProvider/**/*.test.ts',
        'packages/extension/tests/**/graphViewProvider*.test.ts',
        'packages/extension/tests/**/graphViewProvider/**/*.test.ts'
      ],
      name: 'mirrored file and split-folder test patterns',
      target: sourceFileTarget('src/extension/graphViewProvider.ts')
    },
    {
      absent: [],
      expected: [
        'packages/plugin-typescript/tests/focusedImports.filter.test.ts',
        'packages/plugin-typescript/tests/**/focusedImports.filter.test.ts'
      ],
      name: 'dotted test names for nested source files',
      target: sourceFileTarget('src/focusedImports/filter.ts', {
        packageName: 'plugin-typescript',
        packageRoot: '/repo/packages/plugin-typescript'
      })
    },
    {
      absent: [],
      expected: [
        'packages/extension/tests/extension/workspaceAnalyzer/**/*.test.ts',
        'packages/extension/tests/extension/workspaceAnalyzer/**/*.test.tsx'
      ],
      name: 'mirrored feature test tree for service-style source files',
      target: sourceFileTarget('src/extension/workspaceAnalyzer/service.ts')
    },
    {
      absent: [],
      expected: [
        'packages/plugin-python/tests/**/ruleDetectors.test.ts',
        'packages/plugin-python/tests/**/*Detectors.test.ts'
      ],
      name: 'shared detector tests for source rule files',
      target: sourceFileTarget('src/sources/from-import-relative.ts', {
        packageName: 'plugin-python',
        packageRoot: '/repo/packages/plugin-python'
      })
    },
    {
      absent: [],
      expected: [
        'packages/plugin-csharp/tests/sources/typeUsageRule.test.ts',
        'packages/plugin-csharp/tests/**/typeUsageRule.test.ts'
      ],
      name: 'camel-cased rule tests for hyphenated source rule files',
      target: sourceFileTarget('src/sources/type-usage.ts', {
        packageName: 'plugin-csharp',
        packageRoot: '/repo/packages/plugin-csharp'
      })
    },
    {
      absent: [
        'packages/extension/tests/**/runtime.test.ts',
        'packages/extension/tests/**/runtime/**/*.test.ts'
      ],
      expected: [
        'packages/extension/tests/extension/graphView/provider/runtime.test.ts'
      ],
      name: 'generic file names without broad basename fallbacks',
      target: sourceFileTarget('src/extension/graphView/provider/runtime.ts')
    },
    {
      absent: [],
      expected: [
        'packages/extension/tests/webview/graph/runtime/use/graph/init.test.ts'
      ],
      name: 'webview component source paths',
      target: sourceFileTarget('src/webview/components/graph/runtime/use/graph/init.ts')
    },
    {
      absent: [],
      expected: [
        'packages/extension/tests/webview/graph/runtime/use/graph/interaction.test.tsx'
      ],
      name: 'relocated hook tests that mirror the source directory',
      target: sourceFileTarget('src/webview/components/graph/runtime/use/graph/interaction.ts')
    },
    {
      absent: [],
      expected: [
        'packages/extension/tests/webview/graph/runtime/physics.test.ts'
      ],
      name: 'ancestor feature tests for modules split below a tested feature file',
      target: sourceFileTarget('src/webview/components/graph/runtime/physics/member/simulation/circleCollision.ts')
    }
  ])('includes $name', ({ absent, expected, target: qualityTarget }) => {
    const includes = resolveScopedVitestIncludes(qualityTarget) ?? [];

    expected.forEach((pattern) => expect(includes).toContain(pattern));
    absent.forEach((pattern) => expect(includes).not.toContain(pattern));
  });
});

describe('resolveScopedVitestIncludes directory targets', () => {
  it.each([
    {
      expected: [
        'packages/extension/tests/core/views/**/*.test.ts',
        'packages/extension/tests/core/views/**/*.test.tsx',
      ],
      name: 'mirrored directory test patterns',
      target: sourceDirectoryTarget('src/core/views')
    },
    {
      expected: [
        'packages/extension/tests/webview/graph/runtime/use/graph/**/*.test.ts',
        'packages/extension/tests/webview/graph/runtime/use/graph/**/*.test.tsx',
      ],
      name: 'webview component directories',
      target: sourceDirectoryTarget('src/webview/components/graph/runtime/use/graph')
    }
  ])('returns $name', ({ expected, target: qualityTarget }) => {
    expect(resolveScopedVitestIncludes(qualityTarget)).toEqual(expected);
  });
});

describe('resolveScopedVitestIncludes unsupported targets', () => {
  it.each([
    {
      name: 'targets outside src',
      target: target({
        absolutePath: '/repo/packages/extension/tests/core/views',
        kind: 'directory',
        packageRelativePath: 'tests/core/views',
        relativePath: 'packages/extension/tests/core/views',
      })
    },
    {
      name: 'package targets without package names',
      target: {
        absolutePath: '/repo/packages/extension',
        kind: 'package',
        packageName: undefined,
        packageRelativePath: '.',
        packageRoot: '/repo/packages/extension',
        relativePath: 'packages/extension',
      } satisfies QualityTarget
    },
    {
      name: 'file targets without src-relative package paths',
      target: target({
        absolutePath: '/repo/packages/extension/src/core/views.ts',
        kind: 'file',
        packageRelativePath: undefined,
        relativePath: 'packages/extension/src/core/views.ts',
      })
    }
  ])('returns undefined for $name', ({ target: qualityTarget }) => {
    expect(resolveScopedVitestIncludes(qualityTarget)).toBeUndefined();
  });
});
