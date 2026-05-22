import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export function strykerBinPath(): string {
  return join(dirname(require.resolve('@stryker-mutator/core/package.json')), 'bin/stryker.js');
}
