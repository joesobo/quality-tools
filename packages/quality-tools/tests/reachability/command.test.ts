import { describe, expect, it, vi } from 'vitest';
import type { BoundaryFileNode } from '../../src/boundaries/model';
import { runReachabilityCli, type ReachabilityCliDependencies } from '../../src/reachability/command';
import type { ReachabilityReport } from '../../src/reachability/model';
import { REPO_ROOT } from '../../src/shared/resolve/repoRoot';
import type { QualityTarget } from '../../src/shared/resolve/target';

function createTarget(): QualityTarget {
  return {
    absolutePath: `${REPO_ROOT}/packages/extension`,
    kind: 'package',
    packageName: 'extension',
    packageRelativePath: '.',
    packageRoot: `${REPO_ROOT}/packages/extension`,
    relativePath: 'packages/extension'
  };
}

function createFile(relativePath: string, incoming: number, outgoing: number): BoundaryFileNode {
  return {
    absolutePath: `${REPO_ROOT}/${relativePath}`,
    entrypoint: false,
    incoming,
    outgoing,
    relativePath
  };
}

function createReport(): ReachabilityReport {
  return {
    deadEnds: [],
    deadSurfaces: [],
    files: [],
    target: 'packages/extension'
  };
}

function createDependencies(report: ReachabilityReport = createReport()): ReachabilityCliDependencies {
  return {
    analyzeReachability: vi.fn(() => report),
    reportReachability: vi.fn(),
    resolveQualityTarget: vi.fn(() => createTarget()),
    setExitCode: vi.fn()
  };
}

function runWithReport(args: string[], report: ReachabilityReport = createReport()): ReachabilityCliDependencies {
  const dependencies = createDependencies(report);
  runReachabilityCli(args, dependencies);
  return dependencies;
}

describe('runReachabilityCli', () => {
  it('passes the resolved target into the analyzer and reports the summary', () => {
    const dependencies = runWithReport(['extension/']);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, 'extension/');
    expect(dependencies.analyzeReachability).toHaveBeenCalledWith(REPO_ROOT, createTarget());
    expect(dependencies.reportReachability).toHaveBeenCalledWith(createReport(), { verbose: false });
    expect(dependencies.setExitCode).not.toHaveBeenCalled();
  });

  it.each([
    { flag: '--verbose', verbose: true },
    { flag: '--strict', verbose: false }
  ])('treats a leading $flag flag as a value flag during target parsing', ({ flag, verbose }) => {
    const dependencies = runWithReport([flag, 'extension/']);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, undefined);
    expect(dependencies.reportReachability).toHaveBeenCalledWith(createReport(), { verbose });
    expect(dependencies.setExitCode).not.toHaveBeenCalled();
  });

  it('treats a leading --json flag as a value flag during target parsing', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const dependencies = runWithReport(['--json', 'extension/']);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, undefined);
    expect(log).toHaveBeenCalledWith(JSON.stringify(createReport(), null, 2));
    expect(dependencies.reportReachability).not.toHaveBeenCalled();

    log.mockRestore();
  });

  it.each([
    {
      name: 'dead ends',
      args: ['extension/'],
      report: {
        ...createReport(),
        deadEnds: [createFile('packages/extension/src/shared/isolated.ts', 0, 0)]
      }
    },
    {
      name: 'strict dead surfaces',
      args: ['extension/', '--strict'],
      report: {
        ...createReport(),
        deadSurfaces: [createFile('packages/extension/src/shared/orphan.ts', 0, 1)]
      }
    }
  ] satisfies Array<{ args: string[]; name: string; report: ReachabilityReport }>)('sets a failure exit code for $name', ({ args, report }) => {
    const dependencies = runWithReport(args, report);

    expect(dependencies.setExitCode).toHaveBeenCalledWith(1);
  });

  it.each([
    {
      name: 'strict mode without dead surfaces',
      args: ['extension/', '--strict'],
      report: createReport()
    },
    {
      name: 'dead surfaces without strict mode',
      args: ['extension/'],
      report: {
        ...createReport(),
        deadSurfaces: [createFile('packages/extension/src/shared/orphan.ts', 0, 1)]
      }
    }
  ] satisfies Array<{ args: string[]; name: string; report: ReachabilityReport }>)('does not fail for $name', ({ args, report }) => {
    const dependencies = runWithReport(args, report);

    expect(dependencies.setExitCode).not.toHaveBeenCalled();
  });

  it('prints JSON and fails in strict mode for dead surfaces', () => {
    const report = {
      ...createReport(),
      deadSurfaces: [createFile('packages/extension/src/shared/orphan.ts', 0, 1)]
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const dependencies = runWithReport(['--json', '--strict', 'extension/'], report);

    expect(log).toHaveBeenCalledTimes(1);
    expect(dependencies.reportReachability).not.toHaveBeenCalled();
    expect(dependencies.setExitCode).toHaveBeenCalledWith(1);

    log.mockRestore();
  });
});
