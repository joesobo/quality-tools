import { describe, expect, it } from 'vitest';
import { findContainingPackage } from '../../../src/shared/util/packageTarget';

const workspacePackages = [
  { name: 'alpha', root: '/repo/packages/alpha' },
  { name: 'beta', root: '/repo/packages/beta' }
];

describe('findContainingPackage', () => {
  it('matches exact package roots and nested paths', () => {
    expect(findContainingPackage('/repo/packages/alpha', workspacePackages)?.name).toBe('alpha');
    expect(findContainingPackage('/repo/packages/beta/src/file.ts', workspacePackages)?.name).toBe('beta');
  });

  it('prefers the deepest package root when packages are nested', () => {
    expect(findContainingPackage('/repo/packages/alpha/src/file.ts', [
      { name: 'root', root: '/repo' },
      { name: 'alpha', root: '/repo/packages/alpha' }
    ])?.name).toBe('alpha');
  });

  it('returns undefined for paths outside a package', () => {
    expect(findContainingPackage('/repo/docs/readme.md', workspacePackages)).toBeUndefined();
  });
});
