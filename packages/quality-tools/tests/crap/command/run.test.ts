import { describe, expect, it } from 'vitest';
import { runCrapCli } from '../../../src/crap/command';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import { coverageProfile, createDependencies, firstMockCall } from './support';

describe('runCrapCli', () => {
  it('runs coverage and reports CRAP for the selected package source scope', () => {
    const dependencies = createDependencies({
      profiles: [coverageProfile()],
      results: []
    });

    runCrapCli(['--', 'quality-tools/', '--threshold', '12'], dependencies);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, 'quality-tools/');
    expect(dependencies.createCoverageProfiles).toHaveBeenCalledWith(
      REPO_ROOT,
      expect.objectContaining({
        packageName: 'quality-tools'
      })
    );
    expect(dependencies.runCommand).toHaveBeenCalledWith('pnpm', ['vitest'], REPO_ROOT);
    expect(dependencies.readCoverageReport).toHaveBeenCalledWith('/coverage/a.json');
    expect(dependencies.analyzeCrap).toHaveBeenCalledWith(
      [{ '/coverage/a.json': { path: '/coverage/a.json', s: {}, statementMap: {} } }],
      REPO_ROOT,
      'packages/quality-tools',
      12
    );
    expect(dependencies.reportCrap).toHaveBeenCalledWith([], 12);
  });

  it('passes coverage profile environment variables to the command runner', () => {
    const dependencies = createDependencies({
      profiles: [
        coverageProfile({
          env: {
            COVERAGE_MODE: 'workspace'
          }
        })
      ]
    });

    runCrapCli(['--', 'quality-tools/'], dependencies);

    expect(dependencies.runCommand).toHaveBeenCalledWith(
      'pnpm',
      ['vitest'],
      REPO_ROOT,
      { COVERAGE_MODE: 'workspace' }
    );
  });

  it('resolves the target after a leading threshold flag and value', () => {
    const dependencies = createDependencies();

    runCrapCli(['--threshold', '12', 'quality-tools/'], dependencies);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, 'quality-tools/');
    expect(firstMockCall(dependencies.analyzeCrap)?.[3]).toBe(12);
  });
});
