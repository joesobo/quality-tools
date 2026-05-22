import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultMutationCliDependencies,
  runMutationCli,
  type MutationCliDependencies
} from '../../../src/mutation/runner/command';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import type { QualityTarget } from '../../../src/shared/resolve/target';

function packageTarget(packageName: string): QualityTarget {
  const normalizedName = packageName.replace(/\/+$/, '');
  const rootPackage = normalizedName === 'quality-tools';

  return {
    absolutePath: rootPackage ? REPO_ROOT : `${REPO_ROOT}/packages/${normalizedName}`,
    kind: 'package',
    packageName: normalizedName,
    packageRelativePath: '.',
    packageRoot: rootPackage ? REPO_ROOT : `${REPO_ROOT}/packages/${normalizedName}`,
    relativePath: rootPackage ? '.' : `packages/${normalizedName}`
  };
}

function fileTarget(relativePath: string): QualityTarget {
  return {
    absolutePath: `${REPO_ROOT}/${relativePath}`,
    kind: 'file',
    packageName: 'extension',
    packageRelativePath: relativePath.replace('packages/extension/', ''),
    packageRoot: `${REPO_ROOT}/packages/extension`,
    relativePath,
  };
}

function repoTarget(): QualityTarget {
  return {
    absolutePath: REPO_ROOT,
    kind: 'repo',
    relativePath: '.',
  };
}

function createDependencies(): MutationCliDependencies {
  return {
    resolveQualityTarget: vi.fn((_repoRoot: string, input?: string) => (
      input === '.'
        ? repoTarget()
        : input?.startsWith('packages/extension/src/')
        ? fileTarget(input)
        : packageTarget(input ?? 'quality-tools')
    )),
    runMutation: vi.fn(async () => undefined)
  };
}

describe('command', () => {
  it('wires the default mutation CLI dependencies', () => {
    expect(Object.keys(createDefaultMutationCliDependencies()).sort()).toEqual([
      'resolveQualityTarget',
      'runMutation'
    ]);
  });

  it('runs a single explicit target', async () => {
    const dependencies = createDependencies();
    await runMutationCli(['quality-tools/'], dependencies);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, 'quality-tools/');
    expect(dependencies.runMutation).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit mutation target', async () => {
    const dependencies = createDependencies();

    await expect(runMutationCli([], dependencies)).rejects.toThrow(
      'Mutation requires an explicit package, directory, file, or repo target.'
    );
    expect(dependencies.runMutation).not.toHaveBeenCalled();
  });

  it('uses --mutate as the effective mutation target', async () => {
    const dependencies = createDependencies();

    await runMutationCli([
      'extension/',
      '--mutate',
      'packages/extension/src/webview/components/Graph.tsx',
    ], dependencies);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(
      REPO_ROOT,
      'packages/extension/src/webview/components/Graph.tsx',
    );
    expect(dependencies.runMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'file',
        relativePath: 'packages/extension/src/webview/components/Graph.tsx',
      }),
      { force: false }
    );
  });

  it('passes --force through to the mutation runner', async () => {
    const dependencies = createDependencies();

    await runMutationCli(['quality-tools', '--force'], dependencies);

    expect(dependencies.runMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'package',
        relativePath: '.'
      }),
      { force: true }
    );
  });

  it('passes explicit mutation globs and test includes through to the runner', async () => {
    const dependencies = createDependencies();

    await runMutationCli([
      'quality-tools',
      '--mutate-glob',
      'src/mutation/**/*.ts',
      '--test-include',
      'tests/mutation/**/*.test.ts',
      '--mutate-globs-json',
      '["src/cli/*.ts"]',
      '--test-includes-json',
      '["tests/cli/*.test.ts"]',
    ], dependencies);

    expect(dependencies.runMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'package',
        relativePath: '.'
      }),
      {
        force: false,
        mutateGlobs: [
          'src/mutation/**/*.ts',
          'src/cli/*.ts',
        ],
        testIncludes: [
          'tests/mutation/**/*.test.ts',
          'tests/cli/*.test.ts',
        ],
      }
    );
  });

  it('runs a repo-wide target when explicitly requested', async () => {
    const dependencies = createDependencies();

    await runMutationCli(['.'], dependencies);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, '.');
    expect(dependencies.runMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'repo',
        relativePath: '.'
      }),
      { force: false }
    );
  });
});
