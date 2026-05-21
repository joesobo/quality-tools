import { describe, expect, it } from 'vitest';
import { relativeTo, toPosix } from '../../../src/shared/util/pathUtils';

describe('pathUtils', () => {
  it('converts backslashes to posix separators', () => {
    expect(toPosix('packages\\quality-tools\\src\\file.ts')).toBe('packages/quality-tools/src/file.ts');
  });

  it('returns posix relative paths', () => {
    expect(relativeTo('/repo', '/repo/packages/quality-tools/src/file.ts')).toBe(
      'packages/quality-tools/src/file.ts'
    );
  });
});
