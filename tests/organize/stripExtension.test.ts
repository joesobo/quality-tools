import { describe, expect, it } from 'vitest';
import { stripExtension } from '../../src/organize/naming/stripExtension';

describe('stripExtension', () => {
  it.each([
    ['reportBlocks.test.ts', 'reportBlocks'],
    ['reportBlocks.test.tsx', 'reportBlocks'],
    ['reportBlocks.spec.ts', 'reportBlocks'],
    ['reportBlocks.spec.tsx', 'reportBlocks'],
    ['reportBlocks.ts', 'reportBlocks'],
    ['reportBlocks.tsx', 'reportBlocks'],
    ['reportBlocks.js', 'reportBlocks'],
    ['reportBlocks.jsx', 'reportBlocks'],
    ['reportBlocks.test.ts', 'reportBlocks'],
    ['reportBlocks.spec.ts', 'reportBlocks'],
    ['README', 'README'],
    ['.gitignore', '.gitignore'],
    ['', ''],
    ['.ts', ''],
    ['foo.bar.baz.ts', 'foo.bar.baz'],
    ['file.', 'file.'],
    ['ReportBlocks.ts', 'ReportBlocks'],
    ['Component.test.tsx', 'Component'],
    ['utils.spec.ts', 'utils']
  ])('strips known extension from %s', (fileName, expected) => {
    expect(stripExtension(fileName)).toBe(expected);
  });
});
