import { beforeEach, describe, expect, it, vi } from 'vitest';

const globSync = vi.fn(() => [
  '/repo/tests/b.test.ts',
  '/repo/tests/a.test.ts',
  '/repo/tests/a.test.ts'
]);
const resolvePackageToolGlobs = vi.fn(() => ({
  include: ['tests/**/*.test.ts'],
  exclude: ['tests/helpers/**']
}));

vi.mock('glob', () => ({
  globSync
}));

vi.mock('../../../../src/config/quality', () => ({
  resolvePackageToolGlobs
}));

describe('discoverPackageTestFiles', () => {
  beforeEach(() => {
    globSync.mockClear();
    resolvePackageToolGlobs.mockClear();
  });

  it('uses the configured include and exclude globs with absolute paths', async () => {
    const { discoverPackageTestFiles } = await import('../../../../src/scrap/test/discovery/globs');
    expect(discoverPackageTestFiles('quality-tools', '/repo')).toEqual([
      '/repo/tests/a.test.ts',
      '/repo/tests/b.test.ts'
    ]);
    expect(resolvePackageToolGlobs).toHaveBeenCalledWith('/repo', 'quality-tools', 'scrap');
    expect(globSync).toHaveBeenCalledWith('tests/**/*.test.ts', {
      absolute: true,
      cwd: '/repo',
      ignore: ['tests/helpers/**']
    });
  });
});
