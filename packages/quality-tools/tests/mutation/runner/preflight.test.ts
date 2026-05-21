import { describe, expect, it, vi } from 'vitest';
import { REPO_ROOT } from '../../../src/shared/resolve/repoRoot';

const execFileSync = vi.hoisted(() => vi.fn());

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();

  return {
    ...actual,
    default: {
      ...actual,
      execFileSync,
    },
    execFileSync,
  };
});

describe('runPreflightTypecheck', () => {
  it('runs the repo typecheck before mutation execution', async () => {
    const { runPreflightTypecheck } = await import('../../../src/mutation/runner/command');

    runPreflightTypecheck();

    expect(execFileSync).toHaveBeenCalledWith('pnpm', ['run', 'typecheck'], {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    });
  });
});
