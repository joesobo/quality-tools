import { describe, expect, it } from 'vitest';
import { sep } from 'path';
import { directoryDepth, depthVerdict } from '../../../src/organize/metric/directoryDepth';

describe('directoryDepth', () => {
  it.each([
    ['/root', '/root', 0],
    ['/home/user', '/home/user', 0],
    ['/root/src', '/root', 1],
    ['/home/user/documents', '/home/user', 1],
    ['/root/src/lib', '/root', 2],
    ['/root/src/lib/utils', '/root', 3],
    ['/home/user/projects/app/src/pages', '/home/user', 4],
    ['src/pages', 'src', 1],
    ['/root/./src', '/root', 1],
    ['/a/b/c/d/e', '/a', 4],
    ['/root/a/b/c', '/root', 3],
    ['/root/.', '/root', 0],
    ['/usr/local', '/usr/local', 0],
    ['/root/src/', '/root', 1],
    ['/root/a//b/c', '/root', 3],
    ['/root/single', '/root', 1],
    ['/root/a/b/c/d', '/root', 4],
    ['/root/a/b/c/d/e/f', '/root', 6],
    ['root', 'root', 0],
    ['src/modules/auth', 'src', 2],
    ['/a/b/c/d/e/f/g/h/i', '/a', 8],
    ['/', '/', 0]
  ])('returns %s for directory=%s root=%s', (directory, root, expected) => {
    expect(directoryDepth(directory, root)).toBe(expected);
  });

  it('handles backslash-separated paths on Windows', () => {
    if (sep !== '\\') {
      expect(directoryDepth('/home/user/documents', '/home/user')).toBe(1);
      return;
    }

    expect(directoryDepth('C:\\Users\\User\\Documents', 'C:\\Users\\User')).toBe(1);
    expect(directoryDepth('C:\\Users\\User\\Documents\\Work', 'C:\\Users\\User')).toBe(2);
  });
});

describe('depthVerdict', () => {
  it.each([
    [0, 4, 5, 'STABLE'],
    [3, 4, 5, 'STABLE'],
    [0, 2, 3, 'STABLE'],
    [4, 4, 5, 'WARNING'],
    [4, 4, 6, 'WARNING'],
    [2, 2, 3, 'WARNING'],
    [3, 2, 4, 'WARNING'],
    [5, 4, 5, 'DEEP'],
    [6, 4, 5, 'DEEP'],
    [10, 4, 5, 'DEEP'],
    [2, 3, 3, 'STABLE'],
    [3, 3, 3, 'DEEP'],
    [5, 10, 20, 'STABLE'],
    [10, 10, 20, 'WARNING'],
    [20, 10, 20, 'DEEP'],
    [0, 1, 2, 'STABLE'],
    [1, 1, 2, 'WARNING'],
    [2, 1, 2, 'DEEP']
  ] as const)('returns %s for depth=%s warning=%s deep=%s', (depth, warning, deep, expected) => {
    expect(depthVerdict(depth, warning, deep)).toBe(expected);
  });
});
