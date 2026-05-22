import { describe, expect, it } from 'vitest';
import { relativeTo, toPosix } from '../../../src/shared/util/pathUtils';

describe('pathUtils', () => {
  it('converts backslashes to posix separators', () => {
    expect(toPosix('src\\file.ts')).toBe('src/file.ts');
  });

  it('returns posix relative paths', () => {
    expect(relativeTo('/repo', '/repo/src/file.ts')).toBe(
      'src/file.ts'
    );
  });
});
