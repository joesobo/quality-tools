import { describe, expect, it } from 'vitest';
import {
  fileIncludeParts,
  sharedDetectorTestIncludes
} from '../../../../src/mutation/runner/include/parts';

describe('fileIncludeParts', () => {
  it.each([
    {
      expected: {
        camelName: 'typeUsage',
        directory: 'sources',
        dottedRelativePath: 'sources.type-usage',
        includeBroadFallback: true,
        name: 'type-usage',
        relativeTestDirectory: 'sources/'
      },
      name: 'nested hyphenated source files',
      sourcePath: 'sources/type-usage.ts'
    },
    {
      expected: {
        camelName: 'runtime',
        directory: 'extension/graphView/provider',
        dottedRelativePath: 'extension.graphView.provider.runtime',
        includeBroadFallback: false,
        name: 'runtime',
        relativeTestDirectory: 'extension/graphView/provider/'
      },
      name: 'generic file names',
      sourcePath: 'extension/graphView/provider/runtime.ts'
    },
    {
      expected: {
        camelName: 'create',
        directory: 'extension/graphView/provider',
        dottedRelativePath: 'extension.graphView.provider.create',
        includeBroadFallback: false,
        name: 'create',
        relativeTestDirectory: 'extension/graphView/provider/'
      },
      name: 'create file names',
      sourcePath: 'extension/graphView/provider/create.ts'
    },
    {
      expected: {
        camelName: 'state',
        directory: 'extension/graphView/provider',
        dottedRelativePath: 'extension.graphView.provider.state',
        includeBroadFallback: false,
        name: 'state',
        relativeTestDirectory: 'extension/graphView/provider/'
      },
      name: 'state file names',
      sourcePath: 'extension/graphView/provider/state.ts'
    },
    {
      expected: {
        camelName: 'init',
        directory: 'webview/graph/runtime/use/graph',
        dottedRelativePath: 'webview.graph.runtime.use.graph.init',
        includeBroadFallback: true,
        name: 'init',
        relativeTestDirectory: 'webview/graph/runtime/use/graph/'
      },
      name: 'webview component source paths',
      sourcePath: 'webview/components/graph/runtime/use/graph/init.ts'
    },
    {
      expected: {
        camelName: 'index',
        directory: '.',
        dottedRelativePath: 'index',
        includeBroadFallback: true,
        name: 'index',
        relativeTestDirectory: ''
      },
      name: 'root-level files',
      sourcePath: 'index.ts'
    },
    {
      expected: {
        camelName: 'foo',
        directory: 'extension/webview/components',
        dottedRelativePath: 'extension.webview.components.foo',
        includeBroadFallback: true,
        name: 'foo',
        relativeTestDirectory: 'extension/webview/components/'
      },
      name: 'non-leading webview component paths',
      sourcePath: 'extension/webview/components/foo.ts'
    }
  ])('derives include parts for $name', ({ expected, sourcePath }) => {
    expect(fileIncludeParts(sourcePath)).toEqual(expected);
  });
});

describe('sharedDetectorTestIncludes', () => {
  it.each([
    {
      directory: 'extension',
      expected: [],
      name: 'non-source directories',
      recursive: false,
      root: 'packages/extension/tests'
    },
    {
      directory: 'sources',
      expected: [
        'packages/plugin-csharp/tests/ruleDetectors.test.ts',
        'packages/plugin-csharp/tests/ruleDetectors.test.tsx',
        'packages/plugin-csharp/tests/*Detectors.test.ts',
        'packages/plugin-csharp/tests/*Detectors.test.tsx'
      ],
      name: 'direct source-rule detectors',
      recursive: undefined,
      root: 'packages/plugin-csharp/tests'
    },
    {
      directory: 'sources',
      expected: [
        'packages/plugin-csharp/tests/**/ruleDetectors.test.ts',
        'packages/plugin-csharp/tests/**/ruleDetectors.test.tsx',
        'packages/plugin-csharp/tests/**/*Detectors.test.ts',
        'packages/plugin-csharp/tests/**/*Detectors.test.tsx'
      ],
      name: 'recursive source-rule detectors',
      recursive: true,
      root: 'packages/plugin-csharp/tests'
    }
  ])('returns $name', ({ directory, expected, recursive, root }) => {
    const includes = recursive === undefined
      ? sharedDetectorTestIncludes(root, directory)
      : sharedDetectorTestIncludes(root, directory, recursive);

    expect(includes).toEqual(expected);
  });
});
