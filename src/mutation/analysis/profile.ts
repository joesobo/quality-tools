import { existsSync } from 'fs';
import { join } from 'path';
import { resolveMutationStrykerConfig } from '../../config/quality';
import { type QualityTarget } from '../../shared/resolve/target';
import { PACKAGE_ROOT, REPO_ROOT } from '../../shared/resolve/repoRoot';

export interface MutationProfile {
  configPath: string;
  packageName?: string;
}

function defaultHostStrykerConfig(repoRoot: string): string | undefined {
  return [
    'stryker.config.cjs',
    'stryker.config.mjs',
    'stryker.config.js',
    'stryker.conf.js'
  ]
    .map((fileName) => join(repoRoot, fileName))
    .find((configPath) => existsSync(configPath));
}

export function resolveMutationProfile(target: QualityTarget): MutationProfile {
  const packageConfig = resolveMutationStrykerConfig(REPO_ROOT, target.packageName) ??
    defaultHostStrykerConfig(REPO_ROOT) ??
    `${PACKAGE_ROOT}/stryker.config.cjs`;
  return {
    configPath: packageConfig,
    ...(target.packageName ? { packageName: target.packageName } : {})
  };
}
