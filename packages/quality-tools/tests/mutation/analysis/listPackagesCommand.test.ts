import { describe, expect, it, vi } from 'vitest';
import {
  runListMutationPackagesCli,
  type ListMutationPackagesDependencies
} from '../../../src/mutation/analysis/listPackagesCommand';

function dependencies(): ListMutationPackagesDependencies {
  return {
    discoverMutationPackageNames: vi.fn(() => ['extension', 'plugin-typescript']),
    log: vi.fn(),
    repoRoot: '/repo'
  };
}

describe('runListMutationPackagesCli', () => {
  it('prints one package per line by default', () => {
    const deps = dependencies();

    runListMutationPackagesCli([], deps);

    expect(deps.discoverMutationPackageNames).toHaveBeenCalledWith('/repo');
    expect(deps.log).toHaveBeenCalledWith('extension\nplugin-typescript');
  });

  it('prints json when requested', () => {
    const deps = dependencies();

    runListMutationPackagesCli(['--json'], deps);

    expect(deps.log).toHaveBeenCalledWith('["extension","plugin-typescript"]');
  });
});
