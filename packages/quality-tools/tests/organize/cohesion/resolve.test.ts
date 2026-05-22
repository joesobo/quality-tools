import { describe, expect, it } from 'vitest';
import { resolveImportToFile } from '../../../src/organize/cohesion/imports/resolve';

function files(entries: ReadonlyArray<readonly [string, string]>): Map<string, string> {
  return new Map(entries);
}

describe('resolveImportToFile', () => {
  it.each([
    ['./foo', [['foo', 'foo.ts']], 'foo.ts'],
    ['react', [['react', 'react.ts']], undefined],
    ['../utils', [['utils', 'utils.ts']], undefined],
    ['./foo.ts', [['foo', 'foo.ts']], 'foo.ts'],
    ['./module.js', [['module', 'module.ts']], 'module.ts'],
    ['./Button.tsx', [['Button', 'Button.ts']], 'Button.ts'],
    ['./Component.jsx', [['Component', 'Component.ts']], 'Component.ts'],
    ['./utils.test.ts', [['utils', 'utils.ts']], 'utils.ts'],
    ['./Button.test.tsx', [['Button', 'Button.tsx']], 'Button.tsx'],
    ['./math.spec.ts', [['math', 'math.ts']], 'math.ts'],
    ['./Component.spec.tsx', [['Component', 'Component.tsx']], 'Component.tsx'],
    ['./bar.ts', [['foo', 'foo.ts']], undefined],
    ['./bar', [['foo', 'foo.ts']], undefined],
    ['./app.test.ts', [['index', 'index.ts'], ['app', 'app.ts']], 'app.ts'],
    ['./foo', [], undefined],
    ['./my.utils.helpers.ts', [['my.utils.helpers', 'my.utils.helpers.ts']], 'my.utils.helpers.ts'],
    ['./Button', [['Button', 'Button.tsx'], ['button', 'button.tsx']], 'Button.tsx'],
    ['/foo', [['foo', 'foo.ts']], undefined],
    ['', [['foo', 'foo.ts']], undefined],
    ['xxfoo.ts', [['foo', 'foo.ts']], undefined],
    ['./..', [['foo', 'foo.ts']], undefined],
    ['./', [['index', 'index.ts']], undefined],
    ['foo', [['foo', 'foo.ts']], undefined],
    ['../foo', [['foo', 'foo.ts']], undefined],
    ['/absolute/foo', [['foo', 'foo.ts']], undefined],
    ['./bar', [['foo', 'foo.ts'], ['bar', 'bar.ts']], 'bar.ts'],
    ['./baz', [['foo', 'foo.ts'], ['bar', 'bar.ts']], undefined]
  ] as const)('resolves %s', (specifier, availableFiles, expected) => {
    expect(resolveImportToFile(specifier, files([...availableFiles]))).toBe(expected);
  });
});
