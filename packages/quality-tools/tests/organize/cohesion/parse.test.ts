import { afterEach, describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import { extractImports, parseFileImports } from '../../../src/organize/cohesion/imports/parse';
import { cleanupTempDirs, createFile, createTempDir } from '../testHelpers';

const tempDirs: string[] = [];

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

function importsFromSource(code: string): string[] {
  return extractImports(ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true));
}

function importsFromFile(fileName: string, code: string): string[] {
  const dir = createTempDir(tempDirs);
  const filePath = createFile(dir, fileName, code);
  return parseFileImports(filePath, fileName);
}

describe('extractImports', () => {
  it.each([
    ["import { x } from './foo';\nimport { y } from './bar';", ['./foo', './bar']],
    ["export { x } from './foo';\nexport * from './bar';", ['./foo', './bar']],
    ["import { x } from './foo';\nexport { y } from './bar';", ['./foo', './bar']],
    ['const x = 1;\nfunction foo() { return x; }', []],
    ["import type { MyType } from './foo';\nconst x: MyType = {};", ['./foo']],
    ["import { x } from './foo';\nimport { y } from './foo';\nimport { z } from './bar';", ['./foo', './foo', './bar']],
    ["import { Component } from 'react';\nimport * from '@babel/core';", ['react', '@babel/core']],
    ['', []],
    ["if (condition) { import { x } from './foo'; }", ['./foo']],
    ["import Button from './Button';\nexport default function App() {}", ['./Button']],
    ["export { x };", []],
    ['const x = 1;', []]
  ])('extracts %j from source', (code, expected) => {
    const imports = importsFromSource(code);

    expect(imports).toEqual(expected);
    if (expected.length === 0) {
      expect(Array.isArray(imports)).toBe(true);
    }
  });

  it('ignores non-string module specifiers in synthetic import and export nodes', () => {
    const sourceFile = ts.factory.createSourceFile(
      [
        ts.factory.createImportDeclaration(
          undefined,
          undefined,
          ts.factory.createIdentifier('module'),
          undefined
        ),
        ts.factory.createExportDeclaration(
          undefined,
          false,
          undefined,
          ts.factory.createIdentifier('module'),
          undefined
        )
      ],
      ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None
    );

    expect(extractImports(sourceFile)).toEqual([]);
  });
});

describe('parseFileImports', () => {
  it.each([
    ['test.ts', "import { x } from './foo';\nexport const y = x;", ['./foo']],
    ['Button.tsx', "import { Component } from 'react';\nexport const Button = () => <div />;", ['react']],
    ['Component.jsx', "import { Component } from 'react';\nconst MyComponent = () => <div />;", ['react']],
    ['module.js', "const x = require('./foo');\nmodule.exports = x;", []],
    ['App.tsx', "import { Component } from 'react';\nimport { useState } from 'react';\nimport { configService } from './services/config';\nexport * from './types';", ['react', 'react', './services/config', './types']],
    ['constants.ts', 'export const PI = 3.14159;', []],
    ['component.tsx', 'export const MyComponent = () => <div />;', []],
    ['component.ts', 'export const MyComponent = () => <div />;', []]
  ])('parses imports from %s', (fileName, code, expected) => {
    const imports = importsFromFile(fileName, code);

    expect(imports).toEqual(expected);
    expect(Array.isArray(imports)).toBe(true);
  });

  it.each([
    ['/nonexistent/path/file.ts', 'file.ts'],
    ['/nonexistent/file/path.ts', 'test.ts']
  ])('returns an empty array for missing file %s', (filePath, fileName) => {
    const imports = parseFileImports(filePath, fileName);

    expect(imports).toEqual([]);
    expect(Array.isArray(imports)).toBe(true);
  });

  it('returns an empty array for file read errors', () => {
    const dir = createTempDir(tempDirs);
    const imports = parseFileImports(dir, 'test.ts');

    expect(imports).toEqual([]);
    expect(Array.isArray(imports)).toBe(true);
  });
});
