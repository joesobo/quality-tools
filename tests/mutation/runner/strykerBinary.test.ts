import { describe, expect, it } from 'vitest';
import { strykerBinPath } from '../../../src/mutation/runner/strykerBinary';

describe('strykerBinPath', () => {
  it('resolves the Stryker CLI binary inside the package bin directory', () => {
    expect(strykerBinPath()).toMatch(/@stryker-mutator\/core.*bin\/stryker\.js$/);
  });
});
