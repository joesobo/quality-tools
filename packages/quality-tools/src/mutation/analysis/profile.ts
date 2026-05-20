import { type QualityTarget } from '../../shared/resolve/target';
import { PACKAGE_ROOT } from '../../shared/resolve/repoRoot';

export interface MutationProfile {
  configPath: string;
  packageName: string;
}

export { discoverMutationPackageNames } from './packages';

export function resolveMutationProfile(target: QualityTarget): MutationProfile {
  if (!target.packageName) {
    throw new Error('Mutation targets must resolve to a workspace package.');
  }

  const packageConfig = `${PACKAGE_ROOT}/stryker.config.cjs`;
  return { configPath: packageConfig, packageName: target.packageName };
}
