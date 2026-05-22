import { describe, expect, it } from 'vitest';
import { buildMutationArgsForTest } from '../../../src/mutation/runner/run';
import { resolveQualityTarget } from '../../../src/shared/resolve/target';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import type { QualityTarget } from '../../../src/shared/resolve/target';

describe('buildMutationArgsForTest', () => {
  it('uses unified mutation globs for a full quality-tools run', () => {
    const args = buildMutationArgsForTest(resolveQualityTarget(REPO_ROOT, 'quality-tools/'));
    expect(args[0]).toBe('run');
    expect(args[1]).toBe(`${REPO_ROOT}/stryker.config.cjs`);
    expect(args[3]).toBe('reports/quality-tools/mutation/quality-tools/stryker-incremental-quality-tools.json');
    expect(args).toContain('-m');
    expect(args.join(' ')).toContain('src/**/*.ts');
    expect(args.join(' ')).toContain('!src/cli/**/*.ts');
  });

  it('scopes sub-file runs with explicit mutate globs and sanitized report keys', () => {
    const args = buildMutationArgsForTest({
      absolutePath: `${REPO_ROOT}/src/mutation/Weird File.TS`,
      kind: 'file',
      packageName: 'quality-tools',
      packageRelativePath: 'src/mutation/Weird File.TS',
      packageRoot: `${REPO_ROOT}`,
      relativePath: 'src/mutation/Weird File.TS'
    } satisfies QualityTarget);

    expect(args[0]).toBe('run');
    expect(args[3]).toBe(
      'reports/quality-tools/mutation/src-mutation-weird-file.ts/stryker-incremental-src-mutation-weird-file.ts.json'
    );
    expect(args).toContain('-m');
    expect(args.join(' ')).toContain('src/mutation/Weird File.TS');
    expect(args.join(' ')).toContain('!src/cli/**/*.ts');
  });

  it('builds repo-wide mutation arguments for dot targets', () => {
    const args = buildMutationArgsForTest(resolveQualityTarget(REPO_ROOT));

    expect(args[0]).toBe('run');
    expect(args[1]).toBe(`${REPO_ROOT}/stryker.config.cjs`);
    expect(args[3]).toBe('reports/quality-tools/mutation/repo/stryker-incremental-repo.json');
    expect(args).toContain('-m');
    expect(args.join(' ')).toContain('src/**/*.ts');
  });

  it('passes --force to Stryker when requested', () => {
    const args = buildMutationArgsForTest(resolveQualityTarget(REPO_ROOT, 'quality-tools/'), { force: true });

    expect(args).toContain('--force');
  });
});
