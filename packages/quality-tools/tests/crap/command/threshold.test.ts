import { describe, expect, it } from 'vitest';
import { parseThreshold, runCrapCli } from '../../../src/crap/command';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';
import { createDependencies, firstMockCall } from './support';

describe('parseThreshold', () => {
  it('reads an explicit threshold flag', () => {
    expect(parseThreshold(['--threshold', '14'])).toBe(14);
  });

  it('falls back to the default threshold', () => {
    expect(parseThreshold([])).toBe(8);
  });

  it('ignores similar threshold-looking arguments', () => {
    expect(parseThreshold(['--thresh', '99'])).toBe(8);
    expect(parseThreshold(['threshold', '99'])).toBe(8);
  });
});

describe('runCrapCli threshold parsing', () => {
  it('uses the default threshold when none is provided', () => {
    const dependencies = createDependencies();

    runCrapCli(['quality-tools/'], dependencies);

    expect(dependencies.analyzeCrap).toHaveBeenCalledWith([], REPO_ROOT, 'packages/quality-tools', 8);
  });

  it('uses only the exact threshold flag spelling', () => {
    const dependencies = createDependencies();

    runCrapCli(['--', 'quality-tools/', '--threshold', '20'], dependencies);

    expect(firstMockCall(dependencies.analyzeCrap)?.[3]).toBe(20);
  });
});
