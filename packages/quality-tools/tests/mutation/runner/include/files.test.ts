import { describe, expect, it } from 'vitest';
import { fileIncludes } from '../../../../src/mutation/runner/include/files';

describe('fileIncludes', () => {
  it.each([
    {
      absent: [],
      expected: [
        'packages/extension/tests/extension/graphViewProvider.test.ts',
        'packages/extension/tests/**/graphViewProvider*.test.ts',
        'packages/extension/tests/**/graphViewProvider/**/*.test.ts'
      ],
      name: 'ordinary source files',
      packageName: 'extension',
      sourcePath: 'extension/graphViewProvider.ts'
    },
    {
      absent: [
        'packages/extension/tests/**/runtime.test.ts',
        'packages/extension/tests/**/runtime/**/*.test.ts'
      ],
      expected: [
        'packages/extension/tests/extension/graphView/provider/runtime.test.ts'
      ],
      name: 'generic basenames',
      packageName: 'extension',
      sourcePath: 'extension/graphView/provider/runtime.ts'
    },
    {
      absent: [],
      expected: [
        'packages/plugin-csharp/tests/sources/typeUsageRule.test.ts',
        'packages/plugin-csharp/tests/**/ruleDetectors.test.ts',
        'packages/plugin-csharp/tests/**/*Detectors.test.tsx'
      ],
      name: 'source rules',
      packageName: 'plugin-csharp',
      sourcePath: 'sources/type-usage.ts'
    }
  ])('builds include globs for $name', ({ absent, expected, packageName, sourcePath }) => {
    const includes = fileIncludes(packageName, sourcePath);

    expected.forEach((pattern) => expect(includes).toContain(pattern));
    absent.forEach((pattern) => expect(includes).not.toContain(pattern));
  });
});
