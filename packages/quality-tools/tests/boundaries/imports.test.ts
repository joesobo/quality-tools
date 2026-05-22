import { describe, expect, it } from 'vitest';
import { resolveImportTarget } from '../../src/boundaries/graph/imports';

describe('resolveImportTarget', () => {
  it.each([
    {
      name: 'ignores non-relative imports',
      currentFile: '/repo/a.ts',
      specifier: 'vitest',
      candidates: ['/repo/b.ts'],
      expected: undefined
    },
    {
      name: 'does not resolve non-relative specifiers against the current directory',
      currentFile: '/repo/src/a.ts',
      specifier: 'b',
      candidates: ['/repo/src/b'],
      expected: undefined
    },
    {
      name: 'ignores empty specifiers',
      currentFile: '/repo/a.ts',
      specifier: '',
      candidates: ['/repo/b.ts'],
      expected: undefined
    },
    {
      name: 'resolves sibling files with extensions',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b.ts'],
      expected: '/repo/src/b.ts'
    },
    {
      name: 'resolves index files inside a directory import',
      currentFile: '/repo/src/a.ts',
      specifier: './shared',
      candidates: ['/repo/src/shared/index.tsx'],
      expected: '/repo/src/shared/index.tsx'
    },
    {
      name: 'returns undefined when no candidate matches',
      currentFile: '/repo/src/a.ts',
      specifier: './missing',
      candidates: ['/repo/src/b.ts'],
      expected: undefined
    },
    {
      name: 'prefers the first matching candidate in resolution order',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b.ts', '/repo/src/b/index.ts'],
      expected: '/repo/src/b.ts'
    },
    {
      name: 'supports extensionless candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b'],
      expected: '/repo/src/b'
    },
    {
      name: 'supports TypeScript candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b.ts'],
      expected: '/repo/src/b.ts'
    },
    {
      name: 'supports TSX candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b.tsx'],
      expected: '/repo/src/b.tsx'
    },
    {
      name: 'supports JavaScript candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b.js'],
      expected: '/repo/src/b.js'
    },
    {
      name: 'supports JSX candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b.jsx'],
      expected: '/repo/src/b.jsx'
    },
    {
      name: 'supports TypeScript index candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b/index.ts'],
      expected: '/repo/src/b/index.ts'
    },
    {
      name: 'supports TSX index candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b/index.tsx'],
      expected: '/repo/src/b/index.tsx'
    },
    {
      name: 'supports JavaScript index candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b/index.js'],
      expected: '/repo/src/b/index.js'
    },
    {
      name: 'supports JSX index candidate paths',
      currentFile: '/repo/src/a.ts',
      specifier: './b',
      candidates: ['/repo/src/b/index.jsx'],
      expected: '/repo/src/b/index.jsx'
    }
  ])('$name', ({ currentFile, specifier, candidates, expected }) => {
    expect(resolveImportTarget(currentFile, specifier, new Set(candidates))).toBe(expected);
  });
});
