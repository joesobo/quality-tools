import { describe, expect, it } from 'vitest';
import { analyzeCrap } from '../../../../src/crap/analysis/run';
import { createCoverage, writeSourceFixture } from '../support';

describe('analyzeCrap filter scope', () => {
  it('ignores files outside the selected source scope', () => {
    const { filePath, repoRoot } = writeSourceFixture();
    const results = analyzeCrap(
      [createCoverage(filePath)],
      repoRoot,
      'packages/other/src',
      1
    );

    expect(results).toEqual([]);
  });
});
