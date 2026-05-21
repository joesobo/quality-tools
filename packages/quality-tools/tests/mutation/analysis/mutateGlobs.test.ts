import { describe, expect, it } from 'vitest';
import { buildMutateGlobs } from '../../../src/mutation/analysis/mutateGlobs';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import { resolveQualityTarget } from '../../../src/shared/resolve/target';

describe('buildMutateGlobs', () => {
  it.each([
    {
      expected: [
        'packages/quality-tools/src/shared/scope/source.ts',
        '!packages/quality-tools/src/cli/**/*.ts',
        '!packages/quality-tools/**/index.ts'
      ],
      exclude: ['packages/quality-tools/src/cli/**/*.ts', 'packages/quality-tools/**/index.ts'],
      name: 'file targets',
      targetPath: 'packages/quality-tools/src/shared/scope/source.ts'
    },
    {
      expected: [
        'packages/quality-tools/src/shared/**/*.ts',
        'packages/quality-tools/src/shared/**/*.tsx',
        '!packages/quality-tools/src/cli/**/*.ts'
      ],
      exclude: ['packages/quality-tools/src/cli/**/*.ts'],
      name: 'directory targets',
      targetPath: 'packages/quality-tools/src/shared'
    },
    {
      expected: [
        'packages/quality-tools/src/**/*.ts',
        '!packages/quality-tools/src/cli/**/*.ts'
      ],
      exclude: ['packages/quality-tools/src/cli/**/*.ts'],
      name: 'package targets',
      targetPath: 'quality-tools/'
    },
    {
      expected: [
        'packages/quality-tools/src/**/*.ts',
        '!packages/quality-tools/src/cli/**/*.ts'
      ],
      exclude: ['packages/quality-tools/src/cli/**/*.ts'],
      name: 'repo targets with configured includes',
      targetPath: undefined
    }
  ])('builds mutation globs for $name', ({ expected, exclude, targetPath }) => {
    const globs = buildMutateGlobs(
      resolveQualityTarget(REPO_ROOT, targetPath),
      {
        include: ['packages/quality-tools/src/**/*.ts'],
        exclude
      }
    );

    expect(globs).toEqual(expected);
  });

  it('uses generic TypeScript globs for repo targets without configured includes', () => {
    expect(buildMutateGlobs(resolveQualityTarget(REPO_ROOT), { include: [], exclude: ['**/*.d.ts'] })).toEqual([
      '**/*.ts',
      '**/*.tsx',
      '!**/*.d.ts'
    ]);
  });
});
