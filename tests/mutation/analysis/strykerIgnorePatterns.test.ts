import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';

const require = createRequire(import.meta.url);

describe('mutation config ignore patterns', () => {
  it('keeps heavyweight local artifacts out of the quality-tools Stryker sandbox', () => {
    const config = require(`${REPO_ROOT}/stryker.config.cjs`) as { ignorePatterns?: string[] };

    expect(config.ignorePatterns).toEqual(
      expect.arrayContaining([
        '/.vscode-test',
        '/.vscode-test/**',
        '/.stryker-tmp',
        '/.stryker-tmp/**',
      ]),
    );
  });
});
