import { describe, expect, it } from 'vitest';
import { analyzeCrap } from '../../../src/crap/analysis/run';
import { writeFixture } from './support';

describe('analyzeCrap edge cases', () => {
  it('reports zero coverage when a function has no mapped statements', () => {
    const { filePath, repoRoot } = writeFixture(
      'packages/example/src/empty.ts',
      'export function empty() { return 1; }'
    );

    const results = analyzeCrap(
      [{ [filePath]: { path: filePath, s: {}, statementMap: {} } }],
      repoRoot,
      'packages/example/src',
      1
    );

    expect(results[0]?.coverage).toBe(0);
  });

  it('skips test and e2e files even when they are in coverage data', () => {
    const { filePath, repoRoot } = writeFixture(
      'packages/example/tests/sample.test.ts',
      'export function ignored() { return 1; }'
    );

    const results = analyzeCrap(
      [{ [filePath]: { path: filePath, s: { '0': 1 }, statementMap: {
        '0': {
          start: { column: 2, line: 1 },
          end: { column: 20, line: 1 }
        }
      } } }],
      repoRoot,
      undefined,
      0
    );

    expect(results).toEqual([]);
  });
});
