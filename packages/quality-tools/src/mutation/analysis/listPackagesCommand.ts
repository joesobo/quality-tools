import { cleanCliArgs } from '../../shared/cliArgs';
import { REPO_ROOT } from '../../shared/resolve/repoRoot';
import { discoverMutationPackageNames } from './packages';

export interface ListMutationPackagesDependencies {
  discoverMutationPackageNames: typeof discoverMutationPackageNames;
  log: (message: string) => void;
  repoRoot: string;
}

export function createDefaultListMutationPackagesDependencies(): ListMutationPackagesDependencies {
  return {
    discoverMutationPackageNames,
    log: console.log,
    repoRoot: REPO_ROOT
  };
}

export function runListMutationPackagesCli(
  rawArgs: string[],
  dependencies: ListMutationPackagesDependencies = createDefaultListMutationPackagesDependencies()
): void {
  const args = cleanCliArgs(rawArgs);
  const packageNames = dependencies.discoverMutationPackageNames(dependencies.repoRoot);
  dependencies.log(args.includes('--json') ? JSON.stringify(packageNames) : packageNames.join('\n'));
}
