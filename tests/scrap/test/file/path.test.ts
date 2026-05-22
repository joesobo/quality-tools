import { describe, expect, it } from 'vitest';
import { isTestPath } from '../../../../src/scrap/test/discovery/path';

describe('isTestPath', () => {
  it.each([
    ['tests', true],
    ['tests/scrap/example.test.ts', true],
    ['src/scrap/example.ts', false],
    ['', false],
    [undefined, false]
  ])('classifies %s', (packageRelativePath, expected) => {
    expect(isTestPath(packageRelativePath)).toBe(expected);
  });
});
