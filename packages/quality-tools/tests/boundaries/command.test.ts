import { describe, expect, it, vi } from 'vitest';
import { runBoundariesCli, type BoundariesCliDependencies } from '../../src/boundaries/command';
import { REPO_ROOT } from '../../src/shared/resolve/repoRoot';
import type { BoundaryReport } from '../../src/boundaries/model';
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

function createReport(): BoundaryReport {
  return {
    deadEnds: [],
    deadSurfaces: [],
    files: [],
    layerViolations: [],
    target: 'packages/extension'
  };
}

function createDependencies(report: BoundaryReport = createReport()): BoundariesCliDependencies {
  return {
    analyzeBoundaries: vi.fn(() => report),
    reportBoundaries: vi.fn(),
    resolveQualityTarget: vi.fn(() => createTarget()),
    setExitCode: vi.fn()
  };
}

function runWithReport(args: string[], report: BoundaryReport = createReport()): BoundariesCliDependencies {
  const dependencies = createDependencies(report);
  runBoundariesCli(args, dependencies);
  return dependencies;
}

describe('runBoundariesCli', () => {
  it('passes the resolved target into the analyzer and reports the summary', () => {
    const dependencies = runWithReport(['extension/']);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, 'extension/');
    expect(dependencies.analyzeBoundaries).toHaveBeenCalledWith(REPO_ROOT, createTarget());
    expect(dependencies.reportBoundaries).toHaveBeenCalledWith(createReport(), { verbose: false });
    expect(dependencies.setExitCode).not.toHaveBeenCalled();
  });

  it.each([
    { flag: '--verbose', verbose: true },
    { flag: '--strict', verbose: false },
  ])('treats a leading $flag flag as a value flag during target parsing', ({ flag, verbose }) => {
    const dependencies = runWithReport([flag, 'extension/']);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, undefined);
    expect(dependencies.reportBoundaries).toHaveBeenCalledWith(createReport(), { verbose });
    expect(dependencies.setExitCode).not.toHaveBeenCalled();
  });

  it('treats a leading --json flag as a value flag during target parsing', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const dependencies = runWithReport(['--json', 'extension/']);

    expect(dependencies.resolveQualityTarget).toHaveBeenCalledWith(REPO_ROOT, undefined);
    expect(log).toHaveBeenCalledWith(JSON.stringify(createReport(), null, 2));
    expect(dependencies.reportBoundaries).not.toHaveBeenCalled();

    log.mockRestore();
  });

  it.each([
    {
      name: 'layer violations even without dead ends or strict mode',
      args: ['extension/'],
      report: {
        ...createReport(),
        layerViolations: [
          {
            from: 'packages/extension/src/core/bad.ts',
            reason: 'core cannot depend on webview',
            to: 'packages/extension/src/webview/view.ts',
          },
        ],
      },
    },
    {
      name: 'dead ends even when there are no layer violations',
      args: ['extension/'],
      report: {
        ...createReport(),
        deadEnds: [
          {
            absolutePath: `${REPO_ROOT}/packages/extension/src/shared/isolated.ts`,
            entrypoint: false,
            incoming: 0,
            outgoing: 0,
            relativePath: 'packages/extension/src/shared/isolated.ts',
          },
        ],
      },
    },
    {
      name: 'dead surfaces in strict mode',
      args: ['extension/', '--strict'],
      report: {
        ...createReport(),
        deadSurfaces: [
          {
            absolutePath: `${REPO_ROOT}/packages/extension/src/shared/orphan.ts`,
            entrypoint: false,
            incoming: 0,
            outgoing: 1,
            relativePath: 'packages/extension/src/shared/orphan.ts',
          },
        ],
      },
    },
  ] satisfies Array<{ name: string; args: string[]; report: BoundaryReport }>)('fails for $name', ({ args, report }) => {
    const dependencies = runWithReport(args, report);

    expect(dependencies.setExitCode).toHaveBeenCalledWith(1);
  });

  it.each([
    {
      name: 'strict mode when dead surfaces are absent',
      args: ['extension/', '--strict'],
      report: createReport(),
    },
    {
      name: 'dead surfaces when strict mode is absent',
      args: ['extension/'],
      report: {
        ...createReport(),
        deadSurfaces: [
          {
            absolutePath: `${REPO_ROOT}/packages/extension/src/shared/orphan.ts`,
            entrypoint: false,
            incoming: 0,
            outgoing: 1,
            relativePath: 'packages/extension/src/shared/orphan.ts',
          },
        ],
      },
    },
  ] satisfies Array<{ name: string; args: string[]; report: BoundaryReport }>)('does not fail for $name', ({ args, report }) => {
    const dependencies = runWithReport(args, report);

    expect(dependencies.setExitCode).not.toHaveBeenCalled();
  });

  it('prints JSON and sets a failure exit code when violations exist', () => {
    const report = {
      ...createReport(),
      deadEnds: [
        {
          absolutePath: `${REPO_ROOT}/packages/extension/src/shared/isolated.ts`,
          entrypoint: false,
          incoming: 0,
          outgoing: 0,
          relativePath: 'packages/extension/src/shared/isolated.ts'
        }
      ],
      layerViolations: [
        {
          from: 'packages/extension/src/core/bad.ts',
          reason: 'core cannot depend on webview',
          to: 'packages/extension/src/webview/view.ts'
        }
      ]
    } satisfies BoundaryReport;
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const dependencies = runWithReport(['--json', '--strict', 'extension/'], report);

    expect(log).toHaveBeenCalledTimes(1);
    expect(dependencies.reportBoundaries).not.toHaveBeenCalled();
    expect(dependencies.setExitCode).toHaveBeenCalledWith(1);

    log.mockRestore();
  });
});
